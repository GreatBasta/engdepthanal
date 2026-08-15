"use client";

import Link from "next/link";
import { useActionState, useDeferredValue, useMemo, useState } from "react";

import { OrganizationCombobox } from "@/components/organization-combobox";
import { useI18n } from "@/components/locale-provider";
import { curriculumCategories } from "@/lib/curriculum/taxonomy";
import type { TranslationKey } from "@/lib/i18n/messages";
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
  importCandidate,
}: {
  templates: TemplateOption[];
  degreePrograms: DegreeProgramOption[];
  defaultOrganization: OrganizationResult;
  defaultUniversityProgramId: string;
  defaultCohortYear: number;
  defaultAcademicYear: string;
  defaultAttendance: "attended" | "not_attended";
  defaultProgramSlug: string;
  importCandidate: {
    candidateId: string;
    officialOfferingId: string;
    name: string | null;
    canonicalName: string;
    courseCode: string | null;
    description: string | null;
    credits: string | null;
    degreeProgramme: string | null;
    academicYear: string | null;
    semester: string | null;
    professorName: string | null;
    officialUrl: string;
    organization: OrganizationResult;
    programSlug: string;
  } | null;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(
    createCourseAction,
    initialState,
  );
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [useDifferentOrganization, setUseDifferentOrganization] =
    useState(Boolean(importCandidate));
  const deferredQuery = useDeferredValue(query);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
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
            const leftRecommended =
              left.recommendedDegreePrograms.includes(defaultProgramSlug);
            const rightRecommended =
              right.recommendedDegreePrograms.includes(defaultProgramSlug);
            return (
              Number(rightRecommended) - Number(leftRecommended) ||
              left.year - right.year ||
              left.name.localeCompare(right.name)
            );
          });
        return matches.length
          ? [
              {
                ...macroCategory,
                label: t(`category.${macroCategory.key}` as TranslationKey),
                description: t(
                  `category.${macroCategory.key}Help` as TranslationKey,
                ),
                templates: matches,
              },
            ]
          : [];
      }),
    [templates, deferredQuery, category, defaultProgramSlug, t],
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
      {importCandidate ? (
        <>
          <input type="hidden" name="officialOfferingId" value={importCandidate.officialOfferingId} />
          <input type="hidden" name="catalogCandidateId" value={importCandidate.candidateId} />
        </>
      ) : null}
      <ol aria-label={t("create.progress")} className="grid grid-cols-3 gap-2">
        {[t("create.course"), t("create.templates"), t("create.privacy")].map(
          (label, index) => (
            <li
              key={label}
              aria-current={step === index + 1 ? "step" : undefined}
              className={`rounded-xl px-3 py-2 text-center text-xs font-semibold ${
                step === index + 1
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {index + 1}. {label}
            </li>
          ),
        )}
      </ol>

      <section
        className={
          step === 1
            ? "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
            : "hidden"
        }
      >
        <p className="text-sm font-semibold text-indigo-700">
          {t("create.step", { step: 1 })}
        </p>
        <h2 className="mt-1 text-xl font-bold">{t("create.identityTitle")}</h2>
        <div className="mt-5 grid gap-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("create.universityDegree")}
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
            {t("create.changeUniversity")}
          </label>
          {useDifferentOrganization ? (
            <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
              <OrganizationCombobox
                label={t("create.anotherUniversity")}
                name="organizationSelection"
                defaultOrganization={importCandidate?.organization ?? null}
              />
              <label className="block text-sm font-semibold">
                {t("create.degree")}
                <select
                  name="programSlug"
                  defaultValue={importCandidate?.programSlug ?? defaultProgramSlug}
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
            {t("create.localName")}
            <input
              name="localName"
              required
              minLength={2}
              maxLength={180}
              placeholder={t("create.localNamePlaceholder")}
              defaultValue={importCandidate?.name ?? importCandidate?.canonicalName ?? ""}
              className={`${inputClass} mt-1`}
            />
          </label>
          {importCandidate ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                {t("catalog.officialSource")}
              </p>
              <a href={importCandidate.officialUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm font-semibold text-indigo-700 underline">
                {importCandidate.officialUrl}
              </a>
              <p className="mt-2 text-xs text-slate-600">
                {[importCandidate.degreeProgramme, importCandidate.credits ? `${importCandidate.credits} credits` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  {t("settings.code")}
                  <input name="courseCode" defaultValue={importCandidate.courseCode ?? ""} className={`${inputClass} mt-1`} />
                </label>
                <label className="text-sm font-semibold">
                  {t("course.professor")}
                  <input name="professorName" defaultValue={importCandidate.professorName ?? ""} className={`${inputClass} mt-1`} />
                </label>
                <label className="text-sm font-semibold">
                  {t("course.academicYear")}
                  <input name="academicYear" required defaultValue={importCandidate.academicYear ?? defaultAcademicYear} className={`${inputClass} mt-1`} />
                </label>
                <label className="text-sm font-semibold">
                  {t("course.semester")}
                  <input name="semester" type="number" min={1} max={12} defaultValue={importCandidate.semester?.match(/\b(1[0-2]|[1-9])\b/)?.[1] ?? ""} className={`${inputClass} mt-1`} />
                </label>
              </div>
              <label className="mt-3 block text-sm font-semibold">
                {t("settings.description")}
                <textarea name="description" defaultValue={importCandidate.description ?? ""} maxLength={2_000} className={`${inputClass} mt-1 min-h-28 py-3`} />
              </label>
            </div>
          ) : null}
        </div>
        {!importCandidate ? <input type="hidden" name="academicYear" value={defaultAcademicYear} /> : null}
        <input type="hidden" name="cohortYear" value={defaultCohortYear} />
        <input type="hidden" name="attendance" value={defaultAttendance} />
      </section>

      <fieldset
        className={
          step === 2
            ? "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
            : "hidden"
        }
      >
        <legend className="px-1 text-xl font-bold">
          {t("create.step", { step: 2 })} · {t("create.templateTitle")}
        </legend>
        <p className="mt-1 text-sm text-slate-600">
          {t("create.templateHelp")}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_14rem]">
          <label className="sr-only" htmlFor="template-search">
            {t("create.searchTemplates")}
          </label>
          <input
            id="template-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("create.searchPlaceholder")}
            className={inputClass}
          />
          <label className="sr-only" htmlFor="template-category">
            {t("create.category")}
          </label>
          <select
            id="template-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={inputClass}
          >
            <option value="all">{t("create.allCategories")}</option>
            {curriculumCategories.map((item) => (
              <option key={item.key} value={item.key}>
                {t(`category.${item.key}` as TranslationKey)}
              </option>
            ))}
          </select>
        </div>
        <p
          className="mt-4 text-xs font-medium text-slate-500"
          aria-live="polite"
        >
          {resultCount === 1
            ? t("create.matchOne", { selected: selectedTemplateIds.length })
            : t("create.matches", {
                count: resultCount,
                selected: selectedTemplateIds.length,
              })}
        </p>
        <div className="mt-3 max-h-[34rem] space-y-5 overflow-y-auto pr-1">
          {groupedTemplates.map((group) => (
            <section
              key={group.key}
              aria-labelledby={`category-${group.key}`}
              className="render-lazy rounded-2xl border border-slate-200 bg-slate-50/70 p-3"
            >
              <div className="px-1 pb-3">
                <h3
                  id={`category-${group.key}`}
                  className="font-bold text-slate-950"
                >
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
                              {t("create.recommended")}
                            </span>
                          ) : null}
                          <span className="mt-2 line-clamp-2 block text-sm text-slate-600">
                            {template.description}
                          </span>
                          <span className="mt-2 block text-xs text-slate-500">
                            {t("create.topicCounts", {
                              topics: template.topicCount,
                              subtopics: template.subtopicCount,
                            })}
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
              {t("create.noTemplates")}
            </p>
          ) : null}
        </div>
      </fieldset>

      <section
        className={
          step === 3
            ? "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
            : "hidden"
        }
      >
        <p className="text-sm font-semibold text-indigo-700">
          {t("create.step", { step: 3 })}
        </p>
        <h2 className="mt-1 text-xl font-bold">
          {t("create.visibilityTitle")}
        </h2>
        <div className="mt-5 grid gap-3">
          {[
            ["private", t("course.private"), t("create.privateHelp")],
            ["unlisted", t("course.unlisted"), t("create.unlistedHelp")],
            ["public", t("course.public"), t("create.publicHelp")],
          ].map(([value, title, detail]) => (
            <label
              key={value}
              className="flex min-h-16 cursor-pointer gap-3 rounded-xl border border-slate-200 p-4 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50"
            >
              <input
                type="radio"
                name="visibility"
                value={value}
                defaultChecked={value === "private"}
              />
              <span>
                <span className="block font-bold">{title}</span>
                <span className="block text-sm text-slate-600">{detail}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-5 rounded-xl bg-slate-100 p-4 text-sm leading-6 text-slate-600">
          {t("create.detailsLater")}
        </p>
      </section>

      {state.duplicates.length ? (
        <section
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950"
        >
          <h2 className="font-bold">{t("create.duplicateTitle")}</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {state.duplicates.map((duplicate) => (
              <li key={duplicate.slug}>
                <Link
                  href={`/courses/${duplicate.slug}`}
                  target="_blank"
                  className="font-semibold underline"
                >
                  {duplicate.localName}
                </Link>{" "}
                · {duplicate.academicYear}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">{t("create.duplicateHelp")}</p>
        </section>
      ) : null}
      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step === 1 ? (
          <Link
            href="/my-courses"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold"
          >
            {t("common.cancel")}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setStep((value) => value - 1)}
            className="min-h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold"
          >
            {t("create.back")}
          </button>
        )}
        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((value) => value + 1)}
            disabled={step === 2 && selectedTemplateIds.length === 0}
            className="min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("common.continue")}
          </button>
        ) : (
          <button
            type="submit"
            name={state.duplicates.length ? "confirmDuplicate" : undefined}
            value={state.duplicates.length ? "yes" : undefined}
            disabled={pending}
            className="min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending
              ? t("create.creating")
              : state.duplicates.length
                ? t("create.createDifferent")
                : t("common.createCourse")}
          </button>
        )}
      </div>
    </form>
  );
}
