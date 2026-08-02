"use client";

import Link from "next/link";
import {
  useActionState,
  useDeferredValue,
  useMemo,
  useState,
} from "react";

import { OrganizationCombobox } from "@/components/organization-combobox";
import { curriculumCategories } from "@/lib/curriculum/taxonomy";
import type { OrganizationResult } from "@/lib/organizations/schema";
import { createCourseAction, type CreateCourseState } from "./actions";

interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  year: number;
  category: string;
  disciplineTags: string[];
  recommendedDegreePrograms: string[];
  topicCount: number;
  subtopicCount: number;
}

interface DegreeProgramOption {
  slug: string;
  name: string;
}

const initialState: CreateCourseState = { error: null, duplicates: [] };
const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-indigo-500";

export function CreateCourseForm({
  templates,
  degreePrograms,
  defaultOrganization,
  defaultUniversityProgramId,
  defaultCohortYear,
  defaultAcademicYear,
  defaultAttendance,
  defaultProgramSlug,
}: {
  templates: TemplateOption[];
  degreePrograms: DegreeProgramOption[];
  defaultOrganization: OrganizationResult;
  defaultUniversityProgramId: string;
  defaultCohortYear: number;
  defaultAcademicYear: string;
  defaultAttendance: "attended" | "not_attended";
  defaultProgramSlug: string;
}) {
  const [state, action, pending] = useActionState(createCourseAction, initialState);
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [useDifferentOrganization, setUseDifferentOrganization] =
    useState(false);
  const deferredQuery = useDeferredValue(query);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>(
    [],
  );
  const groupedTemplates = useMemo(
    () =>
      curriculumCategories.flatMap((macroCategory) => {
        if (category !== "all" && macroCategory.key !== category) return [];
        const matches = templates
          .filter(
            (template) =>
              template.category === macroCategory.key &&
              `${template.name} ${template.description ?? ""} ${template.disciplineTags.join(" ")}`
                .toLowerCase()
                .includes(deferredQuery.toLowerCase()),
          )
          .toSorted((left, right) => {
            const leftRecommended = left.recommendedDegreePrograms.includes(
              defaultProgramSlug,
            );
            const rightRecommended = right.recommendedDegreePrograms.includes(
              defaultProgramSlug,
            );
            return (
              Number(rightRecommended) - Number(leftRecommended) ||
              left.year - right.year ||
              left.name.localeCompare(right.name)
            );
          });
        return matches.length
          ? [{ ...macroCategory, templates: matches }]
          : [];
      }),
    [templates, deferredQuery, category, defaultProgramSlug],
  );
  const resultCount = groupedTemplates.reduce(
    (total, group) => total + group.templates.length,
    0,
  );
  const defaultProgramName =
    degreePrograms.find((program) => program.slug === defaultProgramSlug)
      ?.name ?? defaultProgramSlug;

  return (
    <form action={action} className="space-y-6">
      {selectedTemplateIds.map((templateId) => (
        <input
          key={templateId}
          type="hidden"
          name="templateIds"
          value={templateId}
        />
      ))}
      <input
        type="hidden"
        name="universityProgramId"
        value={defaultUniversityProgramId}
      />
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
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              University and degree
            </p>
            <p className="mt-1 font-bold text-slate-950">
              {defaultOrganization.displayName}
            </p>
            <p className="mt-1 text-sm text-slate-600">{defaultProgramName}</p>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 text-sm font-semibold">
            <input
              type="checkbox"
              name="useDifferentOrganization"
              value="yes"
              checked={useDifferentOrganization}
              onChange={(event) =>
                setUseDifferentOrganization(event.target.checked)
              }
              className="size-5 accent-indigo-600"
            />
            Choose another university for this course
          </label>
          {useDifferentOrganization ? (
            <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
              <OrganizationCombobox
                label="Another university"
                name="organizationSelection"
                defaultOrganization={null}
              />
              <label className="block text-sm font-semibold">
                Degree program
                <select
                  name="programSlug"
                  defaultValue={defaultProgramSlug}
                  required
                  className={`${inputClass} mt-1`}
                >
                  {degreePrograms.map((program) => (
                    <option key={program.slug} value={program.slug}>
                      {program.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
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
            {curriculumCategories.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-4 text-xs font-medium text-slate-500" aria-live="polite">
          {resultCount} matching {resultCount === 1 ? "template" : "templates"} ·{" "}
          {selectedTemplateIds.length} selected
        </p>
        <div className="mt-3 max-h-[34rem] space-y-5 overflow-y-auto pr-1">
          {groupedTemplates.map((group) => (
            <section
              key={group.key}
              aria-labelledby={`category-${group.key}`}
              className="render-lazy rounded-2xl border border-slate-200 bg-slate-50/70 p-3"
            >
              <div className="px-1 pb-3">
                <h3 id={`category-${group.key}`} className="font-bold text-slate-950">
                  {group.label}
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {group.description}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.templates.map((template) => {
                  const recommended =
                    template.recommendedDegreePrograms.includes(
                      defaultProgramSlug,
                    );
                  return (
                    <label
                      key={template.id}
                      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50"
                    >
                      <span className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          value={template.id}
                          checked={selectedTemplateIds.includes(template.id)}
                          onChange={(event) =>
                            setSelectedTemplateIds((current) =>
                              event.target.checked
                                ? current.includes(template.id)
                                  ? current
                                  : [...current, template.id]
                                : current.filter((id) => id !== template.id),
                            )
                          }
                          className="mt-1 accent-indigo-600"
                        />
                        <span>
                          <span className="font-bold">{template.name}</span>
                          {recommended ? (
                            <span className="mt-1 block w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Recommended for your degree
                            </span>
                          ) : null}
                          <span className="mt-2 line-clamp-2 block text-sm text-slate-600">
                            {template.description}
                          </span>
                          <span className="mt-2 block text-xs text-slate-500">
                            {template.topicCount} topics ·{" "}
                            {template.subtopicCount} subtopics
                          </span>
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
          {resultCount === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
              No templates match this macro category and search.
            </p>
          ) : null}
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
          <button
            type="button"
            onClick={() => setStep((value) => value + 1)}
            disabled={step === 2 && selectedTemplateIds.length === 0}
            className="min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
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
