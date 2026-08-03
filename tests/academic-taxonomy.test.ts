import assert from "node:assert/strict";
import test from "node:test";

import {
  academicTaxonomy,
  searchAcademicTaxonomy,
  validateAcademicTaxonomy,
} from "../src/lib/academics/taxonomy";

test("multidisciplinary taxonomy has valid bilingual parent relationships", () => {
  assert.deepEqual(validateAcademicTaxonomy(), []);
  const domains = academicTaxonomy.filter((item) => item.level === "domain");
  assert.equal(domains.length, 18);
  assert.ok(domains.every((item) => item.labels.en && item.labels.it));
});

test("taxonomy search resolves English, Italian and aliases", () => {
  assert.equal(searchAcademicTaxonomy("medicine", "en")[0]?.key, "health-medicine");
  assert.ok(searchAcademicTaxonomy("giurisprudenza", "it").some((item) => item.key === "law"));
  assert.ok(searchAcademicTaxonomy("scienza dei dati", "it").some((item) => item.key === "data-science"));
});

test("taxonomy keeps engineering as one domain among many", () => {
  const engineering = academicTaxonomy.find(
    (item) => item.key === "engineering-technology",
  );
  assert.equal(engineering?.level, "domain");
  assert.ok(academicTaxonomy.some((item) => item.key === "literature"));
  assert.ok(academicTaxonomy.some((item) => item.key === "nursing"));
  assert.ok(academicTaxonomy.some((item) => item.key === "economics"));
});
