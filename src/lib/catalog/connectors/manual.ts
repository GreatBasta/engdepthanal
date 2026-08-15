import { load } from "cheerio";
import { z } from "zod";

import {
  normalizedCatalogResultSchema,
  type ExtractedEvidence,
  type OfficialCatalogConnector,
  type SourceEvidence,
} from "../types";
import { normalizeCatalogText, normalizeCourseCandidate } from "../normalize";

export const manualConnectorConfigSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  organizationRorId: z.string().min(1),
  sourceUrls: z.array(z.string().url()).min(1),
  course: z.object({
    item: z.string().min(1),
    name: z.string().min(1),
    code: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    credits: z.string().min(1).optional(),
    language: z.string().min(1).optional(),
    department: z.string().min(1).optional(),
    programme: z.string().min(1).optional(),
    academicYear: z.string().min(1).optional(),
    semester: z.string().min(1).optional(),
    professor: z.string().min(1).optional(),
    campus: z.string().min(1).optional(),
    url: z.string().min(1).optional(),
    externalIdAttribute: z.string().min(1).optional(),
  }),
});

export type ManualConnectorConfig = z.infer<typeof manualConnectorConfigSchema>;

function selectedText(
  root: ReturnType<typeof load>,
  element: Parameters<ReturnType<typeof load>>[0] | never,
  selector: string | undefined,
) {
  if (!selector) return null;
  const value = normalizeCatalogText(root(element as never).find(selector).first().text());
  return value || null;
}

export function createManualCatalogConnector(
  rawConfig: ManualConnectorConfig,
): OfficialCatalogConnector {
  const config = manualConnectorConfigSchema.parse(rawConfig);
  const connectorId = `manual-${config.id}`;

  function parse(source: SourceEvidence) {
    const $ = load(source.body);
    const courses = $(config.course.item)
      .map((_index, element) => {
        const name = selectedText($, element as never, config.course.name);
        if (!name) return null;
        const code = selectedText($, element as never, config.course.code);
        const creditsText = selectedText($, element as never, config.course.credits);
        const creditsMatch = creditsText?.replace(",", ".").match(/\d+(?:\.\d+)?/);
        const credits = creditsMatch ? Number(creditsMatch[0]) : null;
        const programme = selectedText($, element as never, config.course.programme);
        const urlValue = config.course.url
          ? $(element).find(config.course.url).first().attr("href")
          : null;
        const officialUrl = urlValue
          ? new URL(urlValue, source.sourceUrl).href
          : source.sourceUrl;
        const evidence: ExtractedEvidence[] = [
          {
            field: "name",
            value: name,
            sourceUrl: source.sourceUrl,
            signal: "approved institution connector",
            selector: config.course.name,
          },
        ];
        if (code) {
          evidence.push({
            field: "courseCode",
            value: code,
            sourceUrl: source.sourceUrl,
            signal: "approved institution connector",
            selector: config.course.code,
          });
        }
        return normalizeCourseCandidate(
          {
            externalSourceId: config.course.externalIdAttribute
              ? $(element).attr(config.course.externalIdAttribute) ?? null
              : null,
            courseCode: code,
            canonicalSourceName: name,
            localDisplayName: name,
            description: selectedText($, element as never, config.course.description),
            credits: Number.isFinite(credits) ? credits : null,
            languageCodes: selectedText($, element as never, config.course.language)
              ? [selectedText($, element as never, config.course.language)!]
              : [],
            department: selectedText($, element as never, config.course.department),
            degreeProgramme: programme,
            programmeExternalSourceId: null,
            academicYear: selectedText($, element as never, config.course.academicYear),
            semester: selectedText($, element as never, config.course.semester),
            professorName: selectedText($, element as never, config.course.professor),
            campus: selectedText($, element as never, config.course.campus),
            officialUrl,
            sourceUpdatedAt: null,
            evidence,
          },
          source,
          {
            officialDomain: true,
            sourceType: "manual",
            currentAcademicYear: null,
          },
        );
      })
      .get()
      .filter((item) => item !== null);
    return normalizedCatalogResultSchema.parse({ courses });
  }

  return {
    id: connectorId,
    async canHandle(context, source) {
      return context.rorId === config.organizationRorId && source?.connectorId === connectorId;
    },
    async discoverCatalogSources(context) {
      if (context.rorId !== config.organizationRorId) return [];
      return config.sourceUrls.map((url) => ({
        url,
        sourceType: "manual" as const,
        connectorId,
        discoveredFrom: context.officialWebsiteUrl,
        config: {},
      }));
    },
    async discoverOrganizationalUnits() {
      return [];
    },
    async discoverProgrammes() {
      return [];
    },
    async discoverCourses(_context, _programmes, evidence) {
      return parse(evidence).courses;
    },
    async normalize(evidence) {
      return parse(evidence);
    },
  };
}

/**
 * Institution-specific connectors are code-reviewed configuration, never
 * user-supplied selectors. Add entries only after confirming the official
 * ROR ID, domain boundary and stable visible markup.
 */
export const configuredInstitutionConnectors: OfficialCatalogConnector[] = [];
