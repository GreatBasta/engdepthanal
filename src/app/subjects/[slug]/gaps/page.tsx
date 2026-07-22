import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import { subjects, subtopics, topics } from "@/lib/db/schema";
import { getStudentEnrollment } from "@/lib/enrollment";
import { getSubjectCoverage, type Verdict } from "@/lib/coverage";

const VERDICT_META: Record<
  Verdict,
  { label: string; badge: string; order: number }
> = {
  not_taught: {
    label: "Not taught",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    order: 0,
  },
  partially_taught: {
    label: "Partially taught",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    order: 1,
  },
  taught: {
    label: "Taught",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    order: 2,
  },
  insufficient_data: {
    label: "Not enough data",
    badge: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    order: 3,
  },
};

/**
 * The gap analysis (STRUCTURE.md §2.5): for the student's own university +
 * course, which subtopics their university does NOT teach — reconstructed
 * from finished students' coverage answers. Gated on the sample size (§5.1).
 */
export default async function GapsPage({
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
      topicName: topics.name,
      topicPosition: topics.position,
      subtopicId: subtopics.id,
      subtopicName: subtopics.name,
      subtopicDescription: subtopics.description,
    })
    .from(topics)
    .innerJoin(subtopics, eq(subtopics.topicId, topics.id))
    .where(eq(topics.subjectId, subject.id))
    .orderBy(asc(topics.position), asc(subtopics.position));

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={`/subjects/${slug}`}
        className="text-sm text-zinc-500 underline-offset-2 hover:underline"
      >
        ← {subject.name} outlook
      </Link>
      <h1 className="mt-3 text-2xl font-bold">
        What your university teaches — {subject.name}
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Reconstructed from students at your university and course who finished
        this subject.
      </p>

      {!coverage.hasEnough ? (
        <GatheringData
          respondents={coverage.respondents}
          minSample={coverage.minSample}
        />
      ) : (
        <GapContent subject={subject.name} coverage={coverage} rows={rows} />
      )}
    </main>
  );
}

function GatheringData({
  respondents,
  minSample,
}: {
  respondents: number;
  minSample: number;
}) {
  const pct = Math.round((respondents / minSample) * 100);
  return (
    <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold">Still gathering data</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        We show the gap analysis once at least {minSample} students at your
        university and course have finished this subject and completed the
        coverage survey. So far: <strong>{respondents}</strong>.
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-zinc-500"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        Finished this subject yourself? Completing the survey brings everyone
        one step closer.
      </p>
    </div>
  );
}

function GapContent({
  subject,
  coverage,
  rows,
}: {
  subject: string;
  coverage: Awaited<ReturnType<typeof getSubjectCoverage>>;
  rows: {
    topicName: string;
    topicPosition: number;
    subtopicId: string;
    subtopicName: string;
    subtopicDescription: string | null;
  }[];
}) {
  const withVerdict = rows.map((r) => ({
    ...r,
    coverage: coverage.bySubtopic.get(r.subtopicId),
  }));
  const gaps = withVerdict.filter(
    (r) => r.coverage?.verdict === "not_taught",
  );
  const partial = withVerdict.filter(
    (r) => r.coverage?.verdict === "partially_taught",
  );

  return (
    <>
      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Finished students" value={coverage.respondents} />
        <Stat label="Not taught" value={gaps.length} tone="rose" />
        <Stat label="Partially" value={partial.length} tone="amber" />
        <Stat
          label="Avg grade"
          value={coverage.avgGrade == null ? "—" : `${coverage.avgGrade}`}
        />
      </dl>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">
          Your university likely won&apos;t teach you this
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Fewer than 40% of finished students studied these — plan to
          self-study them before second year.
        </p>
        {gaps.length === 0 ? (
          <p className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            Good news — no major gaps. Every subtopic is at least partially
            covered at your university.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {gaps.map((r) => (
              <li
                key={r.subtopicId}
                className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-950 dark:bg-rose-950/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{r.subtopicName}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {r.topicPosition}. {r.topicName}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-rose-600 dark:text-rose-400">
                    {r.coverage!.pctCovered}% coverage · n={r.coverage!.n}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Full coverage map</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Every subtopic, and how much your university covers it.
        </p>
        <ul className="mt-4 space-y-px">
          {withVerdict.map((r) => {
            const meta = VERDICT_META[r.coverage?.verdict ?? "insufficient_data"];
            return (
              <li
                key={r.subtopicId}
                className="flex items-center justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800/60"
              >
                <span className="text-sm">{r.subtopicName}</span>
                <div className="flex shrink-0 items-center gap-3">
                  {r.coverage && r.coverage.n > 0 && (
                    <span className="text-xs text-zinc-400">
                      {r.coverage.pctCovered}%
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}
                  >
                    {meta.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "rose" | "amber";
}) {
  const toneClass =
    tone === "rose"
      ? "text-rose-600 dark:text-rose-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <dd className={`text-2xl font-bold ${toneClass}`}>{value}</dd>
      <dt className="mt-1 text-xs text-zinc-500">{label}</dt>
    </div>
  );
}
