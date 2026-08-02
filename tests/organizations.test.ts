import assert from "node:assert/strict";
import test from "node:test";

import {
  dedupeOrganizationResults,
  normalizeOrganizationName,
  normalizeRorResponse,
  type OrganizationResult,
} from "../src/lib/organizations/schema";

function rorItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "https://ror.org/00s1f1m81",
    status: "active",
    types: ["education"],
    names: [
      { value: "Politecnico di Torino", types: ["ror_display", "label"], lang: "it" },
      { value: "Polytechnic University of Turin", types: ["alias"], lang: "en" },
      { value: "POLITO", types: ["acronym"], lang: null },
    ],
    locations: [
      {
        geonames_details: {
          name: "Turin",
          country_code: "IT",
          country_name: "Italy",
          country_subdivision_name: "Piedmont",
        },
      },
    ],
    domains: ["polito.it"],
    links: [{ type: "website", value: "https://www.polito.it/" }],
    admin: { last_modified: { date: "2026-06-10" } },
    ...overrides,
  };
}

test("normalizes active ROR education records into the internal contract", () => {
  const [organization] = normalizeRorResponse({ items: [rorItem()] }, "IT");
  assert.deepEqual(organization, {
    localId: null,
    rorId: "https://ror.org/00s1f1m81",
    canonicalName: "Politecnico di Torino",
    displayName: "Politecnico di Torino",
    aliases: ["Polytechnic University of Turin"],
    acronyms: ["POLITO"],
    organizationType: "education",
    city: "Turin",
    region: "Piedmont",
    countryCode: "IT",
    countryName: "Italy",
    domains: ["polito.it"],
    websiteUrl: "https://www.polito.it/",
    source: "ror",
    verified: true,
    externalUpdatedAt: "2026-06-10",
  });
});

test("filters non-education, inactive and wrong-country ROR records", () => {
  assert.equal(normalizeRorResponse({ items: [rorItem({ types: ["company"] })] }).length, 0);
  assert.equal(normalizeRorResponse({ items: [rorItem({ status: "inactive" })] }).length, 0);
  assert.equal(normalizeRorResponse({ items: [rorItem()] }, "US").length, 0);
});

test("deduplicates display results by canonical ROR ID and exact domain", () => {
  const [base] = normalizeRorResponse({ items: [rorItem()] });
  const duplicateId = { ...base, source: "local" as const, localId: "6a6d2e99-f815-402b-84f4-9b3626d77578" };
  const duplicateDomain: OrganizationResult = {
    ...base,
    rorId: "https://ror.org/02n415q13",
    displayName: "Duplicate domain",
  };
  assert.deepEqual(dedupeOrganizationResults([duplicateId, base, duplicateDomain]), [duplicateId]);
  assert.equal(normalizeOrganizationName("  Università  di Tórino "), "universita di torino");
});

test("invalid upstream structures fail closed", () => {
  assert.deepEqual(normalizeRorResponse({ items: [{ id: "javascript:bad" }] }), []);
});
