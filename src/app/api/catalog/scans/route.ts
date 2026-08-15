import { start } from "workflow/api";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import {
  attachCatalogWorkflowRun,
  createCatalogScanRequest,
  getCatalogOverview,
  getOrganizationCatalogContext,
} from "@/lib/catalog/repository";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  runBoundedCatalogScanBatch,
} from "@/lib/catalog/scan-runner";
import { officialCatalogScanWorkflow } from "@/workflows/catalog-scan";

export const runtime = "nodejs";

const organizationQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

const requestSchema = organizationQuerySchema.extend({
  force: z.boolean().optional().default(false),
});

export async function GET(request: Request) {
  const parsed = organizationQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  try {
    await getOrganizationCatalogContext(parsed.data.organizationId);
    return Response.json(await getCatalogOverview(parsed.data.organizationId));
  } catch {
    return Response.json({ error: "organization_not_available" }, { status: 404 });
  }
}

export async function POST(request: Request) {
  const studentId = await currentStudentId();
  if (!studentId) {
    return Response.json({ error: "sign_in_required" }, { status: 401 });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const allowed = await consumeRateLimit({
    action: "official-catalog-refresh",
    identifier: studentId,
    limit: 3,
    windowMinutes: 60,
  });
  if (!allowed) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    await getOrganizationCatalogContext(parsed.data.organizationId);
    const requestResult = await createCatalogScanRequest({
      organizationId: parsed.data.organizationId,
      requestedBy: studentId,
      force: parsed.data.force,
    });
    const { scan } = requestResult;
    let execution: "cached" | "workflow" | "bounded" | "running" =
      requestResult.freshCache ? "cached" : "running";

    if (requestResult.created) {
      try {
        const run = await start(officialCatalogScanWorkflow, [scan.id], {
          deploymentId: "latest",
        });
        await attachCatalogWorkflowRun(scan.id, run.runId);
        execution = "workflow";
      } catch {
        await runBoundedCatalogScanBatch(scan.id);
        execution = "bounded";
      }
    } else if (!requestResult.freshCache && !scan.workflowRunId) {
      await runBoundedCatalogScanBatch(scan.id);
      execution = "bounded";
    }

    return Response.json(
      {
        scanId: scan.id,
        status: scan.status,
        execution,
        freshCache: requestResult.freshCache,
        overview: await getCatalogOverview(parsed.data.organizationId),
      },
      { status: requestResult.created ? 202 : 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "catalog_scan_failed";
    return Response.json({ error: message }, { status: 422 });
  }
}
