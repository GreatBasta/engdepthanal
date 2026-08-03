"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { start } from "workflow/api";

import { currentStudentId } from "@/auth";
import { currentAdmin } from "@/lib/admin";
import {
  attachCatalogWorkflowRun,
  createCatalogScanRequest,
} from "@/lib/catalog/repository";
import {
  addApprovedCatalogSource,
  approveCatalogDomain,
  confirmCatalogCandidate,
  mergeCatalogCandidateWithCourse,
  rejectCatalogCandidate,
  reviewCandidateCorrection,
  setCatalogConnectorActive,
} from "@/lib/catalog/review";
import { runBoundedCatalogScanBatch } from "@/lib/catalog/scan-runner";
import { catalogSourceTypes } from "@/lib/catalog/types";
import { officialCatalogScanWorkflow } from "@/workflows/catalog-scan";

const uuid = z.string().uuid();

async function requireAdminId() {
  const [admin, studentId] = await Promise.all([
    currentAdmin(),
    currentStudentId(),
  ]);
  if (!admin || !studentId) throw new Error("not authorized");
  return studentId;
}

function refreshCatalogAdmin() {
  revalidatePath("/admin/catalog");
  revalidatePath("/admin");
  revalidatePath("/courses");
}

export async function approveCatalogDomainAction(formData: FormData) {
  const reviewerId = await requireAdminId();
  const input = z
    .object({
      organizationId: uuid,
      domain: z.string().trim().min(3).max(253),
      evidenceUrl: z.string().url().max(1_000),
    })
    .parse(Object.fromEntries(formData));
  await approveCatalogDomain({ ...input, reviewerId });
  refreshCatalogAdmin();
}

export async function addCatalogSourceAction(formData: FormData) {
  await requireAdminId();
  const input = z
    .object({
      organizationId: uuid,
      sourceUrl: z.string().url().max(1_000),
      sourceType: z.enum(catalogSourceTypes).exclude(["official_pdf", "manual"]),
    })
    .parse(Object.fromEntries(formData));
  const connectorIds = {
    official_api: "official-api-v1",
    structured_data: "schema-org-course-v1",
    sitemap: "official-sitemap-v1",
    official_catalog: "semantic-html-catalog-v1",
  } as const;
  await addApprovedCatalogSource({
    organizationId: input.organizationId,
    source: {
      url: input.sourceUrl,
      sourceType: input.sourceType,
      connectorId: connectorIds[input.sourceType],
      discoveredFrom: null,
      config: {},
    },
  });
  refreshCatalogAdmin();
}

export async function setCatalogConnectorActiveAction(formData: FormData) {
  await requireAdminId();
  const input = z
    .object({
      organizationId: uuid,
      connectorId: z.string().trim().min(1).max(200),
      active: z.enum(["true", "false"]),
    })
    .parse(Object.fromEntries(formData));
  await setCatalogConnectorActive({
    organizationId: input.organizationId,
    connectorId: input.connectorId,
    active: input.active === "true",
  });
  refreshCatalogAdmin();
}

export async function retryCatalogScanAction(formData: FormData) {
  const reviewerId = await requireAdminId();
  const organizationId = uuid.parse(formData.get("organizationId"));
  const request = await createCatalogScanRequest({
    organizationId,
    requestedBy: reviewerId,
    force: true,
  });
  if (request.created) {
    try {
      const run = await start(officialCatalogScanWorkflow, [request.scan.id], {
        deploymentId: "latest",
      });
      await attachCatalogWorkflowRun(request.scan.id, run.runId);
    } catch {
      await runBoundedCatalogScanBatch(request.scan.id);
    }
  }
  refreshCatalogAdmin();
}

export async function reviewCatalogCandidateAction(formData: FormData) {
  const reviewerId = await requireAdminId();
  const input = z
    .object({ candidateId: uuid, decision: z.enum(["confirm", "reject"]) })
    .parse(Object.fromEntries(formData));
  if (input.decision === "confirm") {
    await confirmCatalogCandidate({
      candidateId: input.candidateId,
      reviewerId,
      method: "admin",
    });
  } else {
    await rejectCatalogCandidate({ candidateId: input.candidateId, reviewerId });
  }
  refreshCatalogAdmin();
}

export async function mergeCatalogCandidateAction(formData: FormData) {
  const reviewerId = await requireAdminId();
  const input = z
    .object({ candidateId: uuid, coursePageId: uuid })
    .parse(Object.fromEntries(formData));
  await mergeCatalogCandidateWithCourse({ ...input, reviewerId });
  refreshCatalogAdmin();
}

export async function reviewCatalogCorrectionAction(formData: FormData) {
  const reviewerId = await requireAdminId();
  const input = z
    .object({ correctionId: uuid, decision: z.enum(["accept", "reject"]) })
    .parse(Object.fromEntries(formData));
  await reviewCandidateCorrection({
    correctionId: input.correctionId,
    reviewerId,
    accepted: input.decision === "accept",
  });
  refreshCatalogAdmin();
}
