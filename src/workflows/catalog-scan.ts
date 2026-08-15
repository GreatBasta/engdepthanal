import { sleep } from "workflow";

import {
  finishCatalogScanStep,
  nextCatalogSourceStep,
  prepareCatalogScanStep,
  processCatalogSourceStep,
} from "./catalog-scan-steps";

/** Pure durable orchestration. Network, parsing and PostgreSQL stay in steps. */
export async function officialCatalogScanWorkflow(scanId: string) {
  "use workflow";

  const prepared = await prepareCatalogScanStep(scanId);
  for (
    let index = prepared.nextSourceIndex;
    index < prepared.maxPages;
    index += 1
  ) {
    const sourceId = await nextCatalogSourceStep(scanId, index);
    if (!sourceId) break;
    const result = await processCatalogSourceStep(scanId, sourceId);
    if (result.delayMs > 0) await sleep(result.delayMs);
  }
  return finishCatalogScanStep(scanId);
}
