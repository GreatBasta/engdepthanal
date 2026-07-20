"use server";

import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import {
  enrollments,
  programs,
  universities,
  universityPrograms,
} from "@/lib/db/schema";

export interface OnboardingFormState {
  error: string | null;
}

const onboardingSchema = z.object({
  universityName: z
    .string()
    .trim()
    .min(2, "Please enter your university's name")
    .max(200),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .length(2, "Please pick a country"),
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

  const parsed = onboardingSchema.safeParse({
    universityName: formData.get("universityName"),
    countryCode: formData.get("countryCode"),
    programSlug: formData.get("programSlug"),
    intakeYear: formData.get("intakeYear"),
    phase: formData.get("phase"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { universityName, countryCode, programSlug, intakeYear, phase } =
    parsed.data;

  const [program] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(eq(programs.slug, programSlug))
    .limit(1);
  if (!program) return { error: "Unknown course — please pick from the list." };

  // Resolve or add the university (case-insensitive on name + country).
  let [university] = await db
    .select({ id: universities.id })
    .from(universities)
    .where(
      and(
        sql`lower(${universities.name}) = lower(${universityName})`,
        eq(universities.countryCode, countryCode),
      ),
    )
    .limit(1);
  university ??= (
    await db
      .insert(universities)
      .values({
        name: universityName,
        countryCode,
        status: "unverified",
        addedBy: studentId,
      })
      .returning({ id: universities.id })
  )[0];

  // Resolve or add the university × program pair.
  let [uniProgram] = await db
    .select({ id: universityPrograms.id })
    .from(universityPrograms)
    .where(
      and(
        eq(universityPrograms.universityId, university.id),
        eq(universityPrograms.programId, program.id),
      ),
    )
    .limit(1);
  uniProgram ??= (
    await db
      .insert(universityPrograms)
      .values({
        universityId: university.id,
        programId: program.id,
        status: "unverified",
      })
      .returning({ id: universityPrograms.id })
  )[0];

  await db
    .insert(enrollments)
    .values({
      studentId,
      universityProgramId: uniProgram.id,
      intakeYear,
      phase,
    })
    .onConflictDoNothing();

  redirect("/dashboard");
}
