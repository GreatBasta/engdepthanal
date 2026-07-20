import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";

import { currentStudentId, signOut } from "@/auth";
import { db } from "@/lib/db/client";
import {
  enrollments,
  programs,
  subjects,
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

  const subjectRows = await db
    .select({
      slug: subjects.slug,
      name: subjects.name,
      description: subjects.description,
      topicCount: count(topics.id),
    })
    .from(subjects)
    .leftJoin(topics, eq(topics.subjectId, subjects.id))
    .groupBy(subjects.id)
    .orderBy(asc(subjects.position));

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
        {subjectRows.map((subject) => (
          <li key={subject.slug}>
            <Link
              href={`/subjects/${subject.slug}`}
              className="block rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-lg font-semibold">{subject.name}</h2>
                <span className="shrink-0 text-xs text-zinc-500">
                  {subject.topicCount} topics
                </span>
              </div>
              {subject.description && (
                <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {subject.description}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {subjectRows.length === 0 && (
        <p className="text-sm text-zinc-500">
          No subjects seeded yet — run <code>npm run db:seed</code>.
        </p>
      )}
    </main>
  );
}
