import { createHash } from "node:crypto";

import {
  courseCandidateSchema,
  extractedEvidenceSchema,
  type CourseCandidate,
  type ExtractedEvidence,
  type SourceEvidence,
} from "./types";

export function normalizeCatalogText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCourseName(value: string) {
  return normalizeCatalogText(value)
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function normalizeCourseCode(value: string | null | undefined) {
  const normalized = normalizeCatalogText(value)
    .toLocaleUpperCase("en")
    .replace(/[^A-Z0-9]+/g, "");
  return normalized || null;
}

export function canonicalCatalogUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  }
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  return url.href;
}

export function fallbackCourseDedupKey(candidate: {
  canonicalSourceName: string;
  degreeProgramme: string | null;
  academicYear: string | null;
}) {
  return createHash("sha256")
    .update(
      [
        normalizeCourseName(candidate.canonicalSourceName),
        normalizeCourseName(candidate.degreeProgramme ?? ""),
        normalizeCatalogText(candidate.academicYear).toLocaleLowerCase("en"),
      ].join("\u0000"),
    )
    .digest("hex");
}

export interface ConfidenceExplanation {
  score: number;
  signals: Array<{ signal: string; weight: number; present: boolean }>;
}

export function calculateCourseConfidence(
  candidate: Omit<CourseCandidate, "confidence">,
  options: {
    officialDomain: boolean;
    sourceType: SourceEvidence["sourceType"];
    currentAcademicYear?: string | null;
    agreeingOfficialSources?: number;
  },
): ConfidenceExplanation {
  const signals = [
    { signal: "official organization domain", weight: 0.24, present: options.officialDomain },
    { signal: "official structured API", weight: 0.2, present: options.sourceType === "official_api" },
    { signal: "Schema.org Course data", weight: 0.16, present: options.sourceType === "structured_data" },
    { signal: "explicit course code", weight: 0.12, present: Boolean(candidate.courseCode) },
    { signal: "explicit credits", weight: 0.08, present: candidate.credits !== null },
    { signal: "programme association", weight: 0.1, present: Boolean(candidate.degreeProgramme || candidate.programmeExternalSourceId) },
    {
      signal: "current academic year",
      weight: 0.06,
      present: Boolean(
        candidate.academicYear &&
          options.currentAcademicYear &&
          candidate.academicYear === options.currentAcademicYear,
      ),
    },
    { signal: "multiple official sources agree", weight: 0.1, present: (options.agreeingOfficialSources ?? 1) > 1 },
    { signal: "explicit description", weight: 0.03, present: Boolean(candidate.description) },
    { signal: "explicit language", weight: 0.02, present: candidate.languageCodes.length > 0 },
  ];
  let score = 0.08;
  for (const signal of signals) if (signal.present) score += signal.weight;
  if (!candidate.courseCode) score -= 0.06;
  if (!candidate.degreeProgramme && !candidate.programmeExternalSourceId) score -= 0.05;
  return { score: Math.max(0, Math.min(1, Number(score.toFixed(3)))), signals };
}

export function normalizedEvidence(
  items: readonly ExtractedEvidence[],
): ExtractedEvidence[] {
  const seen = new Set<string>();
  const output: ExtractedEvidence[] = [];
  for (const item of items) {
    const normalized = extractedEvidenceSchema.parse({
      ...item,
      value: normalizeCatalogText(item.value).slice(0, 1_000),
      sourceUrl: canonicalCatalogUrl(item.sourceUrl),
    });
    const key = `${normalized.field}\u0000${normalized.value}\u0000${normalized.sourceUrl}`;
    if (!seen.has(key)) {
      seen.add(key);
      output.push(normalized);
    }
  }
  return output;
}

export function normalizeCourseCandidate(
  input: Omit<CourseCandidate, "confidence"> & { confidence?: number },
  source: SourceEvidence,
  options: Parameters<typeof calculateCourseConfidence>[1],
): CourseCandidate {
  const courseCode = normalizeCatalogText(input.courseCode) || null;
  const canonicalSourceName = normalizeCatalogText(input.canonicalSourceName);
  const description = normalizeCatalogText(input.description).slice(0, 2_000) || null;
  const evidence = normalizedEvidence(input.evidence);
  const candidate = {
    ...input,
    externalSourceId: normalizeCatalogText(input.externalSourceId) || null,
    courseCode,
    canonicalSourceName,
    localDisplayName: normalizeCatalogText(input.localDisplayName) || null,
    description,
    languageCodes: [...new Set(input.languageCodes.map((value) => normalizeCatalogText(value).toLowerCase()))],
    department: normalizeCatalogText(input.department) || null,
    degreeProgramme: normalizeCatalogText(input.degreeProgramme) || null,
    programmeExternalSourceId:
      normalizeCatalogText(input.programmeExternalSourceId) || null,
    academicYear: normalizeCatalogText(input.academicYear) || null,
    semester: normalizeCatalogText(input.semester) || null,
    professorName: normalizeCatalogText(input.professorName) || null,
    campus: normalizeCatalogText(input.campus) || null,
    officialUrl: canonicalCatalogUrl(input.officialUrl || source.sourceUrl),
    sourceUpdatedAt: input.sourceUpdatedAt,
    evidence,
    confidence: 0,
  };
  const explanation = calculateCourseConfidence(candidate, options);
  return courseCandidateSchema.parse({
    ...candidate,
    confidence:
      input.confidence === undefined
        ? explanation.score
        : Math.min(explanation.score, input.confidence),
  });
}

export function candidateIdentityKeys(
  organizationId: string,
  candidate: CourseCandidate,
) {
  const code = normalizeCourseCode(candidate.courseCode);
  const officialUrl = canonicalCatalogUrl(candidate.officialUrl);
  return [
    candidate.externalSourceId
      ? { priority: 1, key: `${organizationId}:external:${candidate.externalSourceId}` }
      : null,
    code
      ? { priority: 2, key: `${organizationId}:code:${code}:${candidate.academicYear ?? ""}` }
      : null,
    { priority: 3, key: `${organizationId}:url:${officialUrl}:${candidate.academicYear ?? ""}` },
    {
      priority: 4,
      key: `${organizationId}:fallback:${fallbackCourseDedupKey(candidate)}`,
    },
  ].filter((item): item is { priority: number; key: string } => item !== null);
}

export function deduplicateCourseCandidates(
  organizationId: string,
  candidates: readonly CourseCandidate[],
) {
  const seen = new Map<string, CourseCandidate>();
  const output: CourseCandidate[] = [];
  for (const candidate of candidates) {
    const existing = candidateIdentityKeys(organizationId, candidate)
      .map((identity) => seen.get(identity.key))
      .find(Boolean);
    if (!existing) {
      output.push(candidate);
      for (const identity of candidateIdentityKeys(organizationId, candidate)) {
        seen.set(identity.key, candidate);
      }
      continue;
    }
    existing.evidence = normalizedEvidence([...existing.evidence, ...candidate.evidence]);
    existing.confidence = Math.max(existing.confidence, candidate.confidence);
  }
  return output;
}

export interface ExistingCourseForMatch {
  id: string;
  organizationId: string;
  courseCode: string | null;
  localName: string;
  programmeName: string | null;
  academicYear: string | null;
}

export function matchCandidateToExistingCourses(
  organizationId: string,
  candidate: CourseCandidate,
  courses: readonly ExistingCourseForMatch[],
) {
  const candidateCode = normalizeCourseCode(candidate.courseCode);
  const candidateFallback = fallbackCourseDedupKey(candidate);
  return courses.flatMap((course) => {
    if (course.organizationId !== organizationId) return [];
    const exactCode =
      candidateCode !== null &&
      candidateCode === normalizeCourseCode(course.courseCode) &&
      candidate.academicYear === course.academicYear;
    const exactFallback =
      candidateFallback ===
      fallbackCourseDedupKey({
        canonicalSourceName: course.localName,
        degreeProgramme: course.programmeName,
        academicYear: course.academicYear,
      });
    if (!exactCode && !exactFallback) return [];
    return [
      {
        coursePageId: course.id,
        score: exactCode ? 0.98 : 0.84,
        reasons: exactCode
          ? ["same organization, exact course code and academic year"]
          : ["same organization, exact normalized name, programme and academic year"],
      },
    ];
  });
}

export function isCatalogSourceStale(
  lastSuccessfulScanAt: Date | string | null,
  now = new Date(),
  freshnessMs = 30 * 24 * 60 * 60 * 1_000,
) {
  if (!lastSuccessfulScanAt) return true;
  const last = new Date(lastSuccessfulScanAt).getTime();
  return !Number.isFinite(last) || now.getTime() - last >= freshnessMs;
}

/** Catalog evidence always requires review before a collaborative page exists. */
export function canAutoPublishCatalogCandidate() {
  return false;
}
