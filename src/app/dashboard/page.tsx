import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";

import { currentStudentId, signOut } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db/client";
import {
  courseMembers,
  coursePages,
  enrollments,
  programs,
  subjectEnrollments,
  subjects,
  subtopicProgress,
  subtopics,
  topics,
  universities,
  universityPrograms,
} from "@/lib/db/schema";

export default async function DashboardPage() {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");

  const [enrollment] = await db
    .select({
      id: enrollments.id,
      phase: enrollments.phase,
      intakeYear: enrollments.intakeYear,
      universityName: universities.name,
      programName: programs.name,
    })
    .from(enrollments)
    .innerJoin(
      universityPrograms,
      eq(enrollments.universityProgramId, universityPrograms.id),
    )
    .innerJoin(universities, eq(universityPrograms.universityId, universities.id))
    .innerJoin(programs, eq(universityPrograms.programId, programs.id))
    .where(eq(enrollments.studentId, studentId))
    .limit(1);
  if (!enrollment) redirect("/onboarding");

  const admin = await isAdmin();

  const [subjectRows, progressRows, courseRows] = await Promise.all([
    // Every subject with its total subtopic count.
    db
      .select({
        id: subjects.id,
        slug: subjects.slug,
        name: subjects.name,
        description: subjects.description,
        subtopicCount: count(subtopics.id),
      })
      .from(subjects)
      .leftJoin(topics, eq(topics.subjectId, subjects.id))
      .leftJoin(subtopics, eq(subtopics.topicId, topics.id))
      .groupBy(subjects.id)
      .orderBy(asc(subjects.position)),
    // This student's per-subject status and count of done subtopics.
    db
      .select({
        subjectId: subjectEnrollments.subjectId,
        status: subjectEnrollments.status,
        doneCount: sql<number>`count(*) filter (where ${subtopicProgress.state} = 'done')`,
      })
      .from(subjectEnrollments)
      .leftJoin(
        subtopicProgress,
        eq(subtopicProgress.subjectEnrollmentId, subjectEnrollments.id),
      )
      .where(eq(subjectEnrollments.enrollmentId, enrollment.id))
      .groupBy(subjectEnrollments.subjectId, subjectEnrollments.status),
    db
      .select({
        slug: coursePages.slug,
        localName: coursePages.localName,
        courseCode: coursePages.courseCode,
        academicYear: coursePages.academicYear,
        visibility: coursePages.visibility,
        role: courseMembers.role,
      })
      .from(courseMembers)
      .innerJoin(coursePages, eq(courseMembers.coursePageId, coursePages.id))
      .where(
        and(
          eq(courseMembers.studentId, studentId),
          isNull(coursePages.archivedAt),
        ),
      )
      .orderBy(desc(coursePages.updatedAt)),
  ]);

  const progressBySubject = new Map(
    progressRows.map((r) => [
      r.subjectId,
      { status: r.status, doneCount: Number(r.doneCount) },
    ]),
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-start justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <div>
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            engdepthanal
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Your first-year database
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {enrollment.programName}
            </span>
            <span aria-hidden>·</span>
            <span>{enrollment.universityName}</span>
            <span aria-hidden>·</span>
            <span>intake {enrollment.intakeYear}</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {enrollment.phase}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {admin && (
            <Link
              href="/admin"
              className="text-sm font-medium text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400"
            >
              Admin
            </Link>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-500">Your courses</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Editable snapshots for real university courses.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/courses"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-white"
            >
              Browse
            </Link>
            <Link
              href="/courses/new"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Create course
            </Link>
          </div>
        </div>
        {courseRows.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {courseRows.map((course) => (
              <li key={course.slug}>
                <Link
                  href={`/courses/${course.slug}`}
                  className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{course.localName}</h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        {course.courseCode ? `${course.courseCode} · ` : ""}
                        {course.academicYear}
                      </p>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {course.role}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            No course pages yet. Clone the canonical templates into your
            university&apos;s first editable course.
          </div>
        )}
      </section>

      <h2 className="mb-3 text-sm font-semibold text-zinc-500">
        Canonical subjects
      </h2>
      <ul className="space-y-3">
        {subjectRows.map((subject) => {
          const progress = progressBySubject.get(subject.id);
          const total = subject.subtopicCount;
          const done = progress?.doneCount ?? 0;
          const pct = total ? Math.round((done / total) * 100) : 0;
          const finished = progress?.status === "finished";
          return (
            <li key={subject.slug}>
              <Link
                href={`/subjects/${subject.slug}`}
                className="group block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                      <SubjectGlyph slug={subject.slug} />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                        {subject.name}
                      </h3>
                      {subject.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                          {subject.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {finished ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      ✓ Finished
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-zinc-500">
                      {total} subtopics
                    </span>
                  )}
                </div>
                {progress && !finished && done > 0 && (
                  <div className="mt-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-500">
                      {done} of {total} subtopics done · {pct}%
                    </p>
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      {subjectRows.length === 0 && (
        <p className="text-sm text-zinc-500">
          No subjects seeded yet — run <code>npm run db:seed</code>.
        </p>
      )}
    </main>
  );
}

/** A small monogram per subject; falls back to the first letter. */
function SubjectGlyph({ slug }: { slug: string }) {
  const glyphs: Record<string, string> = {
    "calculus-1": "∫",
    "linear-algebra": "⎡⎤",
  };
  return (
    <span className="text-sm font-semibold">
      {glyphs[slug] ?? slug.charAt(0).toUpperCase()}
    </span>
  );
}
