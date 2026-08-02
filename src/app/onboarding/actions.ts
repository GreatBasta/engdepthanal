"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import {
  enrollments,
  programs,
  universityPrograms,
} from "@/lib/db/schema";
import { persistOrganizationSelection } from "@/lib/organizations/persistence";
import { organizationResultSchema } from "@/lib/organizations/schema";

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

function parseOrganizationSelection(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = organizationResultSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Onboarding: the student names their university and course; if the
 * university is not in the database yet, it is added (as `unverified` —
 * see STRUCTURE.md §5.4: unverified entries never pollute aggregates).
 * Creates the enrollment that unlocks the first-year database.
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

  const [program] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(eq(programs.slug, programSlug))
    .limit(1);
  if (!program) return { error: "Unknown course — please pick from the list." };

  const organizationId = await persistOrganizationSelection(organization);

  // Resolve or add the university × program pair.
  let [uniProgram] = await db
    .select({ id: universityPrograms.id })
    .from(universityPrograms)
    .where(
      and(
        eq(universityPrograms.universityId, organizationId),
        eq(universityPrograms.programId, program.id),
      ),
    )
    .limit(1);
  uniProgram ??= (
    await db
      .insert(universityPrograms)
      .values({
        universityId: organizationId,
        programId: program.id,
        status: organization.verified ? "verified" : "unverified",
      })
      .returning({ id: universityPrograms.id })
  )[0];

  await db.transaction(async (tx) => {
    await tx
      .update(enrollments)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(eq(enrollments.studentId, studentId));
    await tx
      .insert(enrollments)
      .values({
        studentId,
        universityProgramId: uniProgram.id,
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
