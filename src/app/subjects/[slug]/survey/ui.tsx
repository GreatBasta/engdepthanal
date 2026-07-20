"use client";

import { useMemo, useState, useTransition } from "react";

import { saveGrade, saveTopicAnswers } from "./actions";

type CoverageAnswer = "yes_depth" | "yes_brief" | "no" | "unsure";

const ANSWER_OPTIONS: { value: CoverageAnswer; label: string; hint: string }[] =
  [
    { value: "yes_depth", label: "Yes, in depth", hint: "taught and examined" },
    { value: "yes_brief", label: "Yes, briefly", hint: "mentioned or skimmed" },
    { value: "no", label: "No", hint: "never covered" },
    { value: "unsure", label: "Don't remember", hint: "" },
  ];

// ---------------------------------------------------------------------------
// Progress rail
// ---------------------------------------------------------------------------

export function SurveyProgress({
  current,
  total,
  labels,
}: {
  current: number;
  total: number;
  labels: string[];
}) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          Step {current + 1} of {total}
        </span>
        <span>{labels[current] === "Grade" ? "Your grade" : `Topic ${labels[current]}`}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-zinc-900 transition-all dark:bg-zinc-100"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grade
// ---------------------------------------------------------------------------

type ScaleOption =
  | {
      id: string;
      label: string;
      kind: "numeric";
      min: number;
      max: number;
      step: number;
    }
  | { id: string; label: string; kind: "letter"; options: string[] };

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-zinc-500 " +
  "dark:border-zinc-700 dark:bg-zinc-900";

export function GradeForm({
  subjectSlug,
  nextHref,
  scales,
  existingScale,
  existingValue,
}: {
  subjectSlug: string;
  nextHref: string;
  scales: ScaleOption[];
  existingScale: string | null;
  existingValue: string | null;
}) {
  const [scaleId, setScaleId] = useState(existingScale ?? scales[0].id);
  const [value, setValue] = useState(existingValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const scale = useMemo(
    () => scales.find((s) => s.id === scaleId) ?? scales[0],
    [scales, scaleId],
  );

  function submit() {
    setError(null);
    if (!value) {
      setError("Please enter your grade.");
      return;
    }
    startTransition(async () => {
      try {
        await saveGrade({ subjectSlug, scale: scaleId, rawValue: value, nextHref });
      } catch (e) {
        // redirect() throws NEXT_REDIRECT — let it propagate.
        if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT"))
          throw e;
        setError("That grade doesn't look valid for the chosen scale.");
      }
    });
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold">What was your final grade?</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Only you ever see your grade. It&apos;s normalized and used only in
        aggregate, once enough students have responded.
      </p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Grading scale</span>
          <select
            value={scaleId}
            onChange={(e) => {
              setScaleId(e.target.value);
              setValue("");
            }}
            className={inputClass}
          >
            {scales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Your grade</span>
          {scale.kind === "letter" ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={inputClass}
            >
              <option value="">Pick…</option>
              {scale.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              inputMode="decimal"
              min={scale.min}
              max={scale.max}
              step={scale.step}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`${scale.min}–${scale.max}`}
              className={inputClass}
            />
          )}
        </label>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Saving…" : "Continue to the questions →"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Topic coverage questions
// ---------------------------------------------------------------------------

export function TopicForm({
  subjectSlug,
  topicId,
  topicName,
  subtopics,
  nextHref,
  backHref,
  isLastTopic,
}: {
  subjectSlug: string;
  topicId: string;
  topicName: string;
  subtopics: {
    id: string;
    name: string;
    description: string | null;
    depthLevel: string;
    answer: CoverageAnswer | null;
  }[];
  nextHref: string;
  backHref: string;
  isLastTopic: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, CoverageAnswer>>(() => {
    const init: Record<string, CoverageAnswer> = {};
    for (const s of subtopics) if (s.answer) init[s.id] = s.answer;
    return init;
  });
  const [suggestion, setSuggestion] = useState("");
  const [pending, startTransition] = useTransition();

  const answeredCount = Object.keys(answers).length;

  function submit() {
    startTransition(async () => {
      await saveTopicAnswers({
        subjectSlug,
        topicId,
        answers,
        suggestion: suggestion.trim() || undefined,
        nextHref,
      });
    });
  }

  return (
    <div className="mt-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">{topicName}</h2>
        <span className="shrink-0 text-xs text-zinc-500">
          {answeredCount}/{subtopics.length} answered
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        For each, tell us how much your course actually covered it. You can
        leave any blank and come back later.
      </p>

      <ul className="mt-6 space-y-5">
        {subtopics.map((sub) => (
          <li
            key={sub.id}
            className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <p className="text-sm font-medium">
              Have you studied: {sub.name}?
            </p>
            {sub.description && (
              <p className="mt-0.5 text-xs text-zinc-500">{sub.description}</p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ANSWER_OPTIONS.map((opt) => {
                const selected = answers[sub.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [sub.id]: opt.value }))
                    }
                    className={`rounded-lg border px-2 py-2 text-left text-xs transition ${
                      selected
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-300 hover:border-zinc-500 dark:border-zinc-700"
                    }`}
                  >
                    <span className="block font-medium">{opt.label}</span>
                    {opt.hint && (
                      <span
                        className={`block ${selected ? "opacity-80" : "text-zinc-500"}`}
                      >
                        {opt.hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      <label className="mt-6 block">
        <span className="mb-1 block text-sm font-medium">
          Anything your course covered here that isn&apos;t listed?{" "}
          <span className="font-normal text-zinc-500">(optional)</span>
        </span>
        <textarea
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
          rows={2}
          className={inputClass}
          placeholder="e.g. we spent a lot of time on…"
        />
      </label>

      <div className="mt-6 flex items-center justify-between gap-3">
        <a
          href={backHref}
          className="text-sm text-zinc-500 underline-offset-2 hover:underline"
        >
          ← Back
        </a>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending
            ? "Saving…"
            : isLastTopic
              ? "Save & finish"
              : "Save & next topic →"}
        </button>
      </div>
    </div>
  );
}
