import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import { subjects, subtopics, topics } from "@/lib/db/schema";
import { getStudentEnrollment } from "@/lib/enrollment";
import { getCohortAnalytics, type CohortAnalytics } from "@/lib/analytics";
import type { Verdict } from "@/lib/aggregate";

const VERDICT_META: Record<Verdict, { label: string; badge: string }> = {
  not_taught: {
    label: "Not taught",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  },
  partially_taught: {
    label: "Partially taught",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  taught: {
    label: "Taught",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  insufficient_data: {
    label: "Not enough data",
    badge: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

type Row = {
  topicName: string;
  topicPosition: number;
  subtopicId: string;
  subtopicName: string;
};

/**
 * The gap analysis (STRUCTURE.md §2.5): for the student's own university +
 * course, which subtopics their university does NOT teach — plus how coverage
 * tracks with grades. Filterable by intake-year cohort. Gated on sample size.
 */
export default async function GapsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cohort?: string }>;
}) {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");
  const { slug } = await params;
  const { cohort } = await searchParams;

  const enrollment = await getStudentEnrollment(studentId);
  if (!enrollment) redirect("/onboarding");

  const [subject] = await db
    .select()
    .from(subjects)
    .where(eq(subjects.slug, slug))
    .limit(1);
  if (!subject) notFound();

  // Peek at which cohorts exist, then resolve the requested one.
  const peek = await getCohortAnalytics(
    enrollment.universityProgramId,
    subject.id,
    null,
  );
  const requestedYear = cohort ? Number(cohort) : NaN;
  const selectedYear =
    Number.isFinite(requestedYear) && peek.intakeYears.includes(requestedYear)
      ? requestedYear
      : null;

  const analytics =
    selectedYear == null
      ? peek
      : await getCohortAnalytics(
          enrollment.universityProgramId,
          subject.id,
          selectedYear,
        );

  const rows = await db
    .select({
      topicName: topics.name,
      topicPosition: topics.position,
      subtopicId: subtopics.id,
      subtopicName: subtopics.name,
    })
    .from(topics)
    .innerJoin(subtopics, eq(subtopics.topicId, topics.id))
    .where(eq(topics.subjectId, subject.id))
    .orderBy(asc(topics.position), asc(subtopics.position));

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={`/subjects/${slug}`}
        className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
      >
        ← {subject.name} outlook
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">
        What your university teaches — {subject.name}
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Reconstructed from students at your university and course who finished
        this subject.
      </p>

      {peek.intakeYears.length > 1 && (
        <CohortFilter
          slug={slug}
          years={peek.intakeYears}
          selected={selectedYear}
        />
      )}

      {!analytics.hasEnough ? (
        <GatheringData
          respondents={analytics.respondents}
          minSample={analytics.minSample}
          cohort={selectedYear}
        />
      ) : (
        <GapContent subject={subject.name} analytics={analytics} rows={rows} />
      )}
    </main>
  );
}

function CohortFilter({
  slug,
  years,
  selected,
}: {
  slug: string;
  years: number[];
  selected: number | null;
}) {
  const chip = (label: string, href: string, active: boolean) => (
    <Link
      key={label}
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-cyan-800 text-white"
          : "border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Intake
      </span>
      {chip("All", `/subjects/${slug}/gaps`, selected == null)}
      {years.map((y) =>
        chip(String(y), `/subjects/${slug}/gaps?cohort=${y}`, selected === y),
      )}
    </div>
  );
}

function GatheringData({
  respondents,
  minSample,
  cohort,
}: {
  respondents: number;
  minSample: number;
  cohort: number | null;
}) {
  const pct = Math.round((respondents / minSample) * 100);
  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold">Still gathering data</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        We show the analysis once at least {minSample} students
        {cohort != null ? ` from the ${cohort} intake` : ""} at your university
        and course have finished this subject and completed the survey. So far:{" "}
        <strong>{respondents}</strong>.
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-zinc-500"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function GapContent({
  subject,
  analytics,
  rows,
}: {
  subject: string;
  analytics: CohortAnalytics;
  rows: Row[];
}) {
  const withStat = rows.map((r) => ({
    ...r,
    stat: analytics.bySubtopic.get(r.subtopicId),
  }));
  const gaps = withStat.filter((r) => r.stat?.verdict === "not_taught");
  const partial = withStat.filter(
    (r) => r.stat?.verdict === "partially_taught",
  );

  // Gaps/partials that most correlate with a better grade — self-study first.
  const gradeGaps = withStat
    .filter(
      (r) =>
        (r.stat?.verdict === "not_taught" ||
          r.stat?.verdict === "partially_taught") &&
        r.stat?.lift &&
        r.stat.lift.delta >= 3,
    )
    .sort((a, b) => (b.stat!.lift!.delta ?? 0) - (a.stat!.lift!.delta ?? 0))
    .slice(0, 6);

  return (
    <>
      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Finished students" value={analytics.respondents} />
        <Stat label="Not taught" value={gaps.length} tone="rose" />
        <Stat label="Partially" value={partial.length} tone="amber" />
        <Stat
          label="Avg grade"
          value={analytics.avgGrade == null ? "—" : `${analytics.avgGrade}`}
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
                    {r.stat!.pctCovered}% coverage · n={r.stat!.n}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Grade analytics ---- */}
      {(analytics.correlation || gradeGaps.length > 0) && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Coverage &amp; grades</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            How what students studied relates to how they scored — grades are
            aggregate-only and never individually visible.
          </p>

          {analytics.correlation && (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm">{readCorrelation(analytics.correlation.r)}</p>
              <p className="mt-1 text-xs text-zinc-500">
                r = {analytics.correlation.r} · n = {analytics.correlation.n}{" "}
                graded students · syllabus breadth vs final grade
              </p>
            </div>
          )}

          {gradeGaps.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold">
                Missing topics that track with better grades
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Among students here, those who studied these scored higher on
                average — worth prioritising in your self-study.
              </p>
              <ul className="mt-3 space-y-2">
                {gradeGaps.map((r) => (
                  <li
                    key={r.subtopicId}
                    className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div>
                      <p className="text-sm font-medium">{r.subtopicName}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        studied: {r.stat!.lift!.covered} avg · not:{" "}
                        {r.stat!.lift!.not} avg
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      +{r.stat!.lift!.delta}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Full coverage map</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Every subtopic, and how much your university covers it.
        </p>
        <ul className="mt-4 space-y-px">
          {withStat.map((r) => {
            const meta = VERDICT_META[r.stat?.verdict ?? "insufficient_data"];
            return (
              <li
                key={r.subtopicId}
                className="flex items-center justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800/60"
              >
                <span className="text-sm">{r.subtopicName}</span>
                <div className="flex shrink-0 items-center gap-3">
                  {r.stat && r.stat.n > 0 && (
                    <span className="text-xs text-zinc-400">
                      {r.stat.pctCovered}%
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

function readCorrelation(r: number): string {
  const mag = Math.abs(r);
  if (mag < 0.2)
    return "How much of the syllabus students studied shows little relationship with their grade in this cohort.";
  const strength =
    mag < 0.4 ? "a weak" : mag < 0.7 ? "a moderate" : "a strong";
  const dir = r >= 0 ? "higher" : "lower";
  return `Students who studied more of the syllabus tended to score ${dir} — ${strength} relationship.`;
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
