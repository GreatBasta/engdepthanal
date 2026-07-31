export type ExamTier = "S" | "A" | "B" | "C" | "D" | null;

export interface QuestionEvidence {
  occurrences: number;
  distinctSessions: number;
  distinctContributors: number;
  netVotes: number;
}

export interface QuestionRank {
  tier: ExamTier;
  score: number;
  sufficient: boolean;
}

/**
 * Transparent, intentionally conservative ranking:
 * score = (occurrence reports × 3) + (distinct sessions × 2) + net votes.
 * A tier is shown only after 10 approved reports across at least 3 sessions
 * and 5 contributors. Below that threshold the UI shows raw counts and
 * "Not enough data".
 */
export function rankExamQuestion(evidence: QuestionEvidence): QuestionRank {
  const score =
    evidence.occurrences * 3 +
    evidence.distinctSessions * 2 +
    evidence.netVotes;
  if (
    evidence.occurrences < 10 ||
    evidence.distinctSessions < 3 ||
    evidence.distinctContributors < 5
  ) {
    return { tier: null, score, sufficient: false };
  }
  const tier: Exclude<ExamTier, null> =
    score >= 24
      ? "S"
      : score >= 17
        ? "A"
        : score >= 11
          ? "B"
          : score >= 6
            ? "C"
            : "D";
  return { tier, score, sufficient: true };
}

export const EXAM_TIER_THRESHOLDS = [
  ["S", "24+"],
  ["A", "17–23"],
  ["B", "11–16"],
  ["C", "6–10"],
  ["D", "5 or less"],
] as const;
