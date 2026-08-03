import {
  normalizedCatalogResultSchema,
  organizationalUnitCandidateSchema,
  programmeCandidateSchema,
  type CourseCandidate,
  type ExtractedEvidence,
  type OfficialCatalogConnector,
  type SourceEvidence,
} from "../types";
import { normalizeCatalogText, normalizeCourseCandidate } from "../normalize";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function arrayAt(root: JsonRecord, names: string[]) {
  for (const name of names) if (Array.isArray(root[name])) return root[name] as unknown[];
  const data = record(root.data);
  if (data) for (const name of names) if (Array.isArray(data[name])) return data[name] as unknown[];
  return [];
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? normalizeCatalogText(String(value)) || null
    : null;
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function strings(value: unknown) {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((item) => (text(item) ? [text(item)!] : []));
}

function evidence(
  source: SourceEvidence,
  field: string,
  value: string | null,
): ExtractedEvidence[] {
  return value
    ? [{ field, value, sourceUrl: source.sourceUrl, signal: "official API field" }]
    : [];
}

function absoluteUrl(value: unknown, sourceUrl: string) {
  const raw = text(value);
  if (!raw) return sourceUrl;
  try {
    return new URL(raw, sourceUrl).href;
  } catch {
    return sourceUrl;
  }
}

function normalizedDate(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

const allowedUnitTypes = new Set([
  "faculty",
  "school",
  "college",
  "department",
  "institute",
  "division",
  "academy",
  "campus",
  "other",
]);

export function parseOfficialApi(source: SourceEvidence) {
  let root: JsonRecord;
  try {
    root = record(JSON.parse(source.body)) ?? {};
  } catch {
    return normalizedCatalogResultSchema.parse({
      warnings: ["Official API response was not valid JSON."],
    });
  }

  const organizationalUnits = arrayAt(root, ["organizationalUnits", "units", "departments"])
    .flatMap((raw) => {
      const item = record(raw);
      const name = text(item?.name ?? item?.title);
      if (!item || !name) return [];
      const officialUrl = absoluteUrl(item.url, source.sourceUrl);
      const rawUnitType = text(item.type)?.toLowerCase() ?? "other";
      return [
        organizationalUnitCandidateSchema.parse({
          externalSourceId: text(item.id ?? item.code),
          parentExternalSourceId: text(item.parentId ?? item.parentCode),
          unitType: allowedUnitTypes.has(rawUnitType) ? rawUnitType : "other",
          canonicalSourceName: name,
          localizedNames: {},
          officialUrl,
          evidence: evidence(source, "name", name),
          confidence: 0.95,
        }),
      ];
    });

  const programmes = arrayAt(root, ["programmes", "programs", "degrees"]).flatMap(
    (raw) => {
      const item = record(raw);
      const name = text(item?.name ?? item?.title);
      if (!item || !name) return [];
      const degreeLevelRaw = text(item.degreeLevel ?? item.level)?.toLowerCase();
      const allowedLevels = new Set([
        "bachelor",
        "master",
        "single_cycle",
        "doctoral",
        "professional",
        "other",
      ]);
      return [
        programmeCandidateSchema.parse({
          externalSourceId: text(item.id ?? item.code),
          unitExternalSourceId: text(item.unitId ?? item.departmentId),
          canonicalSourceName: name,
          localDisplayName: text(item.localName),
          degreeLevel:
            degreeLevelRaw && allowedLevels.has(degreeLevelRaw)
              ? degreeLevelRaw
              : null,
          academicFieldKeys: strings(item.academicFieldKeys ?? item.fields),
          languageCodes: strings(item.languages ?? item.language),
          credits: number(item.credits),
          durationYears: number(item.durationYears),
          officialUrl: absoluteUrl(item.url, source.sourceUrl),
          evidence: evidence(source, "name", name),
          confidence: 0.95,
        }),
      ];
    },
  );

  const courses: CourseCandidate[] = arrayAt(root, ["courses", "modules", "courseUnits"])
    .flatMap((raw) => {
      const item = record(raw);
      const name = text(item?.name ?? item?.title);
      if (!item || !name) return [];
      const code = text(item.code ?? item.courseCode);
      const credits = number(item.credits ?? item.numberOfCredits);
      const programme = text(item.programme ?? item.programName);
      const extracted = [
        ...evidence(source, "name", name),
        ...evidence(source, "courseCode", code),
        ...evidence(source, "credits", credits === null ? null : String(credits)),
        ...evidence(source, "degreeProgramme", programme),
      ];
      return [
        normalizeCourseCandidate(
          {
            externalSourceId: text(item.id ?? item.externalId),
            courseCode: code,
            canonicalSourceName: name,
            localDisplayName: text(item.localName) ?? name,
            description: text(item.description),
            credits,
            languageCodes: strings(item.languages ?? item.language),
            department: text(item.department),
            degreeProgramme: programme,
            programmeExternalSourceId: text(item.programmeId ?? item.programId),
            academicYear: text(item.academicYear ?? item.year),
            semester: text(item.semester ?? item.term),
            professorName: text(item.professor ?? item.instructor),
            campus: text(item.campus ?? item.location),
            officialUrl: absoluteUrl(item.url, source.sourceUrl),
            sourceUpdatedAt: normalizedDate(item.updatedAt),
            evidence: extracted,
            confidence: 1,
          },
          source,
          {
            officialDomain: true,
            sourceType: "official_api",
            currentAcademicYear: null,
          },
        ),
      ];
    });

  return normalizedCatalogResultSchema.parse({
    organizationalUnits,
    programmes,
    courses,
    warnings:
      organizationalUnits.length || programmes.length || courses.length
        ? []
        : ["Official API contained no recognized explicit catalog arrays."],
  });
}

export const officialApiConnector: OfficialCatalogConnector = {
  id: "official-api-v1",
  async canHandle(_context, source) {
    return source?.sourceType === "official_api";
  },
  async discoverCatalogSources() {
    return [];
  },
  async discoverOrganizationalUnits(_context, evidence) {
    return parseOfficialApi(evidence).organizationalUnits;
  },
  async discoverProgrammes(_context, _units, evidence) {
    return parseOfficialApi(evidence).programmes;
  },
  async discoverCourses(_context, _programmes, evidence) {
    return parseOfficialApi(evidence).courses;
  },
  async normalize(evidence) {
    return parseOfficialApi(evidence);
  },
};
