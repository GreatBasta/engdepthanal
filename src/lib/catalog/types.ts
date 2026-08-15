import { z } from "zod";

export const catalogSourceTypes = [
  "official_api",
  "structured_data",
  "sitemap",
  "official_catalog",
  "official_pdf",
  "manual",
] as const;

export const sourceEvidenceSchema = z.object({
  sourceUrl: z.string().url(),
  sourceType: z.enum(catalogSourceTypes),
  fetchedAt: z.string().datetime(),
  status: z.number().int().min(100).max(599),
  contentType: z.string(),
  etag: z.string().nullable(),
  lastModified: z.string().nullable(),
  checksum: z.string().min(32),
  body: z.string(),
});

export type SourceEvidence = z.infer<typeof sourceEvidenceSchema>;

export interface OrganizationContext {
  organizationId: string;
  rorId: string | null;
  canonicalName: string;
  verifiedDomains: string[];
  approvedDomains: string[];
  officialWebsiteUrl: string | null;
  locale: string;
  crawlerUserAgent: string;
  limits: CatalogLimits;
}

export interface CatalogLimits {
  maxDepth: number;
  maxPages: number;
  maxResponseBytes: number;
  timeoutMs: number;
  minDelayMs: number;
  maxSources: number;
}

export const DEFAULT_CATALOG_LIMITS: CatalogLimits = {
  maxDepth: 2,
  maxPages: 40,
  maxResponseBytes: 2_000_000,
  timeoutMs: 10_000,
  minDelayMs: 750,
  maxSources: 12,
};

export const catalogSourceCandidateSchema = z.object({
  url: z.string().url(),
  sourceType: z.enum(catalogSourceTypes),
  connectorId: z.string().min(1),
  discoveredFrom: z.string().url().nullable(),
  config: z.record(z.unknown()).default({}),
});
export type CatalogSourceCandidate = z.infer<typeof catalogSourceCandidateSchema>;

export const extractedEvidenceSchema = z.object({
  field: z.string().min(1),
  value: z.string().trim().min(1).max(1_000),
  sourceUrl: z.string().url(),
  signal: z.string().min(1),
  selector: z.string().optional(),
});
export type ExtractedEvidence = z.infer<typeof extractedEvidenceSchema>;

export const organizationalUnitCandidateSchema = z.object({
  externalSourceId: z.string().trim().min(1).nullable(),
  parentExternalSourceId: z.string().trim().min(1).nullable(),
  unitType: z.enum([
    "faculty",
    "school",
    "college",
    "department",
    "institute",
    "division",
    "academy",
    "campus",
    "other",
  ]),
  canonicalSourceName: z.string().trim().min(1).max(300),
  localizedNames: z.record(z.string().trim().min(1).max(300)).default({}),
  officialUrl: z.string().url(),
  evidence: z.array(extractedEvidenceSchema).min(1),
  confidence: z.number().min(0).max(1),
});
export type OrganizationalUnitCandidate = z.infer<typeof organizationalUnitCandidateSchema>;

export const programmeCandidateSchema = z.object({
  externalSourceId: z.string().trim().min(1).nullable(),
  unitExternalSourceId: z.string().trim().min(1).nullable(),
  canonicalSourceName: z.string().trim().min(1).max(300),
  localDisplayName: z.string().trim().min(1).max(300).nullable(),
  degreeLevel: z
    .enum(["bachelor", "master", "single_cycle", "doctoral", "professional", "other"])
    .nullable(),
  academicFieldKeys: z.array(z.string()).default([]),
  languageCodes: z.array(z.string().min(2).max(12)).default([]),
  credits: z.number().nonnegative().max(1_000).nullable(),
  durationYears: z.number().positive().max(20).nullable(),
  officialUrl: z.string().url(),
  evidence: z.array(extractedEvidenceSchema).min(1),
  confidence: z.number().min(0).max(1),
});
export type ProgrammeCandidate = z.infer<typeof programmeCandidateSchema>;

export const courseCandidateSchema = z.object({
  externalSourceId: z.string().trim().min(1).nullable(),
  courseCode: z.string().trim().min(1).max(100).nullable(),
  canonicalSourceName: z.string().trim().min(1).max(500),
  localDisplayName: z.string().trim().min(1).max(500).nullable(),
  description: z.string().trim().min(1).max(2_000).nullable(),
  credits: z.number().nonnegative().max(500).nullable(),
  languageCodes: z.array(z.string().min(2).max(35)).default([]),
  department: z.string().trim().min(1).max(300).nullable(),
  degreeProgramme: z.string().trim().min(1).max(300).nullable(),
  programmeExternalSourceId: z.string().trim().min(1).nullable(),
  academicYear: z.string().trim().min(1).max(40).nullable(),
  semester: z.string().trim().min(1).max(80).nullable(),
  professorName: z.string().trim().min(1).max(300).nullable(),
  campus: z.string().trim().min(1).max(300).nullable(),
  officialUrl: z.string().url(),
  sourceUpdatedAt: z.string().datetime().nullable(),
  evidence: z.array(extractedEvidenceSchema).min(1),
  confidence: z.number().min(0).max(1),
});
export type CourseCandidate = z.infer<typeof courseCandidateSchema>;

export const normalizedCatalogResultSchema = z.object({
  sources: z.array(catalogSourceCandidateSchema).default([]),
  organizationalUnits: z.array(organizationalUnitCandidateSchema).default([]),
  programmes: z.array(programmeCandidateSchema).default([]),
  courses: z.array(courseCandidateSchema).default([]),
  warnings: z.array(z.string()).default([]),
});
export type NormalizedCatalogResult = z.infer<typeof normalizedCatalogResultSchema>;

export interface OfficialCatalogConnector {
  id: string;
  canHandle(
    context: OrganizationContext,
    source?: CatalogSourceCandidate,
  ): Promise<boolean>;
  discoverCatalogSources(
    context: OrganizationContext,
    evidence?: SourceEvidence,
  ): Promise<CatalogSourceCandidate[]>;
  discoverOrganizationalUnits(
    context: OrganizationContext,
    evidence: SourceEvidence,
  ): Promise<OrganizationalUnitCandidate[]>;
  discoverProgrammes(
    context: OrganizationContext,
    units: OrganizationalUnitCandidate[],
    evidence: SourceEvidence,
  ): Promise<ProgrammeCandidate[]>;
  discoverCourses(
    context: OrganizationContext,
    programmes: ProgrammeCandidate[],
    evidence: SourceEvidence,
  ): Promise<CourseCandidate[]>;
  normalize(evidence: SourceEvidence): Promise<NormalizedCatalogResult>;
}
