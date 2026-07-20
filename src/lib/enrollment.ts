import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { enrollments, subjectEnrollments } from "@/lib/db/schema";

/**
 * The signed-in student's enrollment (uni × program × intake). One per
 * student today; returns the first if that ever changes. Null when the
 * student hasn't onboarded yet.
 */
export async function getStudentEnrollment(studentId: string) {
  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.studentId, studentId))
    .limit(1);
  return enrollment ?? null;
}

/**
 * The per-subject enrollment row, creating it (status `in_progress`) on
 * first access. This is what tracking and — once finished — the coverage
 * survey hang off. Idempotent under the (enrollment, subject) unique index.
 */
export async function getOrCreateSubjectEnrollment(
  enrollmentId: string,
  subjectId: string,
) {
  const existing = await findSubjectEnrollment(enrollmentId, subjectId);
  if (existing) return existing;

  await db
    .insert(subjectEnrollments)
    .values({ enrollmentId, subjectId, status: "in_progress" })
    .onConflictDoNothing();

  // Re-read rather than trust returning(): a concurrent insert may have won.
  const row = await findSubjectEnrollment(enrollmentId, subjectId);
  if (!row) throw new Error("failed to create subject enrollment");
  return row;
}

async function findSubjectEnrollment(enrollmentId: string, subjectId: string) {
  const [row] = await db
    .select()
    .from(subjectEnrollments)
    .where(
      and(
        eq(subjectEnrollments.enrollmentId, enrollmentId),
        eq(subjectEnrollments.subjectId, subjectId),
      ),
    )
    .limit(1);
  return row ?? null;
}
