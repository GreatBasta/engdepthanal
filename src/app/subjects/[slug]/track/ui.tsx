"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";

import {
  markSubjectFinished,
  reopenSubject,
  setSubtopicState,
} from "./actions";

type ProgressState = "not_started" | "in_progress" | "done";

export interface TrackSubtopic {
  id: string;
  name: string;
  depthLevel: "awareness" | "procedural" | "fluency" | "proof";
  state: ProgressState;
}

export interface TrackTopic {
  id: string;
  name: string;
  position: number;
  subtopics: TrackSubtopic[];
}

// Click cycles forward through the three states.
const NEXT_STATE: Record<ProgressState, ProgressState> = {
  not_started: "in_progress",
  in_progress: "done",
  done: "not_started",
};

const STATE_LABEL: Record<ProgressState, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

const STATE_CLASS: Record<ProgressState, string> = {
  not_started:
    "border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400",
  in_progress:
    "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-300",
  done: "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
};

export function TrackUI({
  subjectSlug,
  topics,
  finished,
}: {
  subjectSlug: string;
  topics: TrackTopic[];
  finished: boolean;
}) {
  const initial = useMemo(() => {
    const map: Record<string, ProgressState> = {};
    for (const topic of topics) {
      for (const sub of topic.subtopics) map[sub.id] = sub.state;
    }
    return map;
  }, [topics]);

  const [states, setOptimistic] = useOptimistic(
    initial,
    (prev, update: { id: string; state: ProgressState }) => ({
      ...prev,
      [update.id]: update.state,
    }),
  );
  const [, startTransition] = useTransition();

  const total = Object.keys(initial).length;
  const doneCount = Object.values(states).filter((s) => s === "done").length;
  const inProgressCount = Object.values(states).filter(
    (s) => s === "in_progress",
  ).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  function cycle(id: string, current: ProgressState) {
    if (finished) return;
    const next = NEXT_STATE[current];
    startTransition(async () => {
      setOptimistic({ id, state: next });
      await setSubtopicState({ subjectSlug, subtopicId: id, state: next });
    });
  }

  return (
    <div className="mt-6">
      <ProgressHeader
        pct={pct}
        doneCount={doneCount}
        inProgressCount={inProgressCount}
        total={total}
        finished={finished}
        subjectSlug={subjectSlug}
      />

      <ol className="mt-8 space-y-8">
        {topics.map((topic) => (
          <li key={topic.id}>
            <h2 className="text-lg font-semibold">
              {topic.position}. {topic.name}
            </h2>
            <ul className="mt-3 space-y-px border-l-2 border-zinc-200 dark:border-zinc-800">
              {topic.subtopics.map((sub) => {
                const state = states[sub.id] ?? "not_started";
                return (
                  <li
                    key={sub.id}
                    className="flex items-center justify-between gap-4 py-2 pl-4"
                  >
                    <span className="text-sm">{sub.name}</span>
                    <button
                      type="button"
                      onClick={() => cycle(sub.id, state)}
                      disabled={finished}
                      aria-label={`${sub.name}: ${STATE_LABEL[state]}. Click to change.`}
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${STATE_CLASS[state]}`}
                    >
                      {STATE_LABEL[state]}
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ProgressHeader({
  pct,
  doneCount,
  inProgressCount,
  total,
  finished,
  subjectSlug,
}: {
  pct: number;
  doneCount: number;
  inProgressCount: number;
  total: number;
  finished: boolean;
  subjectSlug: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>, after?: () => void) {
    startTransition(async () => {
      await action();
      after?.();
    });
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {doneCount} of {total} done
          {inProgressCount > 0 && ` · ${inProgressCount} in progress`}
        </span>
        <span className="text-zinc-500">{pct}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {finished ? (
        <div className="mt-4 rounded-lg bg-emerald-50 p-4 dark:bg-emerald-950/40">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            ✓ You&apos;ve marked this subject finished.
          </p>
          <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
            Next: the coverage survey — record what your university actually
            taught, so it feeds the gap analysis for your course.
          </p>
          <a
            href={`/subjects/${subjectSlug}/survey`}
            className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Start the coverage survey →
          </a>
          <div>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => reopenSubject(subjectSlug))}
              className="mt-3 text-xs text-emerald-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-emerald-400"
            >
              Reopen (marked finished by mistake)
            </button>
          </div>
        </div>
      ) : confirming ? (
        <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm">
            Mark <strong>this subject finished</strong>? Do this once you&apos;ve
            passed it — it unlocks the coverage survey.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => markSubjectFinished(subjectSlug),
                  () => setConfirming(false),
                )
              }
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Yes, mark finished
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 w-full rounded-lg border border-emerald-600 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
        >
          I&apos;ve finished this subject
        </button>
      )}
    </div>
  );
}
