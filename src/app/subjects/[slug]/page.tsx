import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import { subjects, subtopics, topics } from "@/lib/db/schema";
import { getStudentEnrollment } from "@/lib/enrollment";
import { getSubjectCoverage, type Verdict } from "@/lib/coverage";
import { DepthLegend, DepthMeter } from "@/components/Depth";

const COVERAGE_META: Record<Verdict, { label: string; badge: string }> = {
  taught: {
    label: "taught here",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  partially_taught: {
    label: "partial",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  not_taught: {
    label: "not taught",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  },
  insufficient_data: { label: "", badge: "" },
};

/**
 * The read-only "branch outlook": every topic and subtopic of the subject,
 * with how deeply to learn each (the depth meter, explained by the legend)
 * and — once enough students respond — how much your university covers it.
 */
export default async function SubjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");
  const { slug } = await params;

  const enrollment = await getStudentEnrollment(studentId);
  if (!enrollment) redirect("/onboarding");

  const [subject] = await db
    .select()
    .from(subjects)
    .where(eq(subjects.slug, slug))
    .limit(1);
  if (!subject) notFound();

  const coverage = await getSubjectCoverage(
    enrollment.universityProgramId,
    subject.id,
  );

  const rows = await db
    .select({
      topicId: topics.id,
      topicName: topics.name,
      topicDescription: topics.description,
      topicPosition: topics.position,
      subtopicId: subtopics.id,
      subtopicName: subtopics.name,
      subtopicDescription: subtopics.description,
      depthLevel: subtopics.depthLevel,
      estHours: subtopics.estHours,
    })
    .from(topics)
    .innerJoin(subtopics, eq(subtopics.topicId, topics.id))
    .where(eq(topics.subjectId, subject.id))
    .orderBy(asc(topics.position), asc(subtopics.position));

  const grouped = new Map<
    string,
    {
      name: string;
      description: string | null;
      position: number;
      items: typeof rows;
    }
  >();
  for (const row of rows) {
    if (!grouped.has(row.topicId)) {
      grouped.set(row.topicId, {
        name: row.topicName,
        description: row.topicDescription,
        position: row.topicPosition,
        items: [],
      });
    }
    grouped.get(row.topicId)!.items.push(row);
  }
  const totalHours = rows.reduce(
    (sum, r) => sum + (r.estHours ? Number(r.estHours) : 0),
    0,
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/dashboard"
        className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
      >
        ← All subjects
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight">{subject.name}</h1>
      {subject.description && (
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          {subject.description}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>{grouped.size} topics</span>
        <span>{rows.length} subtopics</span>
        <span>~{Math.round(totalHours)} study hours</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={`/subjects/${slug}/track`}
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          Track your progress →
        </Link>
        <Link
          href={`/subjects/${slug}/gaps`}
          className="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          What your university teaches →
        </Link>
      </div>

      <div className="mt-8">
        <DepthLegend />
      </div>

      {coverage.hasEnough ? (
        <p className="mt-4 text-xs text-zinc-500">
          The coverage tags (
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            taught
          </span>{" "}
          /{" "}
          <span className="font-medium text-rose-600 dark:text-rose-400">
            not taught
          </span>
          ) reflect {coverage.respondents} finished students at your university
          and course.
        </p>
      ) : (
        <p className="mt-4 text-xs text-zinc-500">
          Coverage tags for your university appear once {coverage.minSample}{" "}
          finished students respond ({coverage.respondents} so far).
        </p>
      )}

      <ol className="mt-8 space-y-6">
        {[...grouped.values()].map((topic) => (
          <li
            key={topic.position}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-baseline gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                {topic.position}
              </span>
              <h2 className="text-lg font-semibold">{topic.name}</h2>
            </div>
            {topic.description && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {topic.description}
              </p>
            )}
            <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800/70">
              {topic.items.map((item) => {
                const cov = coverage.hasEnough
                  ? coverage.bySubtopic.get(item.subtopicId)
                  : undefined;
                const covMeta =
                  cov && cov.verdict !== "insufficient_data"
                    ? COVERAGE_META[cov.verdict]
                    : null;
                return (
                  <li
                    key={item.subtopicId}
                    className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {item.subtopicName}
                      </p>
                      {item.subtopicDescription && (
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {item.subtopicDescription}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {covMeta && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${covMeta.badge}`}
                          title={`${cov!.pctCovered}% coverage at your university`}
                        >
                          {covMeta.label}
                        </span>
                      )}
                      {item.estHours && (
                        <span className="text-xs tabular-nums text-zinc-400">
                          {Number(item.estHours)}h
                        </span>
                      )}
                      <DepthMeter depthKey={item.depthLevel} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </main>
  );
}
