"use client";

import { useActionState } from "react";

import {
  createExamQuestionAction,
  type ExamQuestionFormState,
} from "./exam-actions";

const initialState: ExamQuestionFormState = {
  error: null,
  message: null,
  suggestions: [],
};

export function ExamQuestionForm({
  coursePageId,
  courseSlug,
  topics,
  subtopics,
}: {
  coursePageId: string;
  courseSlug: string;
  topics: Array<{ stableId: string; name: string }>;
  subtopics: Array<{ stableId: string; name: string; topicName: string }>;
}) {
  const [state, action, pending] = useActionState(
    createExamQuestionAction,
    initialState,
  );

  return (
    <form
      action={action}
      className="mt-6 grid gap-2 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-950"
    >
      <input type="hidden" name="coursePageId" value={coursePageId} />
      <input type="hidden" name="courseSlug" value={courseSlug} />
      <textarea
        name="prompt"
        required
        maxLength={10_000}
        rows={3}
        placeholder="Exam question or recurring prompt"
        aria-label="Question prompt"
        className={inputClass}
      />
      <textarea
        name="answerGuidance"
        maxLength={10_000}
        rows={2}
        placeholder="Answer guidance (optional)"
        aria-label="Answer guidance"
        className={inputClass}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium">
          Question type
          <select name="questionType" defaultValue="" className={`${inputClass} mt-1`}>
            <option value="">Unknown</option>
            <option value="calculation">Calculation</option>
            <option value="conceptual">Conceptual</option>
            <option value="proof">Proof or derivation</option>
            <option value="oral_prompt">Oral prompt</option>
            <option value="practical">Practical</option>
            <option value="project">Project</option>
          </select>
        </label>
        <label className="text-xs font-medium">
          Difficulty
          <select name="difficulty" defaultValue="" className={`${inputClass} mt-1`}>
            <option value="">Unknown</option>
            <option value="1">1 · Easy</option>
            <option value="2">2</option>
            <option value="3">3 · Medium</option>
            <option value="4">4</option>
            <option value="5">5 · Hard</option>
          </select>
        </label>
      </div>
      <label className="text-xs font-medium">
        Curriculum context
        <select name="contextTarget" defaultValue="course" className={`${inputClass} mt-1`}>
          <option value="course">Whole course</option>
          <optgroup label="Topics">
            {topics.map((topic) => (
              <option key={topic.stableId} value={`topic:${topic.stableId}`}>
                {topic.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Subtopics">
            {subtopics.map((subtopic) => (
              <option
                key={subtopic.stableId}
                value={`subtopic:${subtopic.stableId}`}
              >
                {subtopic.topicName} · {subtopic.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      {state.suggestions.length ? (
        <section
          aria-live="polite"
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
        >
          <h3 className="font-semibold">Possible duplicates</h3>
          <ul className="mt-2 space-y-2">
            {state.suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <a
                  href={`#question-${suggestion.id}`}
                  className="underline underline-offset-2"
                >
                  {suggestion.prompt}
                </a>
                <span className="ml-2 text-xs text-amber-700">
                  {Math.round(suggestion.similarity * 100)}% similar
                </span>
              </li>
            ))}
          </ul>
          <label className="mt-3 flex min-h-11 items-center gap-2 font-medium">
            <input type="checkbox" name="duplicateOverride" value="yes" />
            This is a distinct question; create it anyway.
          </label>
        </section>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p aria-live="polite" className="text-sm text-emerald-700">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 justify-self-start rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending
          ? "Checking…"
          : state.suggestions.length
            ? "Review and add"
            : "Check and add question"}
      </button>
    </form>
  );
}

const inputClass =
  "min-h-11 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
  "dark:border-zinc-700 dark:bg-zinc-900";
