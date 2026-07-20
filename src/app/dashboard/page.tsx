import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, count, eq, sql } from "drizzle-orm";

import { currentStudentId, signOut } from "@/auth";
import { db } from "@/lib/db/client";
import {
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

  const [subjectRows, progressRows] = await Promise.all([
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
  ]);

  const progressBySubject = new Map(
    progressRows.map((r) => [
      r.subjectId,
      { status: r.status, doneCount: Number(r.doneCount) },
    ]),
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">First-year database</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {enrollment.programName} · {enrollment.universityName} · intake{" "}
            {enrollment.intakeYear} ·{" "}
            {enrollment.phase === "starting" ? "starting" : "attending"}
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="text-sm text-zinc-500 underline-offset-2 hover:underline"
          >
            Sign out
          </button>
        </form>
      </header>

      <ul className="space-y-4">
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
                className="block rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-lg font-semibold">{subject.name}</h2>
                  {finished ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      Finished
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-zinc-500">
                      {total} subtopics
                    </span>
                  )}
                </div>
                {subject.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {subject.description}
                  </p>
                )}
                {progress && !finished && done > 0 && (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {done} of {total} subtopics done
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
