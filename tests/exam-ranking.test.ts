import assert from "node:assert/strict";
import test from "node:test";

import { rankExamQuestion } from "../src/lib/courses/exam-ranking";

test("withholds a tier until the confidence thresholds are met", () => {
  assert.deepEqual(
    rankExamQuestion({
      occurrences: 1,
      distinctSessions: 1,
      distinctContributors: 1,
      netVotes: 100,
    }),
    { tier: null, score: 105, sufficient: false },
  );
});

test("applies tiers only to high-confidence evidence", () => {
  assert.equal(
    rankExamQuestion({
      occurrences: 10,
      distinctSessions: 3,
      distinctContributors: 5,
      netVotes: -31,
    }).tier,
    "D",
  );
  assert.equal(
    rankExamQuestion({
      occurrences: 10,
      distinctSessions: 3,
      distinctContributors: 5,
      netVotes: -25,
    }).tier,
    "B",
  );
  assert.equal(
    rankExamQuestion({
      occurrences: 10,
      distinctSessions: 3,
      distinctContributors: 5,
      netVotes: 0,
    }).tier,
    "S",
  );
});
