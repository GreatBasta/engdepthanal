import assert from "node:assert/strict";
import test from "node:test";

import {
  findLikelyQuestionDuplicates,
  normalizeQuestionPrompt,
  questionSimilarity,
} from "../src/lib/courses/question-duplicates";

test("normalizes punctuation, case, and low-information words", () => {
  assert.deepEqual(normalizeQuestionPrompt("Explain THE Fourier-transform!"), [
    "explain",
    "fourier",
    "transform",
  ]);
});

test("suggests a paraphrased recurring exam question", () => {
  const [suggestion] = findLikelyQuestionDuplicates(
    "Derive the Fourier transform of a Gaussian signal",
    [
      {
        id: "same",
        prompt: "Derive Fourier transform for the Gaussian signal.",
      },
      {
        id: "different",
        prompt: "State Kirchhoff voltage law for a circuit.",
      },
    ],
  );
  assert.equal(suggestion.id, "same");
  assert.ok(suggestion.similarity >= 0.62);
});

test("does not suggest unrelated prompts", () => {
  assert.equal(
    findLikelyQuestionDuplicates("Explain database normalization", [
      { id: "other", prompt: "Compute a beam bending moment" },
    ]).length,
    0,
  );
  assert.equal(questionSimilarity("", "anything"), 0);
});
