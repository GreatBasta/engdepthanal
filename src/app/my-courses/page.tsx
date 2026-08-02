import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { effectiveCourseRole } from "@/lib/courses/permissions";
import { db } from "@/lib/db/client";
import {
  courseCurriculumVersions,
  courseMembers,
  coursePages,
  courseSubtopics,
  courseTopics,
  examExperiences,
  examQuestions,
  programs,
  universities,
  universityPrograms,
} from "@/lib/db/schema";
import {
  permanentlyDeleteCourseAction,
  restoreCourseAction,
} from "@/app/courses/[slug]/actions";

export const metadata = { title: "My courses" };

export default async function MyCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const [studentId, query] = await Promise.all([
    currentStudentId(),
    searchParams,
  ]);
  if (!studentId) redirect("/login?next=/my-courses");

  const [courses, archivedCourses] = await Promise.all([
    db
      .select({
        id: coursePages.id,
        slug: coursePages.slug,
        name: coursePages.localName,
        code: coursePages.courseCode,
        year: coursePages.academicYear,
        visibility: coursePages.visibility,
        role: courseMembers.role,
        updatedAt: coursePages.updatedAt,
        organizationId: universities.id,
        organizationName: universities.displayName,
        organizationFallbackName: universities.name,
        organizationCity: universities.city,
        organizationCountry: universities.countryName,
        organizationCountryCode: universities.countryCode,
        programName: programs.name,
        curriculumTotal: sql<number>`(
          select count(*) from ${courseSubtopics}
          inner join ${courseTopics}
            on ${courseSubtopics.courseTopicId} = ${courseTopics.id}
          inner join ${courseCurriculumVersions}
            on ${courseTopics.curriculumVersionId} = ${courseCurriculumVersions.id}
          where ${courseCurriculumVersions.coursePageId} = ${coursePages.id}
            and ${courseCurriculumVersions.status} = 'published'
            and ${courseSubtopics.hiddenAt} is null
        )`,
        curriculumClassified: sql<number>`(
          select count(*) from ${courseSubtopics}
          inner join ${courseTopics}
            on ${courseSubtopics.courseTopicId} = ${courseTopics.id}
          inner join ${courseCurriculumVersions}
            on ${courseTopics.curriculumVersionId} = ${courseCurriculumVersions.id}
          where ${courseCurriculumVersions.coursePageId} = ${coursePages.id}
            and ${courseCurriculumVersions.status} = 'published'
            and ${courseSubtopics.hiddenAt} is null
            and ${courseSubtopics.coverage} <> 'unknown'
        )`,
        examActivityCount: sql<number>`(
          (select count(*) from ${examQuestions}
            where ${examQuestions.coursePageId} = ${coursePages.id}
              and ${examQuestions.status} = 'active'
              and ${examQuestions.hiddenAt} is null)
          +
          (select count(*) from ${examExperiences}
            where ${examExperiences.coursePageId} = ${coursePages.id}
              and ${examExperiences.hiddenAt} is null)
        )`,
      })
      .from(courseMembers)
      .innerJoin(coursePages, eq(courseMembers.coursePageId, coursePages.id))
      .innerJoin(
        universityPrograms,
        eq(coursePages.universityProgramId, universityPrograms.id),
      )
      .innerJoin(
        universities,
        eq(universityPrograms.universityId, universities.id),
      )
      .innerJoin(programs, eq(universityPrograms.programId, programs.id))
      .where(
        and(
          eq(courseMembers.studentId, studentId),
          isNull(coursePages.archivedAt),
        ),
      )
      .orderBy(asc(universities.name), desc(coursePages.updatedAt)),
    db
      .select({
        id: coursePages.id,
        slug: coursePages.slug,
        name: coursePages.localName,
        code: coursePages.courseCode,
        year: coursePages.academicYear,
        archivedAt: coursePages.archivedAt,
      })
      .from(courseMembers)
      .innerJoin(coursePages, eq(courseMembers.coursePageId, coursePages.id))
      .where(
        and(
          eq(courseMembers.studentId, studentId),
          eq(courseMembers.role, "owner"),
          isNotNull(coursePages.archivedAt),
        ),
      )
      .orderBy(desc(coursePages.archivedAt)),
  ]);
  const groupedCourses = Array.from(
    courses.reduce((groups, course) => {
      const role = effectiveCourseRole(course.role);
      if (!role) return groups;
      const normalized = { ...course, role };
      const existing = groups.get(course.organizationId);
      if (existing) {
        if (role === "visitor") existing.visiting.push(normalized);
        else existing.ownedAndCoowned.push(normalized);
      } else {
        groups.set(course.organizationId, {
          id: course.organizationId,
          name: course.organizationName ?? course.organizationFallbackName,
          city: course.organizationCity,
          country: course.organizationCountry ?? course.organizationCountryCode,
          ownedAndCoowned: role === "visitor" ? [] : [normalized],
          visiting: role === "visitor" ? [normalized] : [],
        });
      }
      return groups;
    }, new Map<string, MyCourseGroup>()).values(),
  );

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-indigo-700">Your learning space</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">My courses</h1>
          <p className="mt-2 text-slate-600">
            Course coverage is shared. Your learning progress stays private.
          </p>
        </div>
        <Link
          href="/courses/new"
          className="inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Create course
        </Link>
      </header>

      {query.status === "archived" ? (
        <p
          role="status"
          className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
        >
          Course archived. You can restore or permanently delete it below.
        </p>
      ) : null}
      {query.status === "deleted" ? (
        <p
          role="status"
          className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
        >
          Course and its stored data were permanently deleted.
        </p>
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="mt-6 rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-800"
        >
          {query.error === "confirmation"
            ? "The course name did not match. Nothing was deleted."
            : query.error === "delete"
              ? "Deletion could not be completed. The course remains archived."
              : "The course lifecycle action could not be completed."}
        </p>
      ) : null}

      {groupedCourses.length ? (
        <div className="mt-8 space-y-7">
          {groupedCourses.map((group) => (
            <section key={group.id} aria-labelledby={`organization-${group.id}`}>
              <div>
                <h2 id={`organization-${group.id}`} className="text-xl font-black">
                  {group.name}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {[group.city, group.country].filter(Boolean).join(", ")}
                </p>
              </div>
              {group.ownedAndCoowned.length ? (
                <CourseSection title="Owned and co-owned" courses={group.ownedAndCoowned} />
              ) : null}
              {group.visiting.length ? (
                <CourseSection title="Visiting" courses={group.visiting} />
              ) : null}
            </section>
          ))}
        </div>
      ) : (
        <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="font-bold">No joined courses yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Discover an existing course or create its collaborative page.
          </p>
          <Link
            href="/courses"
            className="mt-5 inline-flex min-h-11 items-center font-semibold text-indigo-700"
          >
            Discover courses
          </Link>
        </section>
      )}

      {archivedCourses.length ? (
        <section className="mt-12 border-t border-slate-200 pt-8">
          <h2 className="text-xl font-black">Archived courses</h2>
          <p className="mt-1 text-sm text-slate-600">
            Only course owners can see this section. Restore a course, or type
            its exact name to permanently delete its curriculum, resources,
            exam data, memberships, and attachments.
          </p>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {archivedCourses.map((course) => (
              <li
                key={course.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h3 className="font-bold">{course.name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {course.code ? `${course.code} · ` : ""}
                  {course.year} · archived{" "}
                  {course.archivedAt?.toLocaleDateString("en")}
                </p>
                <div className="mt-4 flex flex-wrap items-start gap-2">
                  <form action={restoreCourseAction}>
                    <input
                      type="hidden"
                      name="coursePageId"
                      value={course.id}
                    />
                    <button className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
                      Restore course
                    </button>
                  </form>
                  <details className="rounded-xl border border-rose-300">
                    <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-rose-800">
                      Delete permanently
                    </summary>
                    <form
                      action={permanentlyDeleteCourseAction}
                      className="w-full min-w-64 border-t border-rose-200 p-4 sm:w-80"
                    >
                      <input
                        type="hidden"
                        name="coursePageId"
                        value={course.id}
                      />
                      <label className="block text-xs font-semibold text-slate-700">
                        Type “{course.name}” to confirm
                        <input
                          name="confirmation"
                          required
                          autoComplete="off"
                          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"
                        />
                      </label>
                      <button className="mt-3 min-h-11 w-full rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white">
                        Delete all course data
                      </button>
                    </form>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

type MyCourse = {
  id: string;
  slug: string;
  name: string;
  code: string | null;
  year: string;
  visibility: "public" | "unlisted" | "private";
  role: "owner" | "coowner" | "visitor";
  updatedAt: Date;
  organizationId: string;
  organizationName: string | null;
  organizationFallbackName: string;
  organizationCity: string | null;
  organizationCountry: string | null;
  organizationCountryCode: string;
  programName: string;
  curriculumTotal: number;
  curriculumClassified: number;
  examActivityCount: number;
};

type MyCourseGroup = {
  id: string;
  name: string;
  city: string | null;
  country: string;
  ownedAndCoowned: MyCourse[];
  visiting: MyCourse[];
};

function CourseSection({ title, courses }: { title: string; courses: MyCourse[] }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-bold text-slate-600">{title}</h3>
      <ul className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <li key={course.slug}>
            <Link
              href={`/courses/${course.slug}`}
              className="block h-full min-h-44 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                  {course.role === "owner"
                    ? "Owner"
                    : course.role === "coowner"
                      ? "Co-owner"
                      : "Visitor"}
                </span>
                <span className="text-xs capitalize text-slate-500">{course.visibility}</span>
              </div>
              <h4 className="mt-4 text-lg font-bold">{course.name}</h4>
              <p className="mt-1 text-sm text-slate-600">
                {course.programName} · {course.year}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                  Curriculum {Number(course.curriculumClassified)}/{Number(course.curriculumTotal)}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                  Exam {Number(course.examActivityCount)}
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Updated {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(course.updatedAt)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
