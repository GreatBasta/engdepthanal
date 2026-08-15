import { load } from "cheerio";

import {
  catalogSourceCandidateSchema,
  normalizedCatalogResultSchema,
  type CatalogSourceCandidate,
  type OfficialCatalogConnector,
  type OrganizationContext,
  type SourceEvidence,
} from "../types";
import { assertTrustedCatalogUrl } from "../policy";

const COURSE_PATH_SIGNAL =
  /\/(course|courses|module|modules|insegnament|offerta-formativa|catalog|study-unit|unit|syllabus)(?:\/|[-_])/i;

export function parseOfficialSitemap(
  context: OrganizationContext,
  evidence: SourceEvidence,
): CatalogSourceCandidate[] {
  const $ = load(evidence.body, { xmlMode: true });
  const nested = $("sitemap > loc")
    .map((_index, element) => $(element).text().trim())
    .get();
  const pages = $("url > loc")
    .map((_index, element) => $(element).text().trim())
    .get();

  const candidates = [
    ...nested.map((url) => ({ url, sourceType: "sitemap" as const })),
    ...pages
      .filter((url) => {
        try {
          return COURSE_PATH_SIGNAL.test(new URL(url).pathname);
        } catch {
          return false;
        }
      })
      .map((url) => ({ url, sourceType: "official_catalog" as const })),
  ];
  const seen = new Set<string>();
  return candidates.flatMap((candidate) => {
    try {
      const trusted = assertTrustedCatalogUrl(candidate.url, context.approvedDomains);
      if (seen.has(trusted.href)) return [];
      seen.add(trusted.href);
      return [
        catalogSourceCandidateSchema.parse({
          url: trusted.href,
          sourceType: candidate.sourceType,
          connectorId:
            candidate.sourceType === "sitemap"
              ? "official-sitemap-v1"
              : "semantic-html-catalog-v1",
          discoveredFrom: evidence.sourceUrl,
          config: {},
        }),
      ];
    } catch {
      return [];
    }
  }).slice(0, context.limits.maxPages);
}

export const sitemapConnector: OfficialCatalogConnector = {
  id: "official-sitemap-v1",
  async canHandle(_context, source) {
    return source?.sourceType === "sitemap";
  },
  async discoverCatalogSources(context, evidence) {
    if (!evidence) {
      const base = context.officialWebsiteUrl;
      if (!base) return [];
      const origin = new URL(base).origin;
      return ["/sitemap.xml", "/sitemap_index.xml"].map((path) => ({
        url: new URL(path, origin).href,
        sourceType: "sitemap" as const,
        connectorId: "official-sitemap-v1",
        discoveredFrom: base,
        config: {},
      }));
    }
    return parseOfficialSitemap(context, evidence);
  },
  async discoverOrganizationalUnits() {
    return [];
  },
  async discoverProgrammes() {
    return [];
  },
  async discoverCourses() {
    return [];
  },
  async normalize(evidence) {
    return normalizedCatalogResultSchema.parse({
      warnings: evidence.body.includes("<loc")
        ? []
        : ["Sitemap contained no URL locations."],
    });
  },
};
