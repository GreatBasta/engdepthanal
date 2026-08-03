import { normalizeWithCatalogConnectors } from "./connectors";
import { checkRobotsPermission, fetchSourceEvidence } from "./fetch";
import {
  finishCatalogScan,
  getCatalogSourceExecution,
  getOrganizationCatalogContext,
  nextCatalogSource,
  persistCatalogResult,
  persistDiscoveredCatalogSources,
  prepareCatalogScan,
  recordCatalogRobotsResult,
  recordCatalogSourceFailure,
  recordCatalogSourceSuccess,
} from "./repository";
import type { CatalogSourceCandidate } from "./types";

export async function processCatalogSource(scanId: string, sourceId: string) {
  const execution = await getCatalogSourceExecution(scanId, sourceId);
  const context = await getOrganizationCatalogContext(execution.organizationId);
  const robots = await checkRobotsPermission(execution.sourceUrl, {
    approvedDomains: context.approvedDomains,
    userAgent: context.crawlerUserAgent,
    limits: context.limits,
  });
  await recordCatalogRobotsResult(sourceId, robots);
  if (!robots.allowed) {
    await recordCatalogSourceFailure({
      scanId,
      sourceId,
      message:
        robots.status === "disallowed"
          ? `robots.txt disallows ${new URL(execution.sourceUrl).pathname}`
          : "robots.txt could not be verified; source skipped fail-closed",
    });
    return { delayMs: robots.crawlDelayMs };
  }

  try {
    const evidence = await fetchSourceEvidence(
      execution.sourceUrl,
      execution.sourceType,
      {
        approvedDomains: context.approvedDomains,
        userAgent: context.crawlerUserAgent,
        limits: context.limits,
        etag: execution.httpEtag,
        lastModified: execution.httpLastModified,
      },
    );
    if ("notModified" in evidence) {
      await recordCatalogSourceSuccess({
        scanId,
        sourceId,
        notModified: true,
        progress: { units: 0, programmes: 0, courses: 0 },
      });
      return { delayMs: robots.crawlDelayMs };
    }
    if (
      execution.contentChecksum &&
      execution.contentChecksum === evidence.checksum
    ) {
      await recordCatalogSourceSuccess({
        scanId,
        sourceId,
        evidence,
        progress: { units: 0, programmes: 0, courses: 0 },
      });
      return { delayMs: robots.crawlDelayMs };
    }

    const source: CatalogSourceCandidate = {
      url: execution.sourceUrl,
      sourceType: execution.sourceType,
      connectorId: execution.connectorId,
      discoveredFrom: null,
      config: execution.connectorConfig,
    };
    const normalized = await normalizeWithCatalogConnectors(
      context,
      source,
      evidence,
    );
    await persistDiscoveredCatalogSources(context, normalized.sources);
    const progress = await persistCatalogResult({
      scanId,
      sourceId,
      organizationId: context.organizationId,
      source: evidence,
      result: normalized,
    });
    await recordCatalogSourceSuccess({
      scanId,
      sourceId,
      evidence,
      progress: { ...progress, warnings: normalized.warnings },
    });
    return { delayMs: robots.crawlDelayMs };
  } catch (error) {
    const message = error instanceof Error ? error.message : "catalog source failed";
    await recordCatalogSourceFailure({ scanId, sourceId, message });
    return { delayMs: robots.crawlDelayMs };
  }
}

/**
 * Fail-safe for deployments without a Workflow provider. It processes at most
 * one persisted source per request and leaves the scan resumable.
 */
export async function runBoundedCatalogScanBatch(scanId: string) {
  const prepared = await prepareCatalogScan(scanId);
  const sourceId = await nextCatalogSource(scanId, prepared.nextSourceIndex);
  if (!sourceId) return { finished: await finishCatalogScan(scanId) };
  const result = await processCatalogSource(scanId, sourceId);
  const next = await nextCatalogSource(scanId, prepared.nextSourceIndex + 1);
  if (!next) return { result, finished: await finishCatalogScan(scanId) };
  return { result, finished: null };
}
