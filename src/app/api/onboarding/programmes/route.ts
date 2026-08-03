import { z } from "zod";

import { currentStudentId } from "@/auth";
import { getCurrentLocale } from "@/lib/i18n/server";
import {
  getInstitutionOnboardingOptions,
  organizationIdForOnboardingRead,
} from "@/lib/onboarding/programmes";

export const runtime = "nodejs";

const bodySchema = z.object({ organization: z.unknown() });

export async function POST(request: Request) {
  if (!(await currentStudentId())) {
    return Response.json({ error: "sign_in_required" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const organizationId = await organizationIdForOnboardingRead(
    parsed.data.organization,
  );
  if (!organizationId) {
    // A newly selected ROR organization has no local catalogue yet. Onboarding
    // still exposes the global taxonomy and queues discovery after submit.
    return Response.json({
      organizationId: null,
      programmes: [],
      units: [],
      latestScan: null,
    });
  }
  return Response.json({
    organizationId,
    ...(await getInstitutionOnboardingOptions(
      organizationId,
      await getCurrentLocale(),
    )),
  });
}
