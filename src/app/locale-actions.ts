"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import { students } from "@/lib/db/schema";
import { localeCookieName, localeSchema } from "@/lib/i18n/config";

const localeActionSchema = z.object({
  locale: localeSchema,
  returnTo: z
    .string()
    .max(500)
    .refine((value) => value.startsWith("/") && !value.startsWith("//")),
});

export async function setLocaleAction(formData: FormData) {
  const parsed = localeActionSchema.safeParse({
    locale: formData.get("locale"),
    returnTo: formData.get("returnTo") ?? "/",
  });
  if (!parsed.success) return;

  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, parsed.data.locale, {
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  const studentId = await currentStudentId();
  if (studentId) {
    await db
      .update(students)
      .set({ preferredLocale: parsed.data.locale, updatedAt: new Date() })
      .where(eq(students.id, studentId));
  }
  revalidatePath("/", "layout");
  redirect(parsed.data.returnTo);
}
