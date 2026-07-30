"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { currentStudentId, signOut } from "@/auth";
import { db } from "@/lib/db/client";
import { students } from "@/lib/db/schema";

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
    .set({ displayName: parsed.data })
    .where(eq(students.id, studentId));
  redirect("/profile?saved=1");
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
