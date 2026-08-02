import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { hasExactCurriculumChangeScope } from "../src/lib/courses/curriculum-change-rules";

test("accepts a curriculum batch only when every submitted stable ID is in scope", () => {
  assert.equal(hasExactCurriculumChangeScope(["a", "b"], ["b", "a"]), true);
  assert.equal(
    hasExactCurriculumChangeScope(["a", "cross-course"], ["a"]),
    false,
  );
});

test("rejects duplicate curriculum IDs instead of applying a partial batch", () => {
  assert.equal(hasExactCurriculumChangeScope(["a", "a"], ["a"]), false);
});

test("standard curriculum UI hides internal publishing terminology", () => {
  const source = [
    "src/app/courses/[slug]/curriculum-panel.tsx",
    "src/app/courses/[slug]/curriculum-accordion.tsx",
    "src/app/courses/[slug]/page.tsx",
  ]
    .map((file) => readFileSync(resolve(file), "utf8"))
    .join("\n");
  for (const label of [
    "Editable draft",
    "Published curriculum",
    "Publish draft",
    "Preview published",
    "Back to draft",
    "Public snapshot",
  ]) {
    assert.equal(
      source.includes(label),
      false,
      `found visible label: ${label}`,
    );
  }
});
