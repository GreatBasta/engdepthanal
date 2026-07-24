import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "./db/client";
import {
  coverageAggregates,
  coverageResponses,
  enrollments,
  subjectEnrollments,
  subjects,
  subtopics,
  topics,
} from "./db/schema";

/**
 * Coverage aggregation (STRUCTURE.md §6). For one (university_program,
 * subject) pair, recompute the per-subtopic coverage_aggregates that power
 * the gap analysis. Idempotent — safe to re-run any time responses change.
 *
 * Answer weighting (§5.2): yes_depth = 1.0, yes_brief = 0.5, no = 0;
 * `unsure` is excluded from the denominator entirely.
 */
export const WEIGHT: Record<string, number> = {
  yes_depth: 1,
  yes_brief: 0.5,
  no: 0,
};

export type Verdict =
  | "taught"
  | "partially_taught"
  | "not_taught"
  | "insufficient_data";

// Verdict thresholds on weighted coverage (§5.2).
export function verdictFor(
  respondentCount: number,
  minSample: number,
  answerCount: number,
  pctCovered: number,
): "taught" | "partially_taught" | "not_taught" | "insufficient_data" {
  if (respondentCount < minSample || answerCount === 0) {
    return "insufficient_data";
  }
  if (pctCovered >= 70) return "taught";
  if (pctCovered >= 40) return "partially_taught";
  return "not_taught";
}

export async function recomputeSubjectAggregates(
  universityProgramId: string,
  subjectId: string,
): Promise<{ respondents: number; subtopics: number }> {
  const [subject] = await db
    .select({ minSample: subjects.minSampleSize })
    .from(subjects)
    .where(eq(subjects.id, subjectId))
    .limit(1);
  if (!subject) throw new Error("unknown subject");
  const minSample = subject.minSample;

  // Finished students of this university-program who took this subject.
  const finished = await db
    .select({
      id: subjectEnrollments.id,
      grade: subjectEnrollments.gradeNormalized,
    })
    .from(subjectEnrollments)
    .innerJoin(
      enrollments,
      eq(subjectEnrollments.enrollmentId, enrollments.id),
    )
    .where(
      and(
        eq(enrollments.universityProgramId, universityProgramId),
        eq(subjectEnrollments.subjectId, subjectId),
        eq(subjectEnrollments.status, "finished"),
      ),
    );

  const respondents = finished.length;
  const grades = finished
    .map((f) => (f.grade == null ? null : Number(f.grade)))
    .filter((g): g is number => g != null && Number.isFinite(g));
  // Privacy (§5.1): only expose an average grade once past the sample gate.
  const avgGrade =
    respondents >= minSample && grades.length > 0
      ? Math.round((grades.reduce((a, b) => a + b, 0) / grades.length) * 100) /
        100
      : null;

  // All live subtopics of the subject.
  const subs = await db
    .select({ id: subtopics.id })
    .from(subtopics)
    .innerJoin(topics, eq(subtopics.topicId, topics.id))
    .where(and(eq(topics.subjectId, subjectId), isNull(subtopics.retiredAt)));

  // Responses from those finished students, grouped by subtopic.
  const finishedIds = finished.map((f) => f.id);
  const responses = finishedIds.length
    ? await db
        .select({
          subtopicId: coverageResponses.subtopicId,
          answer: coverageResponses.answer,
        })
        .from(coverageResponses)
        .where(
          inArray(coverageResponses.subjectEnrollmentId, finishedIds),
        )
    : [];

  const bySubtopic = new Map<
    string,
    { weightSum: number; denom: number; inDepth: number }
  >();
  for (const r of responses) {
    if (r.answer === "unsure") continue; // excluded from the denominator
    const acc =
      bySubtopic.get(r.subtopicId) ?? { weightSum: 0, denom: 0, inDepth: 0 };
    acc.weightSum += WEIGHT[r.answer] ?? 0;
    acc.denom += 1;
    if (r.answer === "yes_depth") acc.inDepth += 1;
    bySubtopic.set(r.subtopicId, acc);
  }

  const now = new Date();
  const rows = subs.map((sub) => {
    const acc = bySubtopic.get(sub.id) ?? {
      weightSum: 0,
      denom: 0,
      inDepth: 0,
    };
    const pctCovered =
      acc.denom > 0
        ? Math.round((acc.weightSum / acc.denom) * 10000) / 100
        : 0;
    const pctInDepth =
      acc.denom > 0 ? Math.round((acc.inDepth / acc.denom) * 10000) / 100 : 0;
    return {
      universityProgramId,
      subjectId,
      subtopicId: sub.id,
      n: acc.denom,
      pctCovered: String(pctCovered),
      pctInDepth: String(pctInDepth),
      avgGradeNormalized: avgGrade == null ? null : String(avgGrade),
      verdict: verdictFor(respondents, minSample, acc.denom, pctCovered),
      computedAt: now,
    };
  });

  if (rows.length > 0) {
    await db
      .insert(coverageAggregates)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          coverageAggregates.universityProgramId,
          coverageAggregates.subjectId,
          coverageAggregates.subtopicId,
        ],
        set: {
          n: sqlExcluded("n"),
          pctCovered: sqlExcluded("pct_covered"),
          pctInDepth: sqlExcluded("pct_in_depth"),
          avgGradeNormalized: sqlExcluded("avg_grade_normalized"),
          verdict: sqlExcluded("verdict"),
          computedAt: sqlExcluded("computed_at"),
        },
      });
  }

  return { respondents, subtopics: rows.length };
}

/**
 * Recompute every (university_program, subject) that has at least one
 * finished student. This is the "nightly job" entry point (STRUCTURE.md §6);
 * run via `npm run aggregate`. In production, schedule it (cron / Inngest).
 */
export async function recomputeAllAggregates(): Promise<number> {
  const pairs = await db
    .selectDistinct({
      universityProgramId: enrollments.universityProgramId,
      subjectId: subjectEnrollments.subjectId,
    })
    .from(subjectEnrollments)
    .innerJoin(enrollments, eq(subjectEnrollments.enrollmentId, enrollments.id))
    .where(eq(subjectEnrollments.status, "finished"));

  for (const p of pairs) {
    await recomputeSubjectAggregates(p.universityProgramId, p.subjectId);
  }
  return pairs.length;
}

function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}
