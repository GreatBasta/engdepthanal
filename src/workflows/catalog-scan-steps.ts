import {
  finishCatalogScan,
  nextCatalogSource,
  prepareCatalogScan,
} from "@/lib/catalog/repository";
import { processCatalogSource } from "@/lib/catalog/scan-runner";

export async function prepareCatalogScanStep(scanId: string) {
  "use step";
  return prepareCatalogScan(scanId);
}

export async function nextCatalogSourceStep(scanId: string, index: number) {
  "use step";
  return nextCatalogSource(scanId, index);
}

export async function processCatalogSourceStep(
  scanId: string,
  sourceId: string,
) {
  "use step";
  return processCatalogSource(scanId, sourceId);
}

export async function finishCatalogScanStep(scanId: string) {
  "use step";
  return finishCatalogScan(scanId);
}
