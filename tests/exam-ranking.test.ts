import assert from "node:assert/strict";
import test from "node:test";

import { rankExamQuestion } from "../src/lib/courses/exam-ranking";

test("withholds a tier until two occurrence reports exist", () => {
  assert.deepEqual(
    rankExamQuestion({
      occurrences: 1,
      distinctSessions: 1,
      netVotes: 100,
    }),
    { tier: null, score: 105, sufficient: false },
  );
});

test("applies documented tier thresholds", () => {
  assert.equal(
    rankExamQuestion({
      occurrences: 2,
      distinctSessions: 2,
      netVotes: -5,
    }).tier,
    "D",
  );
  assert.equal(
    rankExamQuestion({
      occurrences: 2,
      distinctSessions: 2,
      netVotes: 1,
    }).tier,
    "B",
  );
  assert.equal(
    rankExamQuestion({
      occurrences: 5,
      distinctSessions: 3,
      netVotes: 3,
    }).tier,
    "S",
  );
});
