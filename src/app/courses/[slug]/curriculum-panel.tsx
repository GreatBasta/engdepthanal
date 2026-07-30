import Link from "next/link";
import { and, eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import {
  getCourseCurriculum,
  type CurriculumView,
} from "@/lib/courses/curriculum";
import { db } from "@/lib/db/client";
import { courseSubtopicProgress } from "@/lib/db/schema";

import {
  addCourseSubtopicAction,
  addCourseTopicAction,
  bulkUpdateCourseSubtopicsAction,
  moveCourseSubtopicAction,
  moveCourseTopicAction,
  publishCourseCurriculumAction,
  setCourseSubtopicHiddenAction,
  setCourseTopicHiddenAction,
  updateCourseSubtopicAction,
  updateCourseTopicAction,
} from "./curriculum-actions";
import { setCourseProgressAction } from "./progress-actions";

export async function CurriculumPanel({
  coursePageId,
  courseSlug,
  canEdit,
  canTrack = false,
  preview,
}: {
  coursePageId: string;
  courseSlug: string;
  canEdit: boolean;
  canTrack?: boolean;
  preview?: string;
}) {
  const view: CurriculumView =
    canEdit && preview !== "published" ? "draft" : "published";
  const curriculum = await getCourseCurriculum(coursePageId, view);
  const studentId = canTrack ? await currentStudentId() : null;
  const progressRows =
    studentId && curriculum
      ? await db
          .select({
            stableId: courseSubtopicProgress.courseSubtopicStableId,
            state: courseSubtopicProgress.state,
          })
          .from(courseSubtopicProgress)
          .where(
            and(
              eq(courseSubtopicProgress.coursePageId, coursePageId),
              eq(courseSubtopicProgress.studentId, studentId),
            ),
          )
      : [];
  const progressByStableId = new Map(
    progressRows.map((row) => [row.stableId, row.state]),
  );

  if (!curriculum) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-10 text-center dark:border-zinc-700 dark:bg-zinc-900/60">
        <h2 className="text-xl font-semibold">
          {view === "published"
            ? "No published curriculum yet"
            : "No editable draft found"}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {view === "published" && canEdit
            ? "Return to the draft, review it, and publish when it is ready."
            : "The course owner has not published a curriculum snapshot."}
        </p>
        {canEdit && view === "published" ? (
          <Link
            href={`/courses/${courseSlug}?tab=curriculum`}
            className="mt-5 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Return to draft
          </Link>
        ) : null}
      </section>
    );
  }

  const editable = canEdit && view === "draft";
  const visibleTopics = editable
    ? curriculum.topics
    : curriculum.topics.filter((topic) => topic.hiddenAt === null);
  const bulkFormId = `bulk-${curriculum.version.id}`;

  return (
    <div className="space-y-5">
      <section className="sticky top-0 z-10 rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">
                {editable ? "Editable draft" : "Published curriculum"} v
                {curriculum.version.version}
              </h2>
              {editable ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Draft
                </span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Public snapshot
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {editable
                ? "Changes save immediately to this draft."
                : "Hidden course content is omitted from this view."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? (
              <Link
                href={`/courses/${courseSlug}?tab=curriculum${
                  view === "draft" ? "&preview=published" : ""
                }`}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {view === "draft" ? "Preview published" : "Back to draft"}
              </Link>
            ) : null}
            {editable ? (
              <form action={publishCourseCurriculumAction}>
                <CourseIdentity
                  coursePageId={coursePageId}
                  courseSlug={courseSlug}
                />
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Publish draft
                </button>
              </form>
            ) : null}
          </div>
        </div>

        {editable ? (
          <form
            id={bulkFormId}
            action={bulkUpdateCourseSubtopicsAction}
            className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"
          >
            <CourseIdentity
              coursePageId={coursePageId}
              courseSlug={courseSlug}
            />
            <label className="text-xs font-medium" htmlFor="bulk-operation">
              Selected subtopics
            </label>
            <select
              id="bulk-operation"
              name="operation"
              defaultValue="covered"
              className={smallInputClass}
            >
              <option value="covered">Mark covered</option>
              <option value="not_covered">Mark not covered</option>
              <option value="unknown">Mark unknown</option>
              <option value="hide">Hide</option>
              <option value="restore">Restore</option>
            </select>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Apply
            </button>
          </form>
        ) : null}
      </section>

      <ol className="space-y-4">
        {visibleTopics.map((topic, topicIndex) => {
          const subtopics = editable
            ? topic.subtopics
            : topic.subtopics.filter((subtopic) => subtopic.hiddenAt === null);
          return (
            <li key={topic.id}>
              <details
                open={topicIndex < 2}
                className={`group rounded-2xl border bg-white shadow-sm dark:bg-zinc-900 ${
                  topic.hiddenAt
                    ? "border-dashed border-zinc-300 opacity-70 dark:border-zinc-700"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <summary className="cursor-pointer list-none px-5 py-4 marker:hidden">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        Topic {topicIndex + 1}
                      </p>
                      <h3
                        className={`mt-1 font-semibold ${
                          topic.hiddenAt ? "line-through" : ""
                        }`}
                      >
                        {topic.name}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        {subtopics.length} subtopics ·{" "}
                        {topic.provenance === "template"
                          ? "cloned from template"
                          : "course-local"}
                      </p>
                    </div>
                    <span
                      aria-hidden
                      className="mt-2 text-zinc-400 transition group-open:rotate-180"
                    >
                      ⌄
                    </span>
                  </div>
                </summary>

                <div className="border-t border-zinc-200 px-4 py-5 dark:border-zinc-800 sm:px-5">
                  {editable ? (
                    <TopicEditor
                      topic={topic}
                      coursePageId={coursePageId}
                      courseSlug={courseSlug}
                    />
                  ) : topic.description ? (
                    <p className="mb-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                      {topic.description}
                    </p>
                  ) : null}

                  <ul className="space-y-2">
                    {subtopics.map((subtopic, subtopicIndex) => (
                      <li
                        key={subtopic.id}
                        className={`flex items-start gap-3 rounded-xl border p-3 ${
                          subtopic.hiddenAt
                            ? "border-dashed border-zinc-300 opacity-70 dark:border-zinc-700"
                            : "border-zinc-200 dark:border-zinc-800"
                        }`}
                      >
                        {editable ? (
                          <input
                            type="checkbox"
                            name="subtopicIds"
                            value={subtopic.id}
                            form={bulkFormId}
                            aria-label={`Select ${subtopic.name}`}
                            className="mt-1.5 accent-indigo-600"
                          />
                        ) : null}
                        <details className="min-w-0 flex-1">
                          <summary className="cursor-pointer list-none">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="mr-2 text-xs text-zinc-400">
                                  {subtopicIndex + 1}.
                                </span>
                                <span
                                  className={`text-sm font-medium ${
                                    subtopic.hiddenAt ? "line-through" : ""
                                  }`}
                                >
                                  {subtopic.name}
                                </span>
                              </div>
                              <span className="flex flex-wrap gap-1.5 text-[11px]">
                                <CoverageBadge value={subtopic.coverage} />
                                <span className="rounded-full bg-zinc-100 px-2 py-0.5 capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                  {subtopic.depthLevel}
                                </span>
                                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                  {subtopic.provenance === "template"
                                    ? "Template"
                                    : "Local"}
                                </span>
                              </span>
                            </div>
                          </summary>

                          <div className="pt-4">
                            {editable ? (
                              <SubtopicEditor
                                subtopic={subtopic}
                                coursePageId={coursePageId}
                                courseSlug={courseSlug}
                              />
                            ) : (
                              <>
                                <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                                  {subtopic.description ||
                                    "No description provided."}
                                </p>
                                {canTrack ? (
                                  <form
                                    action={setCourseProgressAction}
                                    className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4"
                                  >
                                    <input type="hidden" name="coursePageId" value={coursePageId} />
                                    <input type="hidden" name="courseSlug" value={courseSlug} />
                                    <input type="hidden" name="subtopicStableId" value={subtopic.stableId} />
                                    <label className="text-xs font-semibold">
                                      My private progress
                                      <select
                                        name="state"
                                        defaultValue={progressByStableId.get(subtopic.stableId) ?? "not_started"}
                                        className="mt-1 min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm"
                                      >
                                        <option value="not_started">Not started</option>
                                        <option value="learning">Learning</option>
                                        <option value="completed">Completed</option>
                                        <option value="saved">Saved</option>
                                      </select>
                                    </label>
                                    <button className="min-h-11 rounded-xl border border-slate-300 px-3 text-xs font-semibold">
                                      Save
                                    </button>
                                  </form>
                                ) : null}
                              </>
                            )}
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>

                  {subtopics.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
                      No visible subtopics.
                    </p>
                  ) : null}

                  {editable ? (
                    <AddSubtopicForm
                      topicId={topic.id}
                      coursePageId={coursePageId}
                      courseSlug={courseSlug}
                    />
                  ) : null}
                </div>
              </details>
            </li>
          );
        })}
      </ol>

      {visibleTopics.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No visible topics in this curriculum.
        </p>
      ) : null}

      {editable ? (
        <form
          action={addCourseTopicAction}
          className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-5 dark:border-zinc-700 dark:bg-zinc-900/60"
        >
          <CourseIdentity
            coursePageId={coursePageId}
            courseSlug={courseSlug}
          />
          <h3 className="font-semibold">Add a course-local topic</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
            <input
              name="name"
              required
              maxLength={180}
              placeholder="Topic name"
              aria-label="New topic name"
              className={smallInputClass}
            />
            <input
              name="description"
              maxLength={2000}
              placeholder="Optional description"
              aria-label="New topic description"
              className={smallInputClass}
            />
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Add topic
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function TopicEditor({
  topic,
  coursePageId,
  courseSlug,
}: {
  topic: NonNullable<
    Awaited<ReturnType<typeof getCourseCurriculum>>
  >["topics"][number];
  coursePageId: string;
  courseSlug: string;
}) {
  return (
    <div className="mb-5 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950">
      <form
        action={updateCourseTopicAction}
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
      >
        <CourseIdentity
          coursePageId={coursePageId}
          courseSlug={courseSlug}
        />
        <input type="hidden" name="topicId" value={topic.id} />
        <input
          name="name"
          defaultValue={topic.name}
          required
          maxLength={180}
          aria-label={`Rename ${topic.name}`}
          className={smallInputClass}
        />
        <input
          name="description"
          defaultValue={topic.description ?? ""}
          maxLength={2000}
          placeholder="Topic description"
          aria-label={`Description for ${topic.name}`}
          className={smallInputClass}
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Save
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        <MoveForm
          kind="topic"
          id={topic.id}
          coursePageId={coursePageId}
          courseSlug={courseSlug}
        />
        <form action={setCourseTopicHiddenAction}>
          <CourseIdentity
            coursePageId={coursePageId}
            courseSlug={courseSlug}
          />
          <input type="hidden" name="topicId" value={topic.id} />
          <input
            type="hidden"
            name="hidden"
            value={topic.hiddenAt ? "no" : "yes"}
          />
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {topic.hiddenAt ? "Restore topic" : "Hide topic"}
          </button>
        </form>
      </div>
    </div>
  );
}

function SubtopicEditor({
  subtopic,
  coursePageId,
  courseSlug,
}: {
  subtopic: NonNullable<
    Awaited<ReturnType<typeof getCourseCurriculum>>
  >["topics"][number]["subtopics"][number];
  coursePageId: string;
  courseSlug: string;
}) {
  return (
    <div className="space-y-3">
      <form action={updateCourseSubtopicAction} className="grid gap-3">
        <CourseIdentity
          coursePageId={coursePageId}
          courseSlug={courseSlug}
        />
        <input type="hidden" name="subtopicId" value={subtopic.id} />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-medium">
            Name
            <input
              name="name"
              defaultValue={subtopic.name}
              required
              maxLength={220}
              className={`${smallInputClass} mt-1 w-full`}
            />
          </label>
          <label className="text-xs font-medium">
            Description
            <input
              name="description"
              defaultValue={subtopic.description ?? ""}
              maxLength={2000}
              className={`${smallInputClass} mt-1 w-full`}
            />
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-xs font-medium">
            Depth
            <select
              name="depthLevel"
              defaultValue={subtopic.depthLevel}
              className={`${smallInputClass} mt-1 w-full`}
            >
              <option value="awareness">Awareness</option>
              <option value="procedural">Procedural</option>
              <option value="fluency">Fluency</option>
              <option value="proof">Proof</option>
            </select>
          </label>
          <label className="text-xs font-medium">
            Estimated hours
            <input
              name="estHours"
              type="number"
              min={0}
              max={999}
              step={0.5}
              defaultValue={subtopic.estHours ?? ""}
              className={`${smallInputClass} mt-1 w-full`}
            />
          </label>
          <label className="text-xs font-medium">
            Coverage
            <select
              name="coverage"
              defaultValue={subtopic.coverage}
              className={`${smallInputClass} mt-1 w-full`}
            >
              <option value="unknown">Unknown</option>
              <option value="covered">Covered</option>
              <option value="not_covered">Not covered</option>
            </select>
          </label>
        </div>
        <button
          type="submit"
          className="justify-self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Save subtopic
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        <MoveForm
          kind="subtopic"
          id={subtopic.id}
          coursePageId={coursePageId}
          courseSlug={courseSlug}
        />
        <form action={setCourseSubtopicHiddenAction}>
          <CourseIdentity
            coursePageId={coursePageId}
            courseSlug={courseSlug}
          />
          <input type="hidden" name="subtopicId" value={subtopic.id} />
          <input
            type="hidden"
            name="hidden"
            value={subtopic.hiddenAt ? "no" : "yes"}
          />
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {subtopic.hiddenAt ? "Restore" : "Hide"}
          </button>
        </form>
      </div>
    </div>
  );
}

function MoveForm({
  kind,
  id,
  coursePageId,
  courseSlug,
}: {
  kind: "topic" | "subtopic";
  id: string;
  coursePageId: string;
  courseSlug: string;
}) {
  const action =
    kind === "topic" ? moveCourseTopicAction : moveCourseSubtopicAction;
  const fieldName = kind === "topic" ? "topicId" : "subtopicId";
  return (
    <form action={action} className="flex gap-1">
      <CourseIdentity
        coursePageId={coursePageId}
        courseSlug={courseSlug}
      />
      <input type="hidden" name={fieldName} value={id} />
      <button
        type="submit"
        name="direction"
        value="up"
        aria-label={`Move ${kind} up`}
        className={iconButtonClass}
      >
        ↑
      </button>
      <button
        type="submit"
        name="direction"
        value="down"
        aria-label={`Move ${kind} down`}
        className={iconButtonClass}
      >
        ↓
      </button>
    </form>
  );
}

function AddSubtopicForm({
  topicId,
  coursePageId,
  courseSlug,
}: {
  topicId: string;
  coursePageId: string;
  courseSlug: string;
}) {
  return (
    <form
      action={addCourseSubtopicAction}
      className="mt-4 grid gap-2 rounded-xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700 sm:grid-cols-2"
    >
      <CourseIdentity
        coursePageId={coursePageId}
        courseSlug={courseSlug}
      />
      <input type="hidden" name="topicId" value={topicId} />
      <input
        name="name"
        required
        maxLength={220}
        placeholder="New subtopic"
        aria-label="New subtopic name"
        className={smallInputClass}
      />
      <input
        name="description"
        maxLength={2000}
        placeholder="Optional description"
        aria-label="New subtopic description"
        className={smallInputClass}
      />
      <select
        name="depthLevel"
        defaultValue="procedural"
        aria-label="New subtopic depth"
        className={smallInputClass}
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
          aria-label="Estimated hours"
          className={`${smallInputClass} min-w-0 flex-1`}
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add
        </button>
      </div>
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

function CoverageBadge({
  value,
}: {
  value: "unknown" | "covered" | "not_covered";
}) {
  const style =
    value === "covered"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : value === "not_covered"
        ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={`rounded-full px-2 py-0.5 ${style}`}>
      {value.replace("_", " ")}
    </span>
  );
}

const smallInputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900";
const iconButtonClass =
  "rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";
