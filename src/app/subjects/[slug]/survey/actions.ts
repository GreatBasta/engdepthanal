"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import { subjectEnrollments, subjects } from "@/lib/db/schema";
import { getStudentEnrollment } from "@/lib/enrollment";
import { normalizeGrade } from "@/lib/grades";

/**
 * Resolve the current student's FINISHED subject enrollment. The survey is
 * only ever available for subjects the student has marked finished
 * (STRUCTURE.md §2.4) — enforced here and again by the DB trigger.
 */
async function requireFinishedEnrollment(subjectSlug: string) {
  const studentId = await currentStudentId();
  if (!studentId) throw new Error("not authenticated");

  const enrollment = await getStudentEnrollment(studentId);
  if (!enrollment) throw new Error("not onboarded");

  const [subject] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.slug, subjectSlug))
    .limit(1);
  if (!subject) throw new Error("unknown subject");

  const [subjectEnrollment] = await db
    .select()
    .from(subjectEnrollments)
    .where(
      and(
        eq(subjectEnrollments.enrollmentId, enrollment.id),
        eq(subjectEnrollments.subjectId, subject.id),
      ),
    )
    .limit(1);
  if (!subjectEnrollment || subjectEnrollment.status !== "finished") {
    throw new Error("subject is not finished");
  }
  return { studentId, enrollment, subjectEnrollment, subjectId: subject.id };
}

const gradeSchema = z.object({
  subjectSlug: z.string().min(1),
  scale: z.string().min(1),
  rawValue: z.string().min(1),
  nextHref: z.string().startsWith("/"),
});

/** Save the student's grade (normalized to 0–100), then advance. */
export async function saveGrade(input: unknown) {
  const { subjectSlug, scale, rawValue, nextHref } = gradeSchema.parse(input);
  const { subjectEnrollment } = await requireFinishedEnrollment(subjectSlug);

  const normalized = normalizeGrade(scale, rawValue);
  if (!normalized) throw new Error("invalid grade for the chosen scale");

  await db
    .update(subjectEnrollments)
    .set({
      gradeScale: normalized.scale,
      gradeValue: normalized.rawValue,
      gradeNormalized: String(normalized.normalized),
    })
    .where(eq(subjectEnrollments.id, subjectEnrollment.id));

  revalidatePath(`/subjects/${subjectSlug}/survey`);
  redirect(nextHref);
}
