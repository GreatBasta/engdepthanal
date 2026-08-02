"use server";

import { and, count, eq, gte } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import {
  createCourseFromTemplates,
  findDuplicateCourses,
  type DuplicateCourseWarning,
} from "@/lib/courses/create";
import { db } from "@/lib/db/client";
import { coursePages } from "@/lib/db/schema";
import { getPrimaryEnrollmentForStudent } from "@/lib/enrollment";
import { persistOrganizationProgramSelection } from "@/lib/organizations/persistence";
import { parseOrganizationSelection } from "@/lib/organizations/schema";
import { getI18n } from "@/lib/i18n/server";

export interface CreateCourseState {
  error: string | null;
  duplicates: DuplicateCourseWarning[];
}

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value : undefined),
    z.string().trim().max(max).optional(),
  );

const optionalInteger = (minimum: number, maximum: number) =>
  z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(minimum).max(maximum).optional(),
  );

const createCourseSchema = z.object({
  localName: z.string().trim().min(2).max(180),
  courseCode: optionalText(40),
  professorName: optionalText(120),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}(?:\s*[/-]\s*\d{2,4})?$/, "Use a year such as 2026/27"),
  cohortYear: optionalInteger(2000, 2100),
  semester: optionalInteger(1, 12),
  description: optionalText(2_000),
  visibility: z.enum(["public", "unlisted", "private"]),
  attendance: z.enum(["attended", "not_attended"]),
  templateIds: z.array(z.string().uuid()).min(1).max(8),
});

export async function createCourseAction(
  _previous: CreateCourseState,
  formData: FormData,
): Promise<CreateCourseState> {
  const [studentId, i18n] = await Promise.all([currentStudentId(), getI18n()]);
  const { t } = i18n;
  if (!studentId) redirect("/login?next=/courses/new");

  const parsed = createCourseSchema.safeParse({
    localName: formData.get("localName"),
    courseCode: formData.get("courseCode"),
    professorName: formData.get("professorName"),
    academicYear: formData.get("academicYear"),
    cohortYear: formData.get("cohortYear"),
    semester: formData.get("semester"),
    description: formData.get("description"),
    visibility: formData.get("visibility"),
    attendance: formData.get("attendance"),
    templateIds: formData.getAll("templateIds"),
  });
  if (!parsed.success) {
    return {
      error: t("create.invalid"),
      duplicates: [],
    };
  }

  let universityProgramId: string;
  if (formData.get("useDifferentOrganization") === "yes") {
    const organization = parseOrganizationSelection(
      formData.get("organizationSelection"),
    );
    const programSlug = z
      .string()
      .trim()
      .min(1)
      .max(120)
      .safeParse(formData.get("programSlug"));
    if (!organization || !programSlug.success) {
      return {
        error: t("create.selectOrganization"),
        duplicates: [],
      };
    }
    try {
      const selection = await persistOrganizationProgramSelection(
        organization,
        programSlug.data,
      );
      universityProgramId = selection.universityProgramId;
    } catch {
      return {
        error: t("create.organizationUnavailable"),
        duplicates: [],
      };
    }
  } else {
    const primary = await getPrimaryEnrollmentForStudent(studentId);
    const submittedProgram = z
      .string()
      .uuid()
      .safeParse(formData.get("universityProgramId"));
    if (!primary) redirect("/onboarding");
    if (
      !submittedProgram.success ||
      submittedProgram.data !== primary.universityProgramId
    ) {
      return {
        error: t("create.contextChanged"),
        duplicates: [],
      };
    }
    universityProgramId = primary.universityProgramId;
  }

  // A lightweight server-side creation limit prevents accidental or scripted
  // duplicate floods without storing client-controlled IP addresses.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1_000);
  const [recent] = await db
    .select({ value: count() })
    .from(coursePages)
    .where(
      and(
        gte(coursePages.createdAt, oneHourAgo),
        eq(coursePages.createdBy, studentId),
      ),
    );
  if (Number(recent?.value ?? 0) >= 10) {
    return {
      error: t("create.rateLimited"),
      duplicates: [],
    };
  }

  const input = {
    ...parsed.data,
    universityProgramId,
    createdBy: studentId,
  };
  const duplicates = await findDuplicateCourses(input);
  const duplicateConfirmed = formData.get("confirmDuplicate") === "yes";
  if (duplicates.length > 0 && !duplicateConfirmed) {
    return { error: null, duplicates };
  }

  let course: Awaited<ReturnType<typeof createCourseFromTemplates>>;
  try {
    course = await createCourseFromTemplates(input);
  } catch (error) {
    console.error("course creation failed", error);
    return {
      error: t("create.failed"),
      duplicates: [],
    };
  }

  revalidatePath("/courses");
  revalidatePath("/");
  revalidatePath("/my-courses");
  revalidateTag("course-directory");
  redirect(`/courses/${course.slug}/settings/curriculum`);
}
