import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseSchemaOrgCourses } from "../src/lib/catalog/connectors/structured-data";
import { parseOfficialSitemap } from "../src/lib/catalog/connectors/sitemap";
import { assertCatalogResponseSize } from "../src/lib/catalog/fetch";
import {
  canAutoPublishCatalogCandidate,
  deduplicateCourseCandidates,
  isCatalogSourceStale,
  matchCandidateToExistingCourses,
} from "../src/lib/catalog/normalize";
import {
  assertAllowedRedirect,
  assertSafeResolvedAddresses,
  assertTrustedCatalogUrl,
  evaluateRobotsTxt,
  isPrivateIpAddress,
} from "../src/lib/catalog/policy";
import {
  advanceCatalogProgress,
  catalogMetadataChanges,
} from "../src/lib/catalog/state";
import type {
  CourseCandidate,
  OrganizationContext,
  SourceEvidence,
} from "../src/lib/catalog/types";

const fixture = (name: string) =>
  readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

const source = (body: string, sourceType: SourceEvidence["sourceType"]): SourceEvidence => ({
  sourceUrl: "https://catalog.example.edu/courses/BIO-101",
  sourceType,
  fetchedAt: "2026-08-03T10:00:00.000Z",
  status: 200,
  contentType: "text/html; charset=utf-8",
  etag: '"fixture-v1"',
  lastModified: "Mon, 03 Aug 2026 10:00:00 GMT",
  checksum: "a".repeat(64),
  body,
});

const context: OrganizationContext = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  rorId: "https://ror.org/fixture",
  canonicalName: "Example University",
  verifiedDomains: ["example.edu"],
  approvedDomains: ["example.edu"],
  officialWebsiteUrl: "https://www.example.edu/",
  locale: "en",
  crawlerUserAgent: "CourseAtlasCatalogBot/1.0",
  limits: {
    maxDepth: 2,
    maxPages: 40,
    maxResponseBytes: 2_000_000,
    timeoutMs: 10_000,
    minDelayMs: 750,
    maxSources: 12,
  },
};

test("trusted-domain policy accepts official subdomains and rejects outside redirects", () => {
  assert.equal(
    assertTrustedCatalogUrl(
      "https://catalog.example.edu/courses/1#details",
      context.approvedDomains,
    ).href,
    "https://catalog.example.edu/courses/1",
  );
  assert.throws(() =>
    assertTrustedCatalogUrl("https://example.edu.attacker.invalid/course", ["example.edu"]),
  );
  assert.throws(() =>
    assertAllowedRedirect(
      new URL("https://catalog.example.edu/course"),
      "https://aggregator.invalid/course",
      context.approvedDomains,
    ),
  );
});

test("private, loopback and cloud metadata destinations are blocked", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "192.0.2.10",
    "198.51.100.20",
    "203.0.113.30",
    "::1",
    "fc00::1",
    "ff02::1",
  ]) {
    assert.equal(isPrivateIpAddress(address), true);
  }
  assert.throws(() => assertSafeResolvedAddresses(["93.184.216.34", "10.0.0.1"]));
  assert.throws(() =>
    assertTrustedCatalogUrl("https://169.254.169.254/latest/meta-data", ["169.254.169.254"]),
  );
});

test("robots rules use longest match, honor allow, and preserve crawl delay", () => {
  const robots = `
User-agent: *
Disallow: /private/
Allow: /private/catalog/
Crawl-delay: 2
`;
  const allowed = evaluateRobotsTxt(
    robots,
    new URL("https://catalog.example.edu/private/catalog/course"),
  );
  const denied = evaluateRobotsTxt(
    robots,
    new URL("https://catalog.example.edu/private/account"),
  );
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.crawlDelaySeconds, 2);
  assert.equal(denied.allowed, false);
});

test("official sitemap parsing is bounded to approved course-like URLs", async () => {
  const candidates = parseOfficialSitemap(
    context,
    source(await fixture("official-sitemap.xml"), "sitemap"),
  );
  assert.deepEqual(
    candidates.map((candidate) => candidate.url),
    [
      "https://catalog.example.edu/courses/BIO-101",
      "https://catalog.example.edu/modules/CHEM-100",
    ],
  );
});

test("Schema.org Course and CourseInstance fields are validated and normalized", async () => {
  const candidates = parseSchemaOrgCourses(
    source(await fixture("schema-org-course.html"), "structured_data"),
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.courseCode, "BIO-101");
  assert.equal(candidates[0]?.credits, 6);
  assert.equal(candidates[0]?.academicYear, "2026–2027");
  assert.equal(candidates[0]?.professorName, "Dr Example");
  assert.ok(candidates[0]?.evidence.some((item) => item.field === "coursePrerequisites"));
});

test("malformed structured data is ignored without manufacturing a candidate", () => {
  const candidates = parseSchemaOrgCourses(
    source(`<script type="application/ld+json">{"@type":"Course",</script>`, "structured_data"),
  );
  assert.deepEqual(candidates, []);
});

test("response size limits reject both declared and streamed excess", () => {
  assert.doesNotThrow(() => assertCatalogResponseSize(999, null, 1_000));
  assert.throws(() => assertCatalogResponseSize(1_001, null, 1_000));
  assert.throws(() => assertCatalogResponseSize(0, 1_001, 1_000));
});

test("scan checkpoints and counters advance exactly once per source", () => {
  const initial = {
    checkpoint: {},
    pagesInspected: 0,
    unitsFound: 0,
    programmesFound: 0,
    coursesFound: 0,
    warnings: [],
  };
  const first = advanceCatalogProgress(initial, "source-1", {
    units: 1,
    programmes: 2,
    courses: 3,
  });
  assert.equal(first.applied, true);
  const replay = advanceCatalogProgress(first.state, "source-1", {
    units: 1,
    programmes: 2,
    courses: 3,
  });
  assert.equal(replay.applied, false);
  assert.equal(replay.state.coursesFound, 3);
});

test("deduplication and candidate matching require exact stable evidence", async () => {
  const [candidate] = parseSchemaOrgCourses(
    source(await fixture("schema-org-course.html"), "structured_data"),
  );
  assert.ok(candidate);
  const duplicate = { ...candidate, confidence: 0.99 } satisfies CourseCandidate;
  assert.equal(
    deduplicateCourseCandidates(context.organizationId, [candidate, duplicate]).length,
    1,
  );
  const matches = matchCandidateToExistingCourses(context.organizationId, candidate, [
    {
      id: "course-1",
      organizationId: context.organizationId,
      courseCode: "BIO 101",
      localName: "Unrelated display name",
      programmeName: null,
      academicYear: "2026–2027",
    },
  ]);
  assert.equal(matches[0]?.coursePageId, "course-1");
  assert.deepEqual(
    matchCandidateToExistingCourses(context.organizationId, candidate, [
      {
        id: "course-2",
        organizationId: context.organizationId,
        courseCode: null,
        localName: "Foundations of Cellular Biology",
        programmeName: null,
        academicYear: "2026–2027",
      },
    ]),
    [],
  );
});

test("stale detection is deterministic and no candidate auto-publishes", () => {
  const now = new Date("2026-08-03T12:00:00.000Z");
  assert.equal(isCatalogSourceStale("2026-08-02T12:00:00.000Z", now), false);
  assert.equal(isCatalogSourceStale("2026-06-01T12:00:00.000Z", now), true);
  assert.equal(canAutoPublishCatalogCandidate(), false);
});

test("official metadata changes produce an explicit owner review payload", () => {
  const changes = catalogMetadataChanges(
    {
      courseCode: "BIO-101",
      professorName: "Dr Example",
      academicYear: "2026/27",
      communityNote: "never compare this field",
    },
    {
      courseCode: "BIO-101",
      professorName: "Dr Updated",
      academicYear: "2027/28",
      communityNote: "do not overwrite community curriculum",
    },
  );
  assert.deepEqual(
    changes.map((change) => change.field),
    ["academicYear", "professorName"],
  );
  assert.equal(changes.some((change) => change.field === "communityNote"), false);
});
