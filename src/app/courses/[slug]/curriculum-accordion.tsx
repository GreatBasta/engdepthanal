"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  CourseCoverage,
  CurriculumApplyResult,
  CurriculumSubtopicItem,
  CurriculumTopicPayload,
  CurriculumTopicSummary,
} from "@/lib/courses/curriculum-contract";

import {
  addCourseSubtopicAction,
  addCourseTopicAction,
  applyCurriculumChangesAction,
  moveCourseSubtopicAction,
  moveCourseTopicAction,
  setCourseSubtopicHiddenAction,
  setCourseTopicHiddenAction,
  updateCourseSubtopicAction,
  updateCourseTopicAction,
} from "./curriculum-actions";
import { setCourseProgressAction } from "./progress-actions";

type TopicLoadState =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; payload: CurriculumTopicPayload };

type FormAction = (formData: FormData) => Promise<unknown>;

export function CurriculumAccordion({
  coursePageId,
  courseSlug,
  canEdit,
  canTrack,
  initialAdvancedChangesPending,
  initialTopicStableId,
  lastUpdatedAt,
  settingsMode,
  topics,
}: {
  coursePageId: string;
  courseSlug: string;
  canEdit: boolean;
  canTrack: boolean;
  initialAdvancedChangesPending: boolean;
  initialTopicStableId?: string;
  lastUpdatedAt: string;
  settingsMode: boolean;
  topics: CurriculumTopicSummary[];
}) {
  const router = useRouter();
  const [openTopics, setOpenTopics] = useState<Set<string>>(
    () => new Set(initialTopicStableId ? [initialTopicStableId] : []),
  );
  const [loadedTopics, setLoadedTopics] = useState<
    Record<string, TopicLoadState>
  >({});
  const [stagedCoverage, setStagedCoverage] = useState<
    Record<string, CourseCoverage>
  >({});
  const [advancedChangesPending, setAdvancedChangesPending] = useState(
    initialAdvancedChangesPending,
  );
  const [applyState, setApplyState] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [applyMessage, setApplyMessage] = useState("");
  const [lastAppliedAt, setLastAppliedAt] = useState(lastUpdatedAt);
  const controllers = useRef(new Map<string, AbortController>());

  const loadTopic = useCallback(
    async (topicStableId: string, force = false) => {
      if (
        !force &&
        (loadedTopics[topicStableId] || controllers.current.has(topicStableId))
      ) {
        return;
      }
      controllers.current.get(topicStableId)?.abort();
      const controller = new AbortController();
      controllers.current.set(topicStableId, controller);
      const existing = loadedTopics[topicStableId];
      if (!(force && existing?.state === "ready")) {
        setLoadedTopics((current) => ({
          ...current,
          [topicStableId]: { state: "loading" },
        }));
      }
      try {
        const response = await fetch(
          `/api/courses/${coursePageId}/curriculum/topics/${topicStableId}?mode=${canEdit ? "edit" : "read"}`,
          { cache: "no-store", signal: controller.signal },
        );
        const result = (await response.json()) as
          | CurriculumTopicPayload
          | { error?: string };
        if (!response.ok || !("topic" in result)) {
          throw new Error(
            "error" in result && result.error
              ? result.error
              : "The topic could not be loaded.",
          );
        }
        setLoadedTopics((current) => ({
          ...current,
          [topicStableId]: { state: "ready", payload: result },
        }));
      } catch (error) {
        if (controller.signal.aborted) return;
        if (existing?.state !== "ready") {
          setLoadedTopics((current) => ({
            ...current,
            [topicStableId]: {
              state: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "The topic could not be loaded.",
            },
          }));
        }
      } finally {
        if (controllers.current.get(topicStableId) === controller) {
          controllers.current.delete(topicStableId);
        }
      }
    },
    [canEdit, coursePageId, loadedTopics],
  );

  useEffect(() => {
    const activeControllers = controllers.current;
    return () => {
      for (const controller of activeControllers.values()) controller.abort();
    };
  }, []);

  useEffect(() => {
    if (initialTopicStableId) void loadTopic(initialTopicStableId);
  }, [initialTopicStableId, loadTopic]);

  function toggleTopic(topicStableId: string) {
    const opening = !openTopics.has(topicStableId);
    setOpenTopics((current) => {
      const next = new Set(current);
      if (next.has(topicStableId)) next.delete(topicStableId);
      else next.add(topicStableId);
      return next;
    });
    if (opening) void loadTopic(topicStableId);
  }

  function stageCoverage(
    subtopic: CurriculumSubtopicItem,
    coverage: CourseCoverage,
  ) {
    setApplyState("idle");
    setApplyMessage("");
    setStagedCoverage((current) => {
      const next = { ...current };
      if (coverage === subtopic.coverage) delete next[subtopic.stableId];
      else next[subtopic.stableId] = coverage;
      return next;
    });
  }

  function stageWholeTopic(
    payload: CurriculumTopicPayload,
    coverage: Exclude<CourseCoverage, "unknown">,
  ) {
    setStagedCoverage((current) => {
      const next = { ...current };
      for (const subtopic of payload.subtopics) {
        if (coverage === subtopic.coverage) delete next[subtopic.stableId];
        else next[subtopic.stableId] = coverage;
      }
      return next;
    });
    setApplyState("idle");
    setApplyMessage("");
  }

  async function runAdvancedAction(
    action: FormAction,
    formData: FormData,
    topicStableId?: string,
  ) {
    setApplyState("saving");
    setApplyMessage("Saving the pending detail change…");
    try {
      await action(formData);
      setAdvancedChangesPending(true);
      setApplyState("idle");
      setApplyMessage("Detail change saved. Apply when ready.");
      if (topicStableId) await loadTopic(topicStableId, true);
      router.refresh();
    } catch {
      setApplyState("error");
      setApplyMessage("The detail change could not be saved. Try again.");
    }
  }

  const coveragePendingCount = Object.keys(stagedCoverage).length;
  const pendingCount = coveragePendingCount + (advancedChangesPending ? 1 : 0);
  const hasPendingChanges = pendingCount > 0;

  function applyChanges() {
    if (!hasPendingChanges || applyState === "saving") return;
    setApplyState("saving");
    setApplyMessage("Applying curriculum changes…");
    const changes = Object.entries(stagedCoverage).map(
      ([subtopicStableId, coverage]) => ({ subtopicStableId, coverage }),
    );
    startTransition(async () => {
      const result: CurriculumApplyResult = await applyCurriculumChangesAction({
        coursePageId,
        courseSlug,
        changes,
      });
      if (!result.ok) {
        setApplyState("error");
        setApplyMessage(result.message);
        return;
      }
      setLoadedTopics((current) =>
        Object.fromEntries(
          Object.entries(current).map(([stableId, state]) => {
            if (state.state !== "ready") return [stableId, state];
            return [
              stableId,
              {
                state: "ready",
                payload: {
                  ...state.payload,
                  subtopics: state.payload.subtopics.map((subtopic) => ({
                    ...subtopic,
                    coverage:
                      stagedCoverage[subtopic.stableId] ?? subtopic.coverage,
                  })),
                },
              } satisfies TopicLoadState,
            ];
          }),
        ),
      );
      setStagedCoverage({});
      setAdvancedChangesPending(false);
      setApplyState("success");
      setApplyMessage(result.message);
      if (result.updatedAt) setLastAppliedAt(result.updatedAt);
      for (const topicStableId of openTopics) {
        void loadTopic(topicStableId, true);
      }
      router.refresh();
    });
  }

  const statusText = useMemo(() => {
    if (applyMessage) return applyMessage;
    if (!hasPendingChanges) return "No pending changes";
    return `${pendingCount} pending change${pendingCount === 1 ? "" : "s"}`;
  }, [applyMessage, hasPendingChanges, pendingCount]);

  return (
    <div className="curriculum-editor space-y-5 pb-32 md:pb-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">
              {settingsMode && canEdit ? "Curriculum setup" : "Curriculum"}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {canEdit
                ? "Classify coverage directly, then apply all pending changes together."
                : "Open any topic to explore its subtopics and learning details."}
            </p>
          </div>
          <p className="text-xs text-zinc-500">
            Curriculum last updated{" "}
            {new Intl.DateTimeFormat("en", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(lastAppliedAt))}
          </p>
        </div>
      </section>

      <ol className="space-y-4">
        {topics.map((topic, topicIndex) => {
          const expanded = openTopics.has(topic.stableId);
          const loaded = loadedTopics[topic.stableId];
          const payload = loaded?.state === "ready" ? loaded.payload : null;
          const classifiedCount = payload
            ? payload.subtopics.filter(
                (subtopic) =>
                  (stagedCoverage[subtopic.stableId] ?? subtopic.coverage) !==
                  "unknown",
              ).length
            : topic.classifiedCount;
          return (
            <li key={topic.stableId}>
              <section
                id={`curriculum-topic-${topic.stableId}`}
                className={`scroll-mt-24 overflow-hidden rounded-2xl border bg-white shadow-sm ${
                  topic.hidden
                    ? "border-dashed border-zinc-300 opacity-75"
                    : "border-zinc-200"
                }`}
              >
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`curriculum-topic-panel-${topic.stableId}`}
                  onClick={() => toggleTopic(topic.stableId)}
                  onFocus={() => void loadTopic(topic.stableId)}
                  onPointerEnter={() => void loadTopic(topic.stableId)}
                  className="flex min-h-14 w-full items-start justify-between gap-4 px-4 py-4 text-left transition-colors duration-200 hover:bg-zinc-50 sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Topic {topicIndex + 1}
                    </span>
                    <span
                      className={`mt-1 block font-bold ${topic.hidden ? "line-through" : ""}`}
                    >
                      {topic.name}
                    </span>
                    <span className="mt-1 block text-xs text-zinc-500">
                      {canEdit
                        ? `${classifiedCount} of ${topic.subtopicCount} classified`
                        : `${topic.subtopicCount} subtopics`}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`mt-3 shrink-0 text-xl text-zinc-400 transition-transform duration-200 ${
                      expanded ? "rotate-180" : ""
                    }`}
                  >
                    ⌄
                  </span>
                </button>

                {expanded ? (
                  <div
                    id={`curriculum-topic-panel-${topic.stableId}`}
                    className="border-t border-zinc-200 px-3 py-4 sm:px-5"
                  >
                    {loaded?.state === "error" ? (
                      <div
                        role="alert"
                        className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800"
                      >
                        <p>{loaded.message}</p>
                        <button
                          type="button"
                          onClick={() => void loadTopic(topic.stableId, true)}
                          className="mt-3 min-h-11 rounded-xl border border-rose-300 bg-white px-4 font-semibold"
                        >
                          Retry
                        </button>
                      </div>
                    ) : payload ? (
                      <TopicContent
                        payload={payload}
                        coursePageId={coursePageId}
                        courseSlug={courseSlug}
                        canEdit={canEdit}
                        canTrack={canTrack}
                        stagedCoverage={stagedCoverage}
                        onCoverageChange={stageCoverage}
                        onMarkAll={stageWholeTopic}
                        onAdvancedAction={runAdvancedAction}
                      />
                    ) : (
                      <TopicSkeleton />
                    )}
                  </div>
                ) : null}
              </section>
            </li>
          );
        })}
      </ol>

      {topics.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          No visible topics in this curriculum.
        </p>
      ) : null}

      {canEdit ? (
        <form
          action={(formData) =>
            runAdvancedAction(addCourseTopicAction, formData)
          }
          className="rounded-2xl border border-dashed border-zinc-300 bg-white p-5"
        >
          <CourseIdentity coursePageId={coursePageId} courseSlug={courseSlug} />
          <h3 className="font-bold">Add topic</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
            <input
              name="name"
              required
              maxLength={180}
              placeholder="Topic name"
              aria-label="New topic name"
              className={inputClass}
            />
            <input
              name="description"
              maxLength={2000}
              placeholder="Optional description"
              aria-label="New topic description"
              className={inputClass}
            />
            <button className={primaryButtonClass}>Add topic</button>
          </div>
        </form>
      ) : null}

      {canEdit ? (
        <div className="curriculum-apply-bar fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-xl backdrop-blur md:sticky md:inset-x-auto md:bottom-4">
          <div className="min-w-0" aria-live="polite">
            <p className="truncate text-sm font-bold">{statusText}</p>
            <p
              className={`text-xs ${applyState === "error" ? "text-rose-700" : applyState === "success" ? "text-emerald-700" : "text-zinc-500"}`}
            >
              {applyState === "saving"
                ? "Saving atomically…"
                : hasPendingChanges
                  ? "Changes remain local or pending until Apply."
                  : "The latest applied curriculum is public."}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={coveragePendingCount === 0 || applyState === "saving"}
              onClick={() => {
                setStagedCoverage({});
                setApplyMessage("");
                setApplyState("idle");
              }}
              className="hidden min-h-11 rounded-xl border border-zinc-300 px-3 text-sm font-semibold disabled:opacity-40 sm:inline-flex sm:items-center"
            >
              Discard coverage
            </button>
            <button
              type="button"
              disabled={!hasPendingChanges || applyState === "saving"}
              onClick={applyChanges}
              className="min-h-11 min-w-28 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition-opacity disabled:opacity-40"
            >
              {applyState === "saving" ? "Applying…" : "Apply changes"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TopicContent({
  payload,
  coursePageId,
  courseSlug,
  canEdit,
  canTrack,
  stagedCoverage,
  onCoverageChange,
  onMarkAll,
  onAdvancedAction,
}: {
  payload: CurriculumTopicPayload;
  coursePageId: string;
  courseSlug: string;
  canEdit: boolean;
  canTrack: boolean;
  stagedCoverage: Record<string, CourseCoverage>;
  onCoverageChange: (
    subtopic: CurriculumSubtopicItem,
    coverage: CourseCoverage,
  ) => void;
  onMarkAll: (
    payload: CurriculumTopicPayload,
    coverage: "covered" | "not_covered",
  ) => void;
  onAdvancedAction: (
    action: FormAction,
    formData: FormData,
    topicStableId?: string,
  ) => Promise<void>;
}) {
  return (
    <div>
      {payload.topic.description ? (
        <p className="mb-4 text-sm leading-6 text-zinc-600">
          {payload.topic.description}
        </p>
      ) : null}
      {canEdit ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onMarkAll(payload, "covered")}
            className={secondaryButtonClass}
          >
            Mark all covered
          </button>
          <button
            type="button"
            onClick={() => onMarkAll(payload, "not_covered")}
            className={secondaryButtonClass}
          >
            Mark all not covered
          </button>
          <details className="ml-auto rounded-xl border border-zinc-200">
            <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold">
              Edit topic details
            </summary>
            <div className="border-t border-zinc-200 p-3">
              <form
                action={(formData) =>
                  onAdvancedAction(
                    updateCourseTopicAction,
                    formData,
                    payload.topic.stableId,
                  )
                }
                className="grid gap-2"
              >
                <CourseIdentity
                  coursePageId={coursePageId}
                  courseSlug={courseSlug}
                />
                <input type="hidden" name="topicId" value={payload.topic.id} />
                <input
                  name="name"
                  defaultValue={payload.topic.name}
                  required
                  maxLength={180}
                  className={inputClass}
                  aria-label={`Name for ${payload.topic.name}`}
                />
                <textarea
                  name="description"
                  defaultValue={payload.topic.description ?? ""}
                  maxLength={2000}
                  rows={3}
                  className={inputClass}
                  aria-label={`Description for ${payload.topic.name}`}
                />
                <button className={secondaryButtonClass}>Save details</button>
              </form>
              <div className="mt-2 flex flex-wrap gap-2">
                <MoveButtons
                  kind="topic"
                  id={payload.topic.id}
                  coursePageId={coursePageId}
                  courseSlug={courseSlug}
                  topicStableId={payload.topic.stableId}
                  onAdvancedAction={onAdvancedAction}
                />
                <form
                  action={(formData) =>
                    onAdvancedAction(
                      setCourseTopicHiddenAction,
                      formData,
                      payload.topic.stableId,
                    )
                  }
                >
                  <CourseIdentity
                    coursePageId={coursePageId}
                    courseSlug={courseSlug}
                  />
                  <input
                    type="hidden"
                    name="topicId"
                    value={payload.topic.id}
                  />
                  <input
                    type="hidden"
                    name="hidden"
                    value={payload.topic.hidden ? "no" : "yes"}
                  />
                  <button className={secondaryButtonClass}>
                    {payload.topic.hidden ? "Restore topic" : "Hide topic"}
                  </button>
                </form>
              </div>
            </div>
          </details>
        </div>
      ) : null}

      <ul className="space-y-3">
        {payload.subtopics.map((subtopic, index) => {
          const coverage =
            stagedCoverage[subtopic.stableId] ?? subtopic.coverage;
          const pending = stagedCoverage[subtopic.stableId] !== undefined;
          return (
            <li
              key={subtopic.stableId}
              className={`rounded-2xl border p-4 ${pending ? "border-amber-400 bg-amber-50/40" : "border-zinc-200 bg-white"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-500">Subtopic {index + 1}</p>
                  <h4
                    className={`mt-0.5 font-bold ${subtopic.hidden ? "line-through" : ""}`}
                  >
                    {subtopic.name}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {subtopic.description || "No description provided."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-zinc-600">
                    <span className="rounded-full bg-zinc-100 px-2 py-1 capitalize">
                      {subtopic.depthLevel}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-1">
                      {subtopic.estHours
                        ? `${subtopic.estHours} hours`
                        : "Hours not set"}
                    </span>
                    {pending ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800">
                        Pending
                      </span>
                    ) : null}
                  </div>
                </div>
                {canEdit ? (
                  <CoverageControl
                    subtopic={subtopic}
                    value={coverage}
                    onChange={onCoverageChange}
                  />
                ) : (
                  <CoverageLabel value={coverage} />
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-zinc-100 pt-3">
                <Link
                  href={`/courses/${courseSlug}?tab=resources&subtopic=${subtopic.stableId}`}
                  className={secondaryButtonClass}
                >
                  Resources &amp; discussion
                </Link>
                {canTrack && !canEdit ? (
                  <form
                    action={setCourseProgressAction}
                    className="flex flex-wrap gap-2"
                  >
                    <CourseIdentity
                      coursePageId={coursePageId}
                      courseSlug={courseSlug}
                    />
                    <input
                      type="hidden"
                      name="subtopicStableId"
                      value={subtopic.stableId}
                    />
                    <select
                      name="state"
                      defaultValue={subtopic.progress ?? "not_started"}
                      aria-label={`Private progress for ${subtopic.name}`}
                      className={inputClass}
                    >
                      <option value="not_started">Not started</option>
                      <option value="learning">Learning</option>
                      <option value="completed">Completed</option>
                      <option value="saved">Saved</option>
                    </select>
                    <button className={secondaryButtonClass}>
                      Save progress
                    </button>
                  </form>
                ) : null}
                {canEdit ? (
                  <details className="ml-auto rounded-xl border border-zinc-200">
                    <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold">
                      Edit details
                    </summary>
                    <div className="w-[min(34rem,calc(100vw-3.5rem))] border-t border-zinc-200 p-3">
                      <form
                        action={(formData) =>
                          onAdvancedAction(
                            updateCourseSubtopicAction,
                            formData,
                            payload.topic.stableId,
                          )
                        }
                        className="grid gap-3"
                      >
                        <CourseIdentity
                          coursePageId={coursePageId}
                          courseSlug={courseSlug}
                        />
                        <input
                          type="hidden"
                          name="subtopicId"
                          value={subtopic.id}
                        />
                        <input
                          name="name"
                          defaultValue={subtopic.name}
                          required
                          maxLength={220}
                          className={inputClass}
                          aria-label={`Name for ${subtopic.name}`}
                        />
                        <textarea
                          name="description"
                          defaultValue={subtopic.description ?? ""}
                          maxLength={2000}
                          rows={3}
                          className={inputClass}
                          aria-label={`Description for ${subtopic.name}`}
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <select
                            name="depthLevel"
                            defaultValue={subtopic.depthLevel}
                            className={inputClass}
                            aria-label={`Depth for ${subtopic.name}`}
                          >
                            <option value="awareness">Awareness</option>
                            <option value="procedural">Procedural</option>
                            <option value="fluency">Fluency</option>
                            <option value="proof">Proof</option>
                          </select>
                          <input
                            name="estHours"
                            type="number"
                            min={0}
                            max={999}
                            step={0.5}
                            defaultValue={subtopic.estHours ?? ""}
                            className={inputClass}
                            aria-label={`Estimated hours for ${subtopic.name}`}
                          />
                        </div>
                        <button className={secondaryButtonClass}>
                          Save details
                        </button>
                      </form>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <MoveButtons
                          kind="subtopic"
                          id={subtopic.id}
                          coursePageId={coursePageId}
                          courseSlug={courseSlug}
                          topicStableId={payload.topic.stableId}
                          onAdvancedAction={onAdvancedAction}
                        />
                        <form
                          action={(formData) =>
                            onAdvancedAction(
                              setCourseSubtopicHiddenAction,
                              formData,
                              payload.topic.stableId,
                            )
                          }
                        >
                          <CourseIdentity
                            coursePageId={coursePageId}
                            courseSlug={courseSlug}
                          />
                          <input
                            type="hidden"
                            name="subtopicId"
                            value={subtopic.id}
                          />
                          <input
                            type="hidden"
                            name="hidden"
                            value={subtopic.hidden ? "no" : "yes"}
                          />
                          <button className={secondaryButtonClass}>
                            {subtopic.hidden ? "Restore" : "Hide"}
                          </button>
                        </form>
                      </div>
                    </div>
                  </details>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {canEdit ? (
        <details className="mt-4 rounded-xl border border-dashed border-zinc-300">
          <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold">
            Add subtopic
          </summary>
          <form
            action={(formData) =>
              onAdvancedAction(
                addCourseSubtopicAction,
                formData,
                payload.topic.stableId,
              )
            }
            className="grid gap-2 border-t border-zinc-200 p-3 sm:grid-cols-2"
          >
            <CourseIdentity
              coursePageId={coursePageId}
              courseSlug={courseSlug}
            />
            <input type="hidden" name="topicId" value={payload.topic.id} />
            <input
              name="name"
              required
              maxLength={220}
              placeholder="Subtopic name"
              className={inputClass}
            />
            <input
              name="description"
              maxLength={2000}
              placeholder="Description"
              className={inputClass}
            />
            <select
              name="depthLevel"
              defaultValue="procedural"
              className={inputClass}
            >
              <option value="awareness">Awareness</option>
              <option value="procedural">Procedural</option>
              <option value="fluency">Fluency</option>
              <option value="proof">Proof</option>
            </select>
            <div className="flex gap-2">
              <input
                name="estHours"
                type="number"
                min={0}
                max={999}
                step={0.5}
                placeholder="Hours"
                className={`${inputClass} flex-1`}
              />
              <button className={primaryButtonClass}>Add</button>
            </div>
          </form>
        </details>
      ) : null}
    </div>
  );
}

function CoverageControl({
  subtopic,
  value,
  onChange,
}: {
  subtopic: CurriculumSubtopicItem;
  value: CourseCoverage;
  onChange: (
    subtopic: CurriculumSubtopicItem,
    coverage: CourseCoverage,
  ) => void;
}) {
  return (
    <div
      role="group"
      aria-label={`Coverage for ${subtopic.name}`}
      className="grid min-w-[15rem] grid-cols-2 rounded-xl bg-zinc-100 p-1"
    >
      {(["covered", "not_covered"] as const).map((coverage) => {
        const selected = value === coverage;
        return (
          <button
            key={coverage}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(subtopic, coverage)}
            className={`min-h-11 rounded-lg px-3 text-sm font-bold transition-colors duration-200 ${selected ? (coverage === "covered" ? "bg-emerald-600 text-white shadow-sm" : "bg-rose-600 text-white shadow-sm") : "text-zinc-600 hover:bg-white"}`}
          >
            {coverage === "covered" ? "Covered" : "Not covered"}
          </button>
        );
      })}
      <span className="sr-only" aria-live="polite">
        {value === "unknown"
          ? "Coverage not classified"
          : value === "covered"
            ? "Covered selected"
            : "Not covered selected"}
      </span>
    </div>
  );
}

function CoverageLabel({ value }: { value: CourseCoverage }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${value === "covered" ? "bg-emerald-100 text-emerald-800" : value === "not_covered" ? "bg-rose-100 text-rose-800" : "bg-zinc-100 text-zinc-600"}`}
    >
      {value === "covered"
        ? "Covered"
        : value === "not_covered"
          ? "Not covered"
          : "Not classified"}
    </span>
  );
}

function MoveButtons({
  kind,
  id,
  coursePageId,
  courseSlug,
  topicStableId,
  onAdvancedAction,
}: {
  kind: "topic" | "subtopic";
  id: string;
  coursePageId: string;
  courseSlug: string;
  topicStableId: string;
  onAdvancedAction: (
    action: FormAction,
    formData: FormData,
    topicStableId?: string,
  ) => Promise<void>;
}) {
  const action =
    kind === "topic" ? moveCourseTopicAction : moveCourseSubtopicAction;
  const fieldName = kind === "topic" ? "topicId" : "subtopicId";
  return (
    <form
      action={(formData) => onAdvancedAction(action, formData, topicStableId)}
      className="flex gap-1"
    >
      <CourseIdentity coursePageId={coursePageId} courseSlug={courseSlug} />
      <input type="hidden" name={fieldName} value={id} />
      <button
        name="direction"
        value="up"
        aria-label={`Move ${kind} up`}
        className={secondaryButtonClass}
      >
        ↑
      </button>
      <button
        name="direction"
        value="down"
        aria-label={`Move ${kind} down`}
        className={secondaryButtonClass}
      >
        ↓
      </button>
    </form>
  );
}

function CourseIdentity({
  coursePageId,
  courseSlug,
}: {
  coursePageId: string;
  courseSlug: string;
}) {
  return (
    <>
      <input type="hidden" name="coursePageId" value={coursePageId} />
      <input type="hidden" name="courseSlug" value={courseSlug} />
    </>
  );
}

function TopicSkeleton() {
  return (
    <div aria-label="Loading topic" role="status" className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-24 animate-pulse rounded-2xl bg-zinc-100 motion-reduce:animate-none"
        />
      ))}
      <span className="sr-only">Loading topic…</span>
    </div>
  );
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";
const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 text-sm font-semibold hover:bg-zinc-50";
const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-500";
