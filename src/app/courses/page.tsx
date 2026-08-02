import Link from "next/link";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import {
  courseMembers,
  coursePages,
  coursePageTemplates,
  curriculumTemplates,
  programs,
  universities,
  universityPrograms,
} from "@/lib/db/schema";
import {
  getPrimaryEnrollmentForStudent,
  organizationResultFromPrimaryEnrollment,
} from "@/lib/enrollment";
import { getLocalOrganizationByIdentifier } from "@/lib/organizations/search";
import { getI18n } from "@/lib/i18n/server";

import { CourseOrganizationFilter } from "./organization-filter";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("discover.title"), description: t("discover.subtitle") };
}

const PAGE_SIZE = 48;

const getDirectoryOptions = unstable_cache(
  async () =>
    Promise.all([
      db
        .selectDistinct({ slug: programs.slug, name: programs.name })
        .from(coursePages)
        .innerJoin(
          universityPrograms,
          eq(coursePages.universityProgramId, universityPrograms.id),
        )
        .innerJoin(programs, eq(universityPrograms.programId, programs.id))
        .where(
          and(
            eq(coursePages.visibility, "public"),
            isNull(coursePages.archivedAt),
          ),
        )
        .orderBy(asc(programs.name)),
      db
        .selectDistinct({ year: coursePages.academicYear })
        .from(coursePages)
        .where(
          and(
            eq(coursePages.visibility, "public"),
            isNull(coursePages.archivedAt),
          ),
        )
        .orderBy(desc(coursePages.academicYear)),
      db
        .selectDistinct({
          id: curriculumTemplates.id,
          name: curriculumTemplates.name,
        })
        .from(coursePageTemplates)
        .innerJoin(
          coursePages,
          eq(coursePageTemplates.coursePageId, coursePages.id),
        )
        .innerJoin(
          curriculumTemplates,
          eq(coursePageTemplates.templateId, curriculumTemplates.id),
        )
        .where(
          and(
            eq(coursePages.visibility, "public"),
            isNull(coursePages.archivedAt),
          ),
        )
        .orderBy(asc(curriculumTemplates.name)),
    ]),
  ["course-directory-options-v2"],
  { revalidate: 300, tags: ["course-directory"] },
);

export default async function CourseDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    scope?: string;
    organization?: string;
    program?: string;
    professor?: string;
    year?: string;
    semester?: string;
    template?: string;
    invite?: string;
    page?: string;
  }>;
}) {
  const [query, studentId, i18n] = await Promise.all([
    searchParams,
    currentStudentId(),
    getI18n(),
  ]);
  const { t } = i18n;
  const primary = studentId
    ? await getPrimaryEnrollmentForStudent(studentId)
    : null;
  if (studentId && !primary) redirect("/onboarding");

  const scope = studentId && query.scope !== "all" ? "mine" : "all";
  const requestedOrganization = query.organization?.trim().slice(0, 200) || "";
  const selectedOrganization =
    scope === "mine" && primary
      ? organizationResultFromPrimaryEnrollment(primary)
      : requestedOrganization
        ? await getLocalOrganizationByIdentifier(requestedOrganization)
        : null;
  const organizationMissing =
    scope === "all" && Boolean(requestedOrganization) && !selectedOrganization;
  const organizationId =
    scope === "mine"
      ? (primary?.organizationId ?? "")
      : (selectedOrganization?.localId ?? "");

  const search = query.q?.trim().slice(0, 100) || "";
  const programSlug = query.program?.trim().slice(0, 120) || "";
  const professor = query.professor?.trim().slice(0, 120) || "";
  const academicYear = query.year?.trim().slice(0, 20) || "";
  const templateId = query.template?.trim().slice(0, 60) || "";
  const parsedSemester = Number(query.semester);
  const semester =
    Number.isInteger(parsedSemester) &&
    parsedSemester >= 1 &&
    parsedSemester <= 12
      ? parsedSemester
      : null;
  const parsedPage = Number(query.page);
  const page =
    Number.isInteger(parsedPage) && parsedPage > 0
      ? Math.min(parsedPage, 10_000)
      : 1;

  // Visibility remains a mandatory database predicate. Private and unlisted
  // records never enter grouping, option, count, or pagination results.
  const directoryConditions = [
    eq(coursePages.visibility, "public"),
    isNull(coursePages.archivedAt),
    organizationMissing ? sql<boolean>`false` : undefined,
    organizationId ? eq(universities.id, organizationId) : undefined,
    programSlug ? eq(programs.slug, programSlug) : undefined,
    professor ? ilike(coursePages.professorName, `%${professor}%`) : undefined,
    academicYear ? eq(coursePages.academicYear, academicYear) : undefined,
    semester ? eq(coursePages.semester, semester) : undefined,
    templateId
      ? sql<boolean>`exists (
          select 1 from ${coursePageTemplates}
          where ${coursePageTemplates.coursePageId} = ${coursePages.id}
            and ${coursePageTemplates.templateId} = ${templateId}
        )`
      : undefined,
    search
      ? or(
          ilike(coursePages.localName, `%${search}%`),
          ilike(coursePages.courseCode, `%${search}%`),
          ilike(coursePages.professorName, `%${search}%`),
          ilike(universities.name, `%${search}%`),
          ilike(universities.displayName, `%${search}%`),
          ilike(programs.name, `%${search}%`),
        )
      : undefined,
  ];

  const [courseRows, organizationCounts, directoryOptions] = await Promise.all([
    db
      .select({
        slug: coursePages.slug,
        localName: coursePages.localName,
        courseCode: coursePages.courseCode,
        professorName: coursePages.professorName,
        academicYear: coursePages.academicYear,
        semester: coursePages.semester,
        updatedAt: coursePages.updatedAt,
        organizationId: universities.id,
        organizationName: universities.displayName,
        organizationFallbackName: universities.name,
        organizationCity: universities.city,
        organizationCountry: universities.countryName,
        organizationCountryCode: universities.countryCode,
        organizationDomain: universities.primaryDomain,
        organizationWebsite: universities.websiteUrl,
        programName: programs.name,
        memberCount: count(courseMembers.studentId),
      })
      .from(coursePages)
      .innerJoin(
        universityPrograms,
        eq(coursePages.universityProgramId, universityPrograms.id),
      )
      .innerJoin(
        universities,
        eq(universityPrograms.universityId, universities.id),
      )
      .innerJoin(programs, eq(universityPrograms.programId, programs.id))
      .leftJoin(courseMembers, eq(coursePages.id, courseMembers.coursePageId))
      .where(and(...directoryConditions))
      .groupBy(coursePages.id, universities.id, programs.id)
      .orderBy(
        asc(universities.name),
        asc(programs.name),
        asc(coursePages.academicYear),
        asc(coursePages.localName),
      )
      .limit(PAGE_SIZE + 1)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({
        organizationId: universities.id,
        value: count(coursePages.id),
      })
      .from(coursePages)
      .innerJoin(
        universityPrograms,
        eq(coursePages.universityProgramId, universityPrograms.id),
      )
      .innerJoin(
        universities,
        eq(universityPrograms.universityId, universities.id),
      )
      .innerJoin(programs, eq(universityPrograms.programId, programs.id))
      .where(and(...directoryConditions))
      .groupBy(universities.id),
    getDirectoryOptions(),
  ]);

  const [programOptions, yearOptions, templateOptions] = directoryOptions;
  const countByOrganization = new Map(
    organizationCounts.map((row) => [row.organizationId, Number(row.value)]),
  );
  const hasNextPage = courseRows.length > PAGE_SIZE;
  const courses = courseRows.slice(0, PAGE_SIZE);
  const groups = Array.from(
    courses
      .reduce((map, course) => {
        const existing = map.get(course.organizationId);
        if (existing) existing.courses.push(course);
        else {
          map.set(course.organizationId, {
            id: course.organizationId,
            name: course.organizationName ?? course.organizationFallbackName,
            city: course.organizationCity,
            country:
              course.organizationCountry ?? course.organizationCountryCode,
            domain: course.organizationDomain,
            website: course.organizationWebsite,
            publicCourseCount:
              countByOrganization.get(course.organizationId) ?? 0,
            courses: [course],
          });
        }
        return map;
      }, new Map<string, DirectoryGroup>())
      .values(),
  );

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    params.set("scope", scope);
    if (scope === "all" && requestedOrganization) {
      params.set("organization", requestedOrganization);
    } else if (scope === "mine" && primary) {
      params.set("organization", primary.organizationId);
    }
    if (search) params.set("q", search);
    if (programSlug) params.set("program", programSlug);
    if (professor) params.set("professor", professor);
    if (academicYear) params.set("year", academicYear);
    if (semester) params.set("semester", String(semester));
    if (templateId) params.set("template", templateId);
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/courses?${params.toString()}`;
  };

  const clearHref =
    scope === "mine" && primary
      ? `/courses?scope=mine&organization=${primary.organizationId}`
      : "/courses?scope=all";
  const hasAdvancedFilters = Boolean(
    programSlug || professor || academicYear || semester || templateId,
  );

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 pb-24 sm:px-6 sm:py-12 md:pb-12">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <Link
            href="/"
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            ← {t("common.home")}
          </Link>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">
            {t("discover.kicker")}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {t("discover.title")}
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            {t("discover.subtitle")}
          </p>
        </div>
        <Link
          href={studentId ? "/courses/new" : "/login?next=/courses/new"}
          className="inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white"
        >
          {studentId ? t("common.createCourse") : t("common.signInContribute")}
        </Link>
      </header>

      {query.invite === "invalid" ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
        >
          {t("discover.inviteInvalid")}
        </p>
      ) : null}

      {studentId && primary ? (
        <nav
          aria-label={t("discover.scope")}
          className="mt-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1 sm:w-fit sm:min-w-80"
        >
          <Link
            href={`/courses?scope=mine&organization=${primary.organizationId}`}
            aria-current={scope === "mine" ? "page" : undefined}
            className={`min-h-11 rounded-lg px-4 py-3 text-center text-sm font-bold ${
              scope === "mine"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600"
            }`}
          >
            {t("discover.myUniversity")}
          </Link>
          <Link
            href="/courses?scope=all"
            aria-current={scope === "all" ? "page" : undefined}
            className={`min-h-11 rounded-lg px-4 py-3 text-center text-sm font-bold ${
              scope === "all"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600"
            }`}
          >
            {t("discover.allUniversities")}
          </Link>
        </nav>
      ) : null}

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {scope === "all" ? (
          <Suspense
            fallback={
              <div className="min-h-20 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
            }
          >
            <CourseOrganizationFilter
              defaultOrganization={selectedOrganization}
            />
          </Suspense>
        ) : selectedOrganization ? (
          <div>
            <p className="text-xs font-semibold text-slate-500">
              {t("organization.university")}
            </p>
            <p className="mt-1 font-bold">{selectedOrganization.displayName}</p>
            <p className="mt-1 text-sm text-slate-600">
              {[selectedOrganization.city, selectedOrganization.countryName]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        ) : null}

        <form action="/courses" className="mt-5 space-y-4">
          <input type="hidden" name="scope" value={scope} />
          {scope === "mine" && primary ? (
            <input
              type="hidden"
              name="organization"
              value={primary.organizationId}
            />
          ) : requestedOrganization ? (
            <input
              type="hidden"
              name="organization"
              value={requestedOrganization}
            />
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="min-w-0 flex-1 text-xs font-medium">
              {t("discover.search")}
              <input
                name="q"
                defaultValue={search}
                maxLength={100}
                placeholder={t("discover.searchPlaceholder")}
                className={`${filterClass} mt-1 w-full`}
              />
            </label>
            <button
              type="submit"
              className="min-h-11 self-end rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white"
            >
              {t("discover.applyFilters")}
            </button>
          </div>
          <details
            open={hasAdvancedFilters}
            className="rounded-xl border border-slate-200"
          >
            <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-bold">
              {t("discover.moreFilters")}
            </summary>
            <div className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-5">
              <FilterSelect
                label={t("discover.degree")}
                name="program"
                value={programSlug}
              >
                <option value="">{t("common.all")}</option>
                {programOptions.map((program) => (
                  <option key={program.slug} value={program.slug}>
                    {program.name}
                  </option>
                ))}
              </FilterSelect>
              <label className="text-xs font-medium">
                {t("discover.professor")}
                <input
                  name="professor"
                  defaultValue={professor}
                  maxLength={120}
                  className={`${filterClass} mt-1 w-full`}
                />
              </label>
              <FilterSelect
                label={t("discover.academicYear")}
                name="year"
                value={academicYear}
              >
                <option value="">{t("common.all")}</option>
                {yearOptions.map(({ year }) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </FilterSelect>
              <label className="text-xs font-medium">
                {t("discover.semester")}
                <input
                  name="semester"
                  type="number"
                  min={1}
                  max={12}
                  defaultValue={semester ?? ""}
                  className={`${filterClass} mt-1 w-full`}
                />
              </label>
              <FilterSelect
                label={t("discover.template")}
                name="template"
                value={templateId}
              >
                <option value="">{t("common.all")}</option>
                {templateOptions.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </FilterSelect>
            </div>
          </details>
        </form>
      </section>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-500">
          {groups.length === 1
            ? t("discover.groupCountOne")
            : t("discover.groupCount", { count: groups.length })}
          {page > 1 ? ` · ${t("common.page", { page })}` : ""}
        </h2>
        {search || requestedOrganization || hasAdvancedFilters ? (
          <Link href={clearHref} className="text-sm font-bold text-indigo-700">
            {t("common.clearFilters")}
          </Link>
        ) : null}
      </div>

      {groups.length ? (
        <div className="mt-4 space-y-5">
          {groups.map((group) => (
            <details
              key={group.id}
              open
              className="group rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <summary className="cursor-pointer list-none p-5 marker:hidden">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black">{group.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {[group.city, group.country].filter(Boolean).join(", ")}
                    </p>
                    {group.domain || group.website ? (
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {group.domain ?? group.website}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                    {group.publicCourseCount === 1
                      ? t("discover.publicCourseOne")
                      : t("discover.publicCourses", {
                          count: group.publicCourseCount,
                        })}
                  </span>
                </div>
              </summary>
              <ul className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.courses.map((course) => (
                  <li key={course.slug}>
                    <Link
                      href={`/courses/${course.slug}`}
                      className="block h-full rounded-xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold">{course.localName}</h3>
                        {course.courseCode ? (
                          <span className="text-xs text-slate-500">
                            {course.courseCode}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {course.programName} · {course.academicYear}
                      </p>
                      <p className="mt-3 text-xs text-slate-500">
                        {t("discover.members", {
                          count: Number(course.memberCount),
                        })}
                        {course.professorName
                          ? ` · Prof. ${course.professorName}`
                          : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      ) : (
        <section className="mt-4 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <h2 className="font-semibold">{t("discover.noMatch")}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t("discover.noMatchHelp")}
          </p>
        </section>
      )}

      {page > 1 || hasNextPage ? (
        <nav
          aria-label={t("discover.directoryPages")}
          className="mt-8 flex items-center justify-between gap-3"
        >
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              rel="prev"
              className={pageLinkClass}
            >
              {t("common.previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-slate-500">
            {t("common.page", { page })}
          </span>
          {hasNextPage ? (
            <Link
              href={pageHref(page + 1)}
              rel="next"
              className={pageLinkClass}
            >
              {t("common.next")}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}

type DirectoryCourse = {
  slug: string;
  localName: string;
  courseCode: string | null;
  professorName: string | null;
  academicYear: string;
  semester: number | null;
  updatedAt: Date;
  organizationId: string;
  organizationName: string | null;
  organizationFallbackName: string;
  organizationCity: string | null;
  organizationCountry: string | null;
  organizationCountryCode: string;
  organizationDomain: string | null;
  organizationWebsite: string | null;
  programName: string;
  memberCount: number | bigint;
};

type DirectoryGroup = {
  id: string;
  name: string;
  city: string | null;
  country: string;
  domain: string | null;
  website: string | null;
  publicCourseCount: number;
  courses: DirectoryCourse[];
};

function FilterSelect({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs font-medium">
      {label}
      <select
        name={name}
        defaultValue={value}
        className={`${filterClass} mt-1 w-full`}
      >
        {children}
      </select>
    </label>
  );
}

const filterClass =
  "min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";
const pageLinkClass =
  "inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800";
