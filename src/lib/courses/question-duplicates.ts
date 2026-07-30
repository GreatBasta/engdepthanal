export interface QuestionCandidate {
  id: string;
  prompt: string;
}

export interface QuestionDuplicateSuggestion extends QuestionCandidate {
  similarity: number;
}

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

export function normalizeQuestionPrompt(prompt: string): string[] {
  return prompt
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

export function questionSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalizeQuestionPrompt(left));
  const rightTokens = new Set(normalizeQuestionPrompt(right));
  if (!leftTokens.size || !rightTokens.size) return 0;

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const jaccard = intersection / union;
  const containment =
    intersection / Math.min(leftTokens.size, rightTokens.size);
  return Number((0.65 * jaccard + 0.35 * containment).toFixed(4));
}

export function findLikelyQuestionDuplicates(
  prompt: string,
  candidates: QuestionCandidate[],
  threshold = 0.62,
): QuestionDuplicateSuggestion[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      similarity: questionSimilarity(prompt, candidate.prompt),
    }))
    .filter((candidate) => candidate.similarity >= threshold)
    .sort(
      (left, right) =>
        right.similarity - left.similarity ||
        left.prompt.localeCompare(right.prompt),
    )
    .slice(0, 3);
}
