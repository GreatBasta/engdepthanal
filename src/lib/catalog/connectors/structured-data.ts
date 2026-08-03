import { load } from "cheerio";

import {
  normalizedCatalogResultSchema,
  type CourseCandidate,
  type ExtractedEvidence,
  type OfficialCatalogConnector,
  type SourceEvidence,
} from "../types";
import { normalizeCatalogText, normalizeCourseCandidate } from "../normalize";
import { hostMatchesApprovedDomain } from "../policy";

type JsonRecord = Record<string, unknown>;

function records(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.flatMap(records);
  if (!value || typeof value !== "object") return [];
  const record = value as JsonRecord;
  return [record, ...records(record["@graph"])];
}

function types(record: JsonRecord) {
  const value = record["@type"];
  return (Array.isArray(value) ? value : [value])
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.toLowerCase());
}

function text(value: unknown): string | null {
  if (typeof value === "string") return normalizeCatalogText(value) || null;
  if (typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return null;
  const record = value as JsonRecord;
  return text(record.name ?? record.value ?? record["@value"] ?? record.description);
}

function url(value: unknown, sourceUrl: string) {
  const raw = typeof value === "string" ? value : text(value);
  if (!raw) return sourceUrl;
  try {
    return new URL(raw, sourceUrl).href;
  } catch {
    return sourceUrl;
  }
}

function number(value: unknown): number | null {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function languages(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((item) => {
    const normalized = text(item);
    return normalized ? [normalized] : [];
  });
}

function evidence(
  source: SourceEvidence,
  field: string,
  value: string | null,
): ExtractedEvidence[] {
  return value
    ? [{ field, value, sourceUrl: source.sourceUrl, signal: "schema.org" }]
    : [];
}

function instanceMetadata(record: JsonRecord) {
  const instances = records(record.hasCourseInstance).filter((item) =>
    types(item).includes("courseinstance"),
  );
  const instance = instances[0] ?? null;
  if (!instance) {
    return {
      academicYear: null,
      semester: null,
      professorName: null,
      campus: null,
      sourceUpdatedAt: null,
      extraEvidence: [] as Array<[string, string | null]>,
    };
  }
  const startDate = text(instance.startDate);
  const endDate = text(instance.endDate);
  const instructor = text(instance.instructor);
  const location = text(instance.location);
  const courseMode = text(instance.courseMode);
  const parsedStartDate = startDate ? Date.parse(startDate) : Number.NaN;
  const academicYear = startDate
    ? `${startDate.slice(0, 4)}${endDate ? `–${endDate.slice(0, 4)}` : ""}`
    : null;
  return {
    academicYear,
    semester: courseMode,
    professorName: instructor,
    campus: location,
    sourceUpdatedAt: Number.isFinite(parsedStartDate)
      ? new Date(parsedStartDate).toISOString()
      : null,
    extraEvidence: [
      ["startDate", startDate],
      ["endDate", endDate],
      ["instructor", instructor],
      ["location", location],
      ["courseMode", courseMode],
    ] as Array<[string, string | null]>,
  };
}

export function parseSchemaOrgCourses(source: SourceEvidence): CourseCandidate[] {
  const $ = load(source.body);
  const jsonRecords: JsonRecord[] = [];
  $("script[type='application/ld+json']").each((_index, element) => {
    const raw = $(element).text().trim();
    if (!raw || raw.length > 1_000_000) return;
    try {
      jsonRecords.push(...records(JSON.parse(raw)));
    } catch {
      // Malformed markup is ignored; the caller records a warning when no
      // valid Course nodes remain.
    }
  });

  return jsonRecords
    .filter((record) => types(record).includes("course"))
    .flatMap((record) => {
      const name = text(record.name);
      if (!name) return [];
      const courseCode = text(record.courseCode);
      const description = text(record.description);
      const credits = number(record.numberOfCredits);
      const prerequisites = text(record.coursePrerequisites);
      const syllabus = text(record.syllabusSections);
      const languageCodes = languages(record.availableLanguage);
      const programme = text(
        record.provider ?? record.offeredBy ?? record.educationalCredentialAwarded,
      );
      const instance = instanceMetadata(record);
      const officialUrl = url(record.url ?? record["@id"], source.sourceUrl);
      const extracted = [
        ...evidence(source, "name", name),
        ...evidence(source, "courseCode", courseCode),
        ...evidence(source, "numberOfCredits", credits === null ? null : String(credits)),
        ...evidence(source, "coursePrerequisites", prerequisites),
        ...evidence(source, "syllabusSections", syllabus),
        ...evidence(source, "availableLanguage", languageCodes.join(", ") || null),
        ...instance.extraEvidence.flatMap(([field, value]) => evidence(source, field, value)),
      ];
      const candidate = normalizeCourseCandidate(
        {
          externalSourceId: text(record["@id"]),
          courseCode,
          canonicalSourceName: name,
          localDisplayName: name,
          description,
          credits,
          languageCodes,
          department: text(record.department),
          degreeProgramme: programme,
          programmeExternalSourceId: null,
          academicYear: instance.academicYear,
          semester: instance.semester,
          professorName: instance.professorName,
          campus: instance.campus,
          officialUrl,
          sourceUpdatedAt: instance.sourceUpdatedAt,
          evidence: extracted,
        },
        source,
        {
          officialDomain: true,
          sourceType: "structured_data",
          currentAcademicYear: null,
        },
      );
      return [candidate];
    });
}

export const structuredDataConnector: OfficialCatalogConnector = {
  id: "schema-org-course-v1",
  async canHandle(context, source) {
    return Boolean(
      source &&
        context.approvedDomains.some((domain) =>
          hostMatchesApprovedDomain(new URL(source.url).hostname, domain),
        ),
    );
  },
  async discoverCatalogSources() {
    return [];
  },
  async discoverOrganizationalUnits() {
    return [];
  },
  async discoverProgrammes() {
    return [];
  },
  async discoverCourses(_context, _programmes, source) {
    return parseSchemaOrgCourses(source);
  },
  async normalize(source) {
    const courses = parseSchemaOrgCourses(source);
    return normalizedCatalogResultSchema.parse({
      courses,
      warnings:
        courses.length || !source.body.includes("application/ld+json")
          ? []
          : ["Structured data was present but no valid Schema.org Course node was accepted."],
    });
  },
};
