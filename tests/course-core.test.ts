import assert from "node:assert/strict";
import test from "node:test";

import {
  courseDuplicateKey,
  normalizeCourseText,
  reserveUniqueSlug,
  slugifyCourse,
} from "../src/lib/courses/core";

test("normalizes course metadata for duplicate warnings", () => {
  assert.equal(normalizeCourseText("  MATHEMATICAL   Analysis I "), "mathematical analysis i");
  assert.equal(
    courseDuplicateKey({
      localName: " Analysis I ",
      courseCode: " MAT-101 ",
      professorName: " Prof. Rossi ",
      academicYear: "2026/27",
      semester: 1,
    }),
    "analysis i|mat-101|prof. rossi|2026/27|1",
  );
});

test("creates readable unique snapshot slugs", () => {
  const used = new Set<string>();
  assert.equal(slugifyCourse("Ánalysis & Algebra"), "nalysis-algebra");
  assert.equal(reserveUniqueSlug("Limits", used), "limits");
  assert.equal(reserveUniqueSlug("Limits", used), "limits-2");
  assert.equal(reserveUniqueSlug("Limits", used), "limits-3");
});

