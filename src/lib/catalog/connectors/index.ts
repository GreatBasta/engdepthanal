import { deduplicateCourseCandidates } from "../normalize";
import {
  normalizedCatalogResultSchema,
  type CatalogSourceCandidate,
  type NormalizedCatalogResult,
  type OfficialCatalogConnector,
  type OrganizationContext,
  type SourceEvidence,
} from "../types";
import { htmlCatalogConnector } from "./html-catalog";
import {
  configuredInstitutionConnectors,
  createManualCatalogConnector,
} from "./manual";
import { officialApiConnector } from "./official-api";
import { sitemapConnector } from "./sitemap";
import { structuredDataConnector } from "./structured-data";

export { createManualCatalogConnector };

export const officialCatalogConnectors: OfficialCatalogConnector[] = [
  officialApiConnector,
  sitemapConnector,
  structuredDataConnector,
  htmlCatalogConnector,
  ...configuredInstitutionConnectors,
];

export async function discoverInitialCatalogSources(
  context: OrganizationContext,
) {
  const candidates = (
    await Promise.all(
      officialCatalogConnectors.map((connector) =>
        connector.discoverCatalogSources(context),
      ),
    )
  ).flat();
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.sourceType}:${candidate.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, context.limits.maxSources);
}

export async function normalizeWithCatalogConnectors(
  context: OrganizationContext,
  source: CatalogSourceCandidate,
  evidence: SourceEvidence,
): Promise<NormalizedCatalogResult> {
  const connectors = [];
  for (const connector of officialCatalogConnectors) {
    if (await connector.canHandle(context, source)) connectors.push(connector);
  }
  const results = await Promise.all(
    connectors.map(async (connector) => {
      const [normalized, sources] = await Promise.all([
        connector.normalize(evidence),
        connector.discoverCatalogSources(context, evidence),
      ]);
      return { normalized, sources };
    }),
  );
  return normalizedCatalogResultSchema.parse({
    sources: results.flatMap(({ normalized, sources }) => [
      ...normalized.sources,
      ...sources,
    ]),
    organizationalUnits: results.flatMap(
      ({ normalized }) => normalized.organizationalUnits,
    ),
    programmes: results.flatMap(({ normalized }) => normalized.programmes),
    courses: deduplicateCourseCandidates(
      context.organizationId,
      results.flatMap(({ normalized }) => normalized.courses),
    ),
    warnings: [
      ...new Set(results.flatMap(({ normalized }) => normalized.warnings)),
    ],
  });
}
