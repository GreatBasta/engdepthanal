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
import { coursePages, universityPrograms } from "@/lib/db/schema";

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
  universityProgramId: z.string().uuid(),
  localName: z.string().trim().min(2).max(180),
  courseCode: optionalText(40),
  professorName: optionalText(120),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}(?:\s*[/–-]\s*\d{2,4})?$/, "Use a year such as 2026/27"),
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
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login?next=/courses/new");

  const parsed = createCourseSchema.safeParse({
    universityProgramId: formData.get("universityProgramId"),
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
      error: parsed.error.issues[0]?.message ?? "Check the course details.",
      duplicates: [],
    };
  }

  const [universityProgram] = await db
    .select({ id: universityPrograms.id })
    .from(universityPrograms)
    .where(eq(universityPrograms.id, parsed.data.universityProgramId))
    .limit(1);
  if (!universityProgram) {
    return { error: "That university program is unavailable.", duplicates: [] };
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
      error: "You have created several courses recently. Try again in an hour.",
      duplicates: [],
    };
  }

  const input = { ...parsed.data, createdBy: studentId };
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
      error: "The course could not be created. Please try again.",
      duplicates: [],
    };
  }

  revalidatePath("/courses");
  revalidatePath("/my-courses");
  revalidateTag("course-directory");
  redirect(`/courses/${course.slug}?tab=curriculum`);
}
