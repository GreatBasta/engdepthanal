"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { createCourseAction, type CreateCourseState } from "./actions";

interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  version: number;
  year: number;
  category: string;
  disciplineTags: string[];
  topicCount: number;
  subtopicCount: number;
}

interface UniversityProgramOption {
  id: string;
  universityName: string;
  countryCode: string;
  programName: string;
  localName: string | null;
}

const initialState: CreateCourseState = { error: null, duplicates: [] };
const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-indigo-500";

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
  const [state, action, pending] = useActionState(createCourseAction, initialState);
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const filtered = useMemo(
    () =>
      templates.filter(
        (template) =>
          (category === "all" || template.category === category) &&
          `${template.name} ${template.description ?? ""} ${template.disciplineTags.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [templates, query, category],
  );
  const categories = Array.from(new Set(templates.map((item) => item.category)));

  return (
    <form action={action} className="space-y-6">
      <ol aria-label="Course creation progress" className="grid grid-cols-3 gap-2">
        {["Course", "Templates", "Privacy"].map((label, index) => (
          <li
            key={label}
            aria-current={step === index + 1 ? "step" : undefined}
            className={`rounded-xl px-3 py-2 text-center text-xs font-semibold ${
              step === index + 1 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
            }`}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      <section className={step === 1 ? "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" : "hidden"}>
        <p className="text-sm font-semibold text-indigo-700">Step 1 of 3</p>
        <h2 className="mt-1 text-xl font-bold">Which real course is this?</h2>
        <div className="mt-5 grid gap-5">
          <label className="text-sm font-semibold">
            University and degree
            <select name="universityProgramId" defaultValue={defaultUniversityProgramId} required className={`${inputClass} mt-1`}>
              {universityPrograms.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.universityName} · {option.localName || option.programName} ({option.countryCode})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Local course name
            <input name="localName" required minLength={2} maxLength={180} placeholder="e.g. Mathematical Analysis I" className={`${inputClass} mt-1`} />
          </label>
        </div>
        <input type="hidden" name="academicYear" value={defaultAcademicYear} />
        <input type="hidden" name="cohortYear" value={defaultCohortYear} />
        <input type="hidden" name="attendance" value={defaultAttendance} />
      </section>

      <fieldset className={step === 2 ? "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" : "hidden"}>
        <legend className="px-1 text-xl font-bold">Step 2 · Choose curriculum templates</legend>
        <p className="mt-1 text-sm text-slate-600">
          Pick one or more immutable foundations. The course receives an editable local snapshot.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_14rem]">
          <label className="sr-only" htmlFor="template-search">Search templates</label>
          <input id="template-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates or disciplines" className={inputClass} />
          <label className="sr-only" htmlFor="template-category">Category</label>
          <select id="template-category" value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}>
            <option value="all">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item.replaceAll("-", " ")}</option>)}
          </select>
        </div>
        <div className="mt-5 grid max-h-[34rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {filtered.map((template, index) => (
            <label key={template.id} className="cursor-pointer rounded-xl border border-slate-200 p-4 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
              <span className="flex items-start gap-3">
                <input type="checkbox" name="templateIds" value={template.id} defaultChecked={index === 0 && !query && category === "all"} className="mt-1 accent-indigo-600" />
                <span>
                  <span className="font-bold">{template.name}</span>
                  <span className="ml-2 text-xs text-slate-500">v{template.version}</span>
                  <span className="mt-1 block text-xs capitalize text-indigo-700">{template.category.replaceAll("-", " ")}</span>
                  <span className="mt-2 line-clamp-2 block text-sm text-slate-600">{template.description}</span>
                  <span className="mt-2 block text-xs text-slate-500">
                    {template.topicCount} topics · {template.subtopicCount} subtopics
                  </span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className={step === 3 ? "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" : "hidden"}>
        <p className="text-sm font-semibold text-indigo-700">Step 3 of 3</p>
        <h2 className="mt-1 text-xl font-bold">Choose visibility and confirm</h2>
        <div className="mt-5 grid gap-3">
          {[
            ["private", "Private", "Only members can open the course."],
            ["unlisted", "Unlisted", "Anyone with the link can view; omitted from search."],
            ["public", "Public", "Listed in Discover and visible to everyone."],
          ].map(([value, title, detail]) => (
            <label key={value} className="flex min-h-16 cursor-pointer gap-3 rounded-xl border border-slate-200 p-4 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
              <input type="radio" name="visibility" value={value} defaultChecked={value === "private"} />
              <span>
                <span className="block font-bold">{title}</span>
                <span className="block text-sm text-slate-600">{detail}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-5 rounded-xl bg-slate-100 p-4 text-sm leading-6 text-slate-600">
          Code, professor, semester, description and cohort can be added later in course settings.
        </p>
      </section>

      {state.duplicates.length ? (
        <section role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
          <h2 className="font-bold">Likely duplicate found</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {state.duplicates.map((duplicate) => (
              <li key={duplicate.slug}>
                <Link href={`/courses/${duplicate.slug}`} target="_blank" className="font-semibold underline">
                  {duplicate.localName}
                </Link>{" "}
                · {duplicate.academicYear}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">Review these matches. You may still create a genuinely different course.</p>
        </section>
      ) : null}
      {state.error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step === 1 ? (
          <Link href="/my-courses" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold">Cancel</Link>
        ) : (
          <button type="button" onClick={() => setStep((value) => value - 1)} className="min-h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold">Back</button>
        )}
        {step < 3 ? (
          <button type="button" onClick={() => setStep((value) => value + 1)} className="min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white">Continue</button>
        ) : (
          <button
            type="submit"
            name={state.duplicates.length ? "confirmDuplicate" : undefined}
            value={state.duplicates.length ? "yes" : undefined}
            disabled={pending}
            className="min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Creating course…" : state.duplicates.length ? "Create different course" : "Create course"}
          </button>
        )}
      </div>
    </form>
  );
}
