import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  coverageAggregates,
  enrollments,
  subjectEnrollments,
  subjects,
} from "@/lib/db/schema";

export type Verdict =
  | "taught"
  | "partially_taught"
  | "not_taught"
  | "insufficient_data";

export interface SubtopicCoverage {
  n: number;
  pctCovered: number;
  pctInDepth: number;
  verdict: Verdict;
}

export interface SubjectCoverage {
  /** Finished students of this university-program who took the subject. */
  respondents: number;
  minSample: number;
  /** True once respondents ≥ minSample (STRUCTURE.md §5.1 gate). */
  hasEnough: boolean;
  avgGrade: number | null;
  bySubtopic: Map<string, SubtopicCoverage>;
}

/**
 * Read the coverage picture for a subject as seen by a given
 * university-program. Powers both the gap page and the outlook badges.
 * The sample-size gate (§5.1) is applied here: below the threshold,
 * `hasEnough` is false and callers show "gathering data" instead of numbers.
 */
export async function getSubjectCoverage(
  universityProgramId: string,
  subjectId: string,
): Promise<SubjectCoverage> {
  const [subject] = await db
    .select({ minSample: subjects.minSampleSize })
    .from(subjects)
    .where(eq(subjects.id, subjectId))
    .limit(1);
  const minSample = subject?.minSample ?? 5;

  // Live respondent count — authoritative, independent of the last rollup.
  const finished = await db
    .select({ grade: subjectEnrollments.gradeNormalized })
    .from(subjectEnrollments)
    .innerJoin(enrollments, eq(subjectEnrollments.enrollmentId, enrollments.id))
    .where(
      and(
        eq(enrollments.universityProgramId, universityProgramId),
        eq(subjectEnrollments.subjectId, subjectId),
        eq(subjectEnrollments.status, "finished"),
      ),
    );
  const respondents = finished.length;
  const hasEnough = respondents >= minSample;

  const grades = finished
    .map((f) => (f.grade == null ? null : Number(f.grade)))
    .filter((g): g is number => g != null && Number.isFinite(g));
  const avgGrade =
    hasEnough && grades.length > 0
      ? Math.round((grades.reduce((a, b) => a + b, 0) / grades.length) * 100) /
        100
      : null;

  const bySubtopic = new Map<string, SubtopicCoverage>();
  if (hasEnough) {
    const rows = await db
      .select({
        subtopicId: coverageAggregates.subtopicId,
        n: coverageAggregates.n,
        pctCovered: coverageAggregates.pctCovered,
        pctInDepth: coverageAggregates.pctInDepth,
        verdict: coverageAggregates.verdict,
      })
      .from(coverageAggregates)
      .where(
        and(
          eq(coverageAggregates.universityProgramId, universityProgramId),
          eq(coverageAggregates.subjectId, subjectId),
        ),
      );
    for (const r of rows) {
      bySubtopic.set(r.subtopicId, {
        n: r.n,
        pctCovered: Number(r.pctCovered),
        pctInDepth: Number(r.pctInDepth),
        verdict: r.verdict as Verdict,
      });
    }
  }

  return { respondents, minSample, hasEnough, avgGrade, bySubtopic };
}
