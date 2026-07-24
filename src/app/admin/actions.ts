"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { currentAdmin } from "@/lib/admin";
import { db } from "@/lib/db/client";
import {
  curriculumSuggestions,
  universities,
  universityPrograms,
} from "@/lib/db/schema";

const idSchema = z.object({ id: z.string().uuid() });

async function assertAdmin() {
  const admin = await currentAdmin();
  if (!admin) throw new Error("not authorized");
  return admin;
}

/** Curriculum suggestion: accept (verified) or dismiss (rejected). */
export async function reviewSuggestion(input: unknown, verified: boolean) {
  await assertAdmin();
  const { id } = idSchema.parse(input);
  await db
    .update(curriculumSuggestions)
    .set({ status: verified ? "verified" : "rejected" })
    .where(
      and(
        eq(curriculumSuggestions.id, id),
        eq(curriculumSuggestions.status, "unverified"),
      ),
    );
  revalidatePath("/admin/curriculum");
  revalidatePath("/admin");
}

/** Student-added university: verify (counts toward aggregates) or reject. */
export async function reviewUniversity(input: unknown, verified: boolean) {
  await assertAdmin();
  const { id } = idSchema.parse(input);
  await db
    .update(universities)
    .set({ status: verified ? "verified" : "rejected" })
    .where(
      and(eq(universities.id, id), eq(universities.status, "unverified")),
    );
  revalidatePath("/admin/verify");
  revalidatePath("/admin");
}

/** A university × program pairing: verify or reject. */
export async function reviewUniversityProgram(
  input: unknown,
  verified: boolean,
) {
  await assertAdmin();
  const { id } = idSchema.parse(input);
  await db
    .update(universityPrograms)
    .set({ status: verified ? "verified" : "rejected" })
    .where(
      and(
        eq(universityPrograms.id, id),
        eq(universityPrograms.status, "unverified"),
      ),
    );
  revalidatePath("/admin/verify");
  revalidatePath("/admin");
}
