import Link from "next/link";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
} from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import {
  courseMembers,
  coursePages,
  programs,
  universities,
  universityPrograms,
} from "@/lib/db/schema";

export default async function CourseDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    university?: string;
    program?: string;
    year?: string;
    semester?: string;
    invite?: string;
  }>;
}) {
  const [query, studentId] = await Promise.all([
    searchParams,
    currentStudentId(),
  ]);
  const search = query.q?.trim().slice(0, 100) || "";
  const universityId = query.university?.trim() || "";
  const programSlug = query.program?.trim() || "";
  const academicYear = query.year?.trim().slice(0, 20) || "";
  const parsedSemester = Number(query.semester);
  const semester =
    Number.isInteger(parsedSemester) &&
    parsedSemester >= 1 &&
    parsedSemester <= 12
      ? parsedSemester
      : null;

  // Visibility is a mandatory predicate, never a post-query filter. This
  // makes accidental leakage of private or unlisted metadata much harder.
  const directoryConditions = [
    eq(coursePages.visibility, "public"),
    isNull(coursePages.archivedAt),
    universityId ? eq(universities.id, universityId) : undefined,
    programSlug ? eq(programs.slug, programSlug) : undefined,
    academicYear ? eq(coursePages.academicYear, academicYear) : undefined,
    semester ? eq(coursePages.semester, semester) : undefined,
    search
      ? or(
          ilike(coursePages.localName, `%${search}%`),
          ilike(coursePages.courseCode, `%${search}%`),
          ilike(coursePages.professorName, `%${search}%`),
          ilike(universities.name, `%${search}%`),
          ilike(programs.name, `%${search}%`),
        )
      : undefined,
  ];

  const [courses, universityOptions, programOptions, yearOptions] =
    await Promise.all([
      db
        .select({
          slug: coursePages.slug,
          localName: coursePages.localName,
          courseCode: coursePages.courseCode,
          professorName: coursePages.professorName,
          academicYear: coursePages.academicYear,
          semester: coursePages.semester,
          description: coursePages.description,
          updatedAt: coursePages.updatedAt,
          universityName: universities.name,
          countryCode: universities.countryCode,
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
        .leftJoin(
          courseMembers,
          eq(coursePages.id, courseMembers.coursePageId),
        )
        .where(and(...directoryConditions))
        .groupBy(
          coursePages.id,
          universities.id,
          programs.id,
        )
        .orderBy(desc(coursePages.updatedAt))
        .limit(100),
      db
        .selectDistinct({
          id: universities.id,
          name: universities.name,
          countryCode: universities.countryCode,
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
        .where(
          and(
            eq(coursePages.visibility, "public"),
            isNull(coursePages.archivedAt),
          ),
        )
        .orderBy(asc(universities.name)),
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
    ]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <Link
            href={studentId ? "/dashboard" : "/"}
            className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            ← {studentId ? "Dashboard" : "Home"}
          </Link>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400">
            Public directory
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Find the course students actually attend
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
            Search university-specific curriculum snapshots, communities, and
            exam evidence. Unlisted and private pages never appear here.
          </p>
        </div>
        {studentId ? (
          <Link
            href="/courses/new"
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Create course
          </Link>
        ) : (
          <Link
            href="/login?next=/courses/new"
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Sign in to contribute
          </Link>
        )}
      </header>

      {query.invite === "invalid" ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
        >
          That invitation is expired, already used, or belongs to another
          email.
        </p>
      ) : null}

      <form
        action="/courses"
        className="mt-8 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,2fr)_repeat(4,minmax(8rem,1fr))_auto]"
      >
        <label className="text-xs font-medium">
          Search
          <input
            name="q"
            defaultValue={search}
            maxLength={100}
            placeholder="Name, code, professor…"
            className={`${filterClass} mt-1 w-full`}
          />
        </label>
        <label className="text-xs font-medium">
          University
          <select
            name="university"
            defaultValue={universityId}
            className={`${filterClass} mt-1 w-full`}
          >
            <option value="">All</option>
            {universityOptions.map((university) => (
              <option key={university.id} value={university.id}>
                {university.name} ({university.countryCode})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Program
          <select
            name="program"
            defaultValue={programSlug}
            className={`${filterClass} mt-1 w-full`}
          >
            <option value="">All</option>
            {programOptions.map((program) => (
              <option key={program.slug} value={program.slug}>
                {program.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Year
          <select
            name="year"
            defaultValue={academicYear}
            className={`${filterClass} mt-1 w-full`}
          >
            <option value="">All</option>
            {yearOptions.map(({ year }) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Semester
          <input
            name="semester"
            type="number"
            min={1}
            max={12}
            defaultValue={semester ?? ""}
            placeholder="All"
            className={`${filterClass} mt-1 w-full`}
          />
        </label>
        <button
          type="submit"
          className="self-end rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Filter
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-500">
          {courses.length} public {courses.length === 1 ? "course" : "courses"}
        </h2>
        {search ||
        universityId ||
        programSlug ||
        academicYear ||
        semester ? (
          <Link
            href="/courses"
            className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Clear filters
          </Link>
        ) : null}
      </div>

      {courses.length > 0 ? (
        <ul className="mt-3 grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <li key={course.slug}>
              <Link
                href={`/courses/${course.slug}`}
                className="group block h-full rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      {course.universityName} · {course.countryCode}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                      {course.localName}
                    </h3>
                  </div>
                  {course.courseCode ? (
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium dark:bg-zinc-800">
                      {course.courseCode}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {course.programName} · {course.academicYear}
                  {course.semester ? ` · semester ${course.semester}` : ""}
                </p>
                {course.description ? (
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {course.description}
                  </p>
                ) : null}
                <p className="mt-4 text-xs text-zinc-500">
                  {Number(course.memberCount)} contributors
                  {course.professorName
                    ? ` · Prof. ${course.professorName}`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <section className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <h2 className="font-semibold">No public courses match</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Try broader filters, or create the first accurate page for your
            university.
          </p>
        </section>
      )}
    </main>
  );
}

const filterClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950";

