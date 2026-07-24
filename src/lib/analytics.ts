import { and, eq, inArray } from "drizzle-orm";

import { db } from "./db/client";
import {
  coverageResponses,
  enrollments,
  subjectEnrollments,
  subjects,
} from "./db/schema";
import { WEIGHT, verdictFor, type Verdict } from "./aggregate";

/** Minimum size of BOTH sub-groups before we report a grade lift. */
const MIN_LIFT_GROUP = 3;
/** Minimum graded respondents before we report a correlation. */
const MIN_CORR_N = 4;

export interface SubtopicStat {
  n: number;
  pctCovered: number;
  pctInDepth: number;
  verdict: Verdict;
  /** Avg grade of students who studied it vs those who didn't (when both groups are big enough). */
  lift: {
    covered: number;
    not: number;
    delta: number;
    nCovered: number;
    nNot: number;
  } | null;
}

export interface CohortAnalytics {
  respondents: number;
  minSample: number;
  hasEnough: boolean;
  avgGrade: number | null;
  /** Intake years that have finished respondents (for the cohort filter). */
  intakeYears: number[];
  selectedYear: number | null;
  bySubtopic: Map<string, SubtopicStat>;
  /** Correlation between how much of the syllabus a student covered and their grade. */
  correlation: { r: number; n: number } | null;
}

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function round(x: number, p = 2): number {
  const f = 10 ** p;
  return Math.round(x * f) / f;
}

/** Pearson correlation, or null if undefined (too few points or no variance). */
function pearson(pairs: [number, number][]): number | null {
  const n = pairs.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pairs) {
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  const cov = sxy - (sx * sy) / n;
  const vx = sxx - (sx * sx) / n;
  const vy = syy - (sy * sy) / n;
  if (vx <= 0 || vy <= 0) return null;
  return cov / Math.sqrt(vx * vy);
}

/**
 * Live coverage + grade analytics for a subject as seen by one
 * university-program, optionally filtered to a single intake-year cohort
 * (curricula change year to year, so cohort comparison is more honest).
 * Computed from raw responses so it can slice by cohort; the cached
 * `coverage_aggregates` still power the lighter outlook badges.
 */
export async function getCohortAnalytics(
  universityProgramId: string,
  subjectId: string,
  intakeYear: number | null,
): Promise<CohortAnalytics> {
  const [subject] = await db
    .select({ minSample: subjects.minSampleSize })
    .from(subjects)
    .where(eq(subjects.id, subjectId))
    .limit(1);
  const minSample = subject?.minSample ?? 5;

  // Finished respondents of this uni-program + subject (optionally one cohort).
  const respRows = await db
    .select({
      seId: subjectEnrollments.id,
      grade: subjectEnrollments.gradeNormalized,
      intakeYear: enrollments.intakeYear,
    })
    .from(subjectEnrollments)
    .innerJoin(enrollments, eq(subjectEnrollments.enrollmentId, enrollments.id))
    .where(
      and(
        eq(enrollments.universityProgramId, universityProgramId),
        eq(subjectEnrollments.subjectId, subjectId),
        eq(subjectEnrollments.status, "finished"),
      ),
    );

  const intakeYears = [...new Set(respRows.map((r) => r.intakeYear))].sort(
    (a, b) => b - a,
  );

  const selected = respRows.filter(
    (r) => intakeYear == null || r.intakeYear === intakeYear,
  );
  const respondents = selected.length;
  const hasEnough = respondents >= minSample;

  const gradeOf = new Map<string, number | null>();
  for (const r of selected) {
    gradeOf.set(r.seId, r.grade == null ? null : Number(r.grade));
  }
  const grades = [...gradeOf.values()].filter(
    (g): g is number => g != null && Number.isFinite(g),
  );
  const avgGrade = hasEnough && grades.length > 0 ? round(avg(grades)) : null;

  const bySubtopic = new Map<string, SubtopicStat>();
  let correlation: CohortAnalytics["correlation"] = null;

  if (hasEnough) {
    const seIds = selected.map((r) => r.seId);
    const responses = seIds.length
      ? await db
          .select({
            seId: coverageResponses.subjectEnrollmentId,
            subtopicId: coverageResponses.subtopicId,
            answer: coverageResponses.answer,
          })
          .from(coverageResponses)
          .where(inArray(coverageResponses.subjectEnrollmentId, seIds))
      : [];

    type Acc = {
      weightSum: number;
      denom: number;
      inDepth: number;
      gCovered: number[];
      gNot: number[];
    };
    const acc = new Map<string, Acc>();
    const coveredCount = new Map<string, number>(); // per respondent

    for (const r of responses) {
      const a =
        acc.get(r.subtopicId) ??
        { weightSum: 0, denom: 0, inDepth: 0, gCovered: [], gNot: [] };
      const g = gradeOf.get(r.seId);
      if (r.answer !== "unsure") {
        a.denom += 1;
        a.weightSum += WEIGHT[r.answer] ?? 0;
      }
      if (r.answer === "yes_depth") a.inDepth += 1;
      if (r.answer === "yes_depth" || r.answer === "yes_brief") {
        coveredCount.set(r.seId, (coveredCount.get(r.seId) ?? 0) + 1);
        if (g != null) a.gCovered.push(g);
      } else if (r.answer === "no") {
        if (g != null) a.gNot.push(g);
      }
      acc.set(r.subtopicId, a);
    }

    for (const [subtopicId, a] of acc) {
      const pctCovered = a.denom > 0 ? round((a.weightSum / a.denom) * 100) : 0;
      const pctInDepth = a.denom > 0 ? round((a.inDepth / a.denom) * 100) : 0;
      const lift =
        a.gCovered.length >= MIN_LIFT_GROUP && a.gNot.length >= MIN_LIFT_GROUP
          ? {
              covered: round(avg(a.gCovered), 1),
              not: round(avg(a.gNot), 1),
              delta: round(avg(a.gCovered) - avg(a.gNot), 1),
              nCovered: a.gCovered.length,
              nNot: a.gNot.length,
            }
          : null;
      bySubtopic.set(subtopicId, {
        n: a.denom,
        pctCovered,
        pctInDepth,
        verdict: verdictFor(respondents, minSample, a.denom, pctCovered),
        lift,
      });
    }

    // Correlation: syllabus coverage breadth vs grade, across respondents.
    const pairs: [number, number][] = [];
    for (const [seId, g] of gradeOf) {
      if (g == null) continue;
      pairs.push([coveredCount.get(seId) ?? 0, g]);
    }
    if (pairs.length >= MIN_CORR_N) {
      const r = pearson(pairs);
      if (r != null) correlation = { r: round(r), n: pairs.length };
    }
  }

  return {
    respondents,
    minSample,
    hasEnough,
    avgGrade,
    intakeYears,
    selectedYear: intakeYear,
    bySubtopic,
    correlation,
  };
}
