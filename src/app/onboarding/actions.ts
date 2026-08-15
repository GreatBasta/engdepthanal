"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { start } from "workflow/api";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import {
  attachCatalogWorkflowRun,
  createCatalogScanRequest,
} from "@/lib/catalog/repository";
import { db } from "@/lib/db/client";
import { enrollments, students } from "@/lib/db/schema";
import { localeCookieName, localeSchema } from "@/lib/i18n/config";
import {
  onboardingProgrammeChoiceSchema,
  onboardingUnitChoiceSchema,
  persistOnboardingProgrammeChoice,
} from "@/lib/onboarding/programmes";
import { parseOrganizationSelection } from "@/lib/organizations/schema";
import { officialCatalogScanWorkflow } from "@/workflows/catalog-scan";

export interface OnboardingFormState {
  error: string | null;
}

const onboardingSchema = z.object({
  programmeChoice: onboardingProgrammeChoiceSchema,
  unitChoice: onboardingUnitChoiceSchema.optional().default(""),
  intakeYear: z.coerce
    .number()
    .int()
    .min(2000, "Please pick your intake year")
    .max(2100),
  phase: z.enum(["starting", "attending"], {
    message: "Please tell us whether you are starting or attending",
  }),
  academicContext: z.string().trim().max(160).optional().default(""),
  requestedProgrammeName: z.string().trim().max(160).optional().default(""),
  preferredLocale: localeSchema,
});

/**
 * Onboarding persists an explicit verified organization selection and creates
 * the primary study context used throughout the application.
 */
export async function completeOnboarding(
  _prev: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");

  const organization = parseOrganizationSelection(
    formData.get("organizationSelection"),
  );
  if (!organization) {
    return { error: "Select a verified university from the search results." };
  }
  const parsed = onboardingSchema.safeParse({
    programmeChoice: formData.get("programmeChoice"),
    unitChoice: formData.get("unitChoice") ?? "",
    intakeYear: formData.get("intakeYear"),
    phase: formData.get("phase"),
    academicContext: formData.get("academicContext") ?? "",
    requestedProgrammeName: formData.get("requestedProgrammeName") ?? "",
    preferredLocale: formData.get("preferredLocale"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const {
    programmeChoice,
    unitChoice,
    intakeYear,
    phase,
    academicContext,
    requestedProgrammeName,
    preferredLocale,
  } = parsed.data;

  let selection: Awaited<
    ReturnType<typeof persistOnboardingProgrammeChoice>
  >;
  try {
    selection = await persistOnboardingProgrammeChoice({
      organization,
      programmeChoice,
      unitChoice,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unknown degree programme — please pick from the list.",
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(students)
      .set({ preferredLocale, updatedAt: new Date() })
      .where(eq(students.id, studentId));
    await tx
      .update(enrollments)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(eq(enrollments.studentId, studentId));
    await tx
      .insert(enrollments)
      .values({
        studentId,
        universityProgramId: selection.universityProgramId,
        organizationalUnitId: selection.organizationalUnitId,
        intakeYear,
        academicContext: academicContext || null,
        requestedProgrammeName: requestedProgrammeName || null,
        phase,
        isPrimary: true,
      })
      .onConflictDoUpdate({
        target: [
          enrollments.studentId,
          enrollments.universityProgramId,
          enrollments.intakeYear,
        ],
        set: {
          organizationalUnitId: selection.organizationalUnitId,
          academicContext: academicContext || null,
          requestedProgrammeName: requestedProgrammeName || null,
          phase,
          isPrimary: true,
          updatedAt: new Date(),
        },
      });
  });

  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, preferredLocale, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // Starting the durable workflow is best-effort and quick. Account setup is
  // already committed and never waits for catalogue crawling or parsing.
  try {
    const request = await createCatalogScanRequest({
      organizationId: selection.organizationId,
      requestedBy: studentId,
    });
    if (request.created) {
      after(async () => {
        try {
          const run = await start(officialCatalogScanWorkflow, [request.scan.id], {
            deploymentId: "latest",
          });
          await attachCatalogWorkflowRun(request.scan.id, run.runId);
        } catch {
          // The queued row is itself a durable checkpoint and Discover can
          // retry the workflow or process one bounded source later.
        }
      });
    }
  } catch {
    // The persisted queued scan can be resumed from Discover when Workflow is
    // temporarily unavailable; onboarding remains successful.
  }

  redirect("/");
}
