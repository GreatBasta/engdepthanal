import { eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import { students } from "@/lib/db/schema";

/**
 * Admin access uses a normal authenticated account with a database role.
 * ADMIN_EMAILS remains a bootstrap-only allowlist for the first administrator.
 */

function allowlist(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** The current admin (normal account + DB role or bootstrap allowlist), else null. */
export async function currentAdmin(): Promise<{ label: string } | null> {
  const studentId = await currentStudentId();
  if (studentId) {
    const [student] = await db
      .select({ email: students.email, adminRole: students.adminRole })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    if (
      student &&
      (student.adminRole || allowlist().has(student.email.toLowerCase()))
    ) {
      return { label: student.email };
    }
  }
  return null;
}

/** True when the current request is from an admin (for conditional UI). */
export async function isAdmin(): Promise<boolean> {
  return (await currentAdmin()) !== null;
}
