"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  createCourseAction,
  type CreateCourseState,
} from "./actions";

interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  version: number;
  year: number;
}

interface UniversityProgramOption {
  id: string;
  universityName: string;
  countryCode: string;
  programName: string;
  localName: string | null;
}

const initialState: CreateCourseState = { error: null, duplicates: [] };

export function CreateCourseForm({
  templates,
  universityPrograms,
  defaultUniversityProgramId,
  defaultCohortYear,
  defaultAcademicYear,
  defaultAttendance,
}: {
  templates: TemplateOption[];
  universityPrograms: UniversityProgramOption[];
  defaultUniversityProgramId: string;
  defaultCohortYear: number;
  defaultAcademicYear: string;
  defaultAttendance: "attended" | "not_attended";
}) {
  const [state, action, pending] = useActionState(
    createCourseAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
        <h2 className="text-lg font-semibold">Course identity</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="University and degree program" wide>
            <select
              name="universityProgramId"
              defaultValue={defaultUniversityProgramId}
              required
              className={inputClass}
            >
              {universityPrograms.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.universityName} ·{" "}
                  {option.localName || option.programName} (
                  {option.countryCode})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Local course name">
            <input
              name="localName"
              required
              maxLength={180}
              placeholder="e.g. Mathematical Analysis I"
              className={inputClass}
            />
          </Field>
          <Field label="Course code">
            <input
              name="courseCode"
              maxLength={40}
              placeholder="e.g. MAT101"
              className={inputClass}
            />
          </Field>
          <Field label="Professor">
            <input
              name="professorName"
              maxLength={120}
              placeholder="Optional"
              className={inputClass}
            />
          </Field>
          <Field label="Academic year">
            <input
              name="academicYear"
              required
              defaultValue={defaultAcademicYear}
              placeholder="2026/27"
              className={inputClass}
            />
          </Field>
          <Field label="Cohort year">
            <input
              name="cohortYear"
              type="number"
              min={2000}
              max={2100}
              defaultValue={defaultCohortYear}
              className={inputClass}
            />
          </Field>
          <Field label="Semester">
            <input
              name="semester"
              type="number"
              min={1}
              max={12}
              placeholder="1"
              className={inputClass}
            />
          </Field>
          <Field label="Your attendance">
            <select
              name="attendance"
              defaultValue={defaultAttendance}
              className={inputClass}
            >
              <option value="attended">I attended this course</option>
              <option value="not_attended">I have not attended it</option>
            </select>
          </Field>
          <Field label="Description" wide>
            <textarea
              name="description"
              rows={4}
              maxLength={2000}
              placeholder="What makes this local course distinct?"
              className={inputClass}
            />
          </Field>
          <Field label="Visibility" wide>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  value: "public",
                  title: "Public",
                  detail: "Listed in search and visible to everyone.",
                },
                {
                  value: "unlisted",
                  title: "Unlisted",
                  detail: "Visible by link, omitted from search.",
                },
                {
                  value: "private",
                  title: "Private",
                  detail: "Only members can open it.",
                },
              ].map((visibility) => (
                <label
                  key={visibility.value}
                  className="cursor-pointer rounded-xl border border-zinc-200 p-3 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:border-zinc-700 dark:has-[:checked]:bg-indigo-950/40"
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={visibility.value}
                    defaultChecked={visibility.value === "private"}
                    className="mr-2 accent-indigo-600"
                  />
                  <span className="font-medium">{visibility.title}</span>
                  <span className="mt-1 block text-xs text-zinc-500">
                    {visibility.detail}
                  </span>
                </label>
              ))}
            </div>
          </Field>
        </div>
      </section>

      <fieldset className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
        <legend className="px-1 text-lg font-semibold">
          Curriculum templates
        </legend>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Select every macro-subject this university course covers.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {templates.map((template, index) => (
            <label
              key={template.id}
              className="cursor-pointer rounded-xl border border-zinc-200 p-4 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:border-zinc-700 dark:has-[:checked]:bg-indigo-950/40"
            >
              <span className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="templateIds"
                  value={template.id}
                  defaultChecked={index === 0}
                  className="mt-1 accent-indigo-600"
                />
                <span>
                  <span className="font-semibold">{template.name}</span>
                  <span className="ml-2 text-xs text-zinc-500">
                    v{template.version}
                  </span>
                  {template.description ? (
                    <span className="mt-1 line-clamp-2 block text-sm text-zinc-600 dark:text-zinc-400">
                      {template.description}
                    </span>
                  ) : null}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {state.duplicates.length > 0 ? (
        <section
          aria-live="polite"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <h2 className="font-semibold">This course may already exist</h2>
          <p className="mt-1 text-sm">
            Review the likely matches before creating another page.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {state.duplicates.map((duplicate) => (
              <li key={duplicate.slug}>
                <Link
                  href={`/courses/${duplicate.slug}`}
                  target="_blank"
                  className="font-medium underline"
                >
                  {duplicate.localName}
                  {duplicate.courseCode ? ` · ${duplicate.courseCode}` : ""}
                </Link>{" "}
                · {duplicate.academicYear}
                {duplicate.semester ? ` · semester ${duplicate.semester}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs">
            If this is genuinely a different course, you can create it anyway.
          </p>
        </section>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Cancel
        </Link>
        <SubmitButton
          confirmDuplicate={state.duplicates.length > 0}
          pending={pending}
        />
      </div>
    </form>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : undefined}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function SubmitButton({
  confirmDuplicate,
  pending,
}: {
  confirmDuplicate: boolean;
  pending: boolean;
}) {
  return (
    <button
      type="submit"
      name={confirmDuplicate ? "confirmDuplicate" : undefined}
      value={confirmDuplicate ? "yes" : undefined}
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-60"
    >
      {pending
        ? "Creating snapshot…"
        : confirmDuplicate
          ? "Create different course"
          : "Create editable course"}
    </button>
  );
}

const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950";
