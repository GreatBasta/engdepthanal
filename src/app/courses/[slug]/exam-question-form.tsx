"use client";

import { useActionState } from "react";
import { useI18n } from "@/components/locale-provider";

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
  const { t } = useI18n();
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
        placeholder={t("exam.questionPlaceholder")}
        aria-label={t("exam.questionPrompt")}
        className={inputClass}
      />
      <textarea
        name="answerGuidance"
        maxLength={10_000}
        rows={2}
        placeholder={t("exam.answerPlaceholder")}
        aria-label={t("exam.answerGuidance")}
        className={inputClass}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium">
          {t("exam.questionType")}
          <select
            name="questionType"
            defaultValue=""
            className={`${inputClass} mt-1`}
          >
            <option value="">{t("common.unknown")}</option>
            <option value="calculation">{t("exam.calculation")}</option>
            <option value="conceptual">{t("exam.conceptual")}</option>
            <option value="proof">{t("exam.proofDerivation")}</option>
            <option value="oral_prompt">{t("exam.oralPrompt")}</option>
            <option value="practical">{t("exam.practical")}</option>
            <option value="project">{t("exam.project")}</option>
          </select>
        </label>
        <label className="text-xs font-medium">
          {t("exam.difficulty")}
          <select
            name="difficulty"
            defaultValue=""
            className={`${inputClass} mt-1`}
          >
            <option value="">{t("common.unknown")}</option>
            <option value="1">1 · {t("exam.easy")}</option>
            <option value="2">2</option>
            <option value="3">3 · {t("exam.medium")}</option>
            <option value="4">4</option>
            <option value="5">5 · {t("exam.hard")}</option>
          </select>
        </label>
      </div>
      <label className="text-xs font-medium">
        {t("exam.curriculumContext")}
        <select
          name="contextTarget"
          defaultValue="course"
          className={`${inputClass} mt-1`}
        >
          <option value="course">{t("resources.wholeCourse")}</option>
          <optgroup label={t("resources.topics")}>
            {topics.map((topic) => (
              <option key={topic.stableId} value={`topic:${topic.stableId}`}>
                {topic.name}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("resources.subtopics")}>
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
          <h3 className="font-semibold">{t("exam.possibleDuplicates")}</h3>
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
                  {t("exam.similar", {
                    value: Math.round(suggestion.similarity * 100),
                  })}
                </span>
              </li>
            ))}
          </ul>
          <label className="mt-3 flex min-h-11 items-center gap-2 font-medium">
            <input type="checkbox" name="duplicateOverride" value="yes" />
            {t("exam.distinctOverride")}
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
          ? t("exam.checking")
          : state.suggestions.length
            ? t("exam.reviewAdd")
            : t("exam.checkAdd")}
      </button>
    </form>
  );
}

const inputClass =
  "min-h-11 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
  "dark:border-zinc-700 dark:bg-zinc-900";
