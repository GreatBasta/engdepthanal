"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import { enrollments } from "@/lib/db/schema";
import { persistOrganizationProgramSelection } from "@/lib/organizations/persistence";
import { parseOrganizationSelection } from "@/lib/organizations/schema";

export interface OnboardingFormState {
  error: string | null;
}

const onboardingSchema = z.object({
  programSlug: z.string().trim().min(1, "Please pick your course"),
  intakeYear: z.coerce
    .number()
    .int()
    .min(2000, "Please pick your intake year")
    .max(2100),
  phase: z.enum(["starting", "attending"], {
    message: "Please tell us whether you are starting or attending",
  }),
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
    programSlug: formData.get("programSlug"),
    intakeYear: formData.get("intakeYear"),
    phase: formData.get("phase"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { programSlug, intakeYear, phase } = parsed.data;

  let selection: Awaited<
    ReturnType<typeof persistOrganizationProgramSelection>
  >;
  try {
    selection = await persistOrganizationProgramSelection(
      organization,
      programSlug,
    );
  } catch {
    return { error: "Unknown degree program — please pick from the list." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(enrollments)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(eq(enrollments.studentId, studentId));
    await tx
      .insert(enrollments)
      .values({
        studentId,
        universityProgramId: selection.universityProgramId,
        intakeYear,
        phase,
        isPrimary: true,
      })
      .onConflictDoUpdate({
        target: [
          enrollments.studentId,
          enrollments.universityProgramId,
          enrollments.intakeYear,
        ],
        set: { phase, isPrimary: true, updatedAt: new Date() },
      });
  });

  redirect("/");
}
