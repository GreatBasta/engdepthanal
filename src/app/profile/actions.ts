"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { currentStudentId, signOut } from "@/auth";
import { db } from "@/lib/db/client";
import { enrollments, students } from "@/lib/db/schema";
import { getPrimaryEnrollmentForStudent } from "@/lib/enrollment";
import { localeCookieName, localeSchema } from "@/lib/i18n/config";
import {
  onboardingProgrammeChoiceSchema,
  onboardingUnitChoiceSchema,
  persistOnboardingProgrammeChoice,
} from "@/lib/onboarding/programmes";
import { parseOrganizationSelection } from "@/lib/organizations/schema";

export async function updateProfileAction(formData: FormData) {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login?next=/profile");
  const parsed = z
    .string()
    .trim()
    .min(2)
    .max(80)
    .safeParse(formData.get("displayName"));
  if (!parsed.success) redirect("/profile?error=invalid-name");

  await db
    .update(students)
    .set({ displayName: parsed.data, updatedAt: new Date() })
    .where(eq(students.id, studentId));
  redirect("/profile?saved=1");
}

const studyContextSchema = z.object({
  programmeChoice: onboardingProgrammeChoiceSchema,
  unitChoice: onboardingUnitChoiceSchema.optional().default(""),
  intakeYear: z.coerce.number().int().min(2000).max(2100),
  academicContext: z.string().trim().max(160).optional().default(""),
  requestedProgrammeName: z.string().trim().max(160).optional().default(""),
  preferredLocale: localeSchema,
});

export async function updateStudyContextAction(formData: FormData) {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login?next=/profile");

  const organization = parseOrganizationSelection(
    formData.get("organizationSelection"),
  );
  const parsed = studyContextSchema.safeParse({
    programmeChoice: formData.get("programmeChoice"),
    unitChoice: formData.get("unitChoice") ?? "",
    intakeYear: formData.get("intakeYear"),
    academicContext: formData.get("academicContext") ?? "",
    requestedProgrammeName: formData.get("requestedProgrammeName") ?? "",
    preferredLocale: formData.get("preferredLocale"),
  });
  if (!organization || !parsed.success) {
    redirect("/profile?error=invalid-study-context");
  }

  const current = await getPrimaryEnrollmentForStudent(studentId);
  let selection: Awaited<
    ReturnType<typeof persistOnboardingProgrammeChoice>
  >;
  try {
    selection = await persistOnboardingProgrammeChoice({
      organization,
      programmeChoice: parsed.data.programmeChoice,
      unitChoice: parsed.data.unitChoice,
    });
  } catch {
    redirect("/profile?error=invalid-study-context");
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
        organizationalUnitId: selection.organizationalUnitId,
        intakeYear: parsed.data.intakeYear,
        academicContext: parsed.data.academicContext || null,
        requestedProgrammeName: parsed.data.requestedProgrammeName || null,
        phase: current?.phase ?? "attending",
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
          academicContext: parsed.data.academicContext || null,
          requestedProgrammeName: parsed.data.requestedProgrammeName || null,
          isPrimary: true,
          phase: current?.phase ?? "attending",
          updatedAt: new Date(),
        },
      });
    await tx
      .update(students)
      .set({
        preferredLocale: parsed.data.preferredLocale,
        updatedAt: new Date(),
      })
      .where(eq(students.id, studentId));
  });

  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, parsed.data.preferredLocale, {
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/");
  revalidatePath("/courses");
  revalidatePath("/courses/new");
  revalidatePath("/my-courses");
  revalidatePath("/profile");
  redirect("/profile?studySaved=1");
}

export async function deleteAccountAction(formData: FormData) {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");
  if (formData.get("confirmation") !== "DELETE") {
    redirect("/profile?error=delete-confirmation");
  }

  await db
    .update(students)
    .set({
      displayName: "Deleted student",
      email: sql`concat('deleted+', ${studentId}, '@invalid.local')`,
      passwordHash: null,
      deletedAt: new Date(),
    })
    .where(eq(students.id, studentId));
  await signOut({ redirectTo: "/" });
}
