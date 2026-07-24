import { eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import { students } from "@/lib/db/schema";

/**
 * Lightweight admin gating for the review console. Admins are a simple
 * allowlist of emails in the ADMIN_EMAILS env var (comma-separated) — no
 * schema/role changes needed for the MVP. The check always resolves the
 * signed-in student's email from the database, never from client input.
 */
function allowlist(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** The current student's id + email if they are an admin, else null. */
export async function currentAdmin(): Promise<{
  id: string;
  email: string;
} | null> {
  const studentId = await currentStudentId();
  if (!studentId) return null;

  const [student] = await db
    .select({ email: students.email })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  if (!student) return null;

  const email = student.email.toLowerCase();
  return allowlist().has(email) ? { id: studentId, email } : null;
}

/** True when the signed-in student is an admin (for conditional UI). */
export async function isAdmin(): Promise<boolean> {
  return (await currentAdmin()) !== null;
}
