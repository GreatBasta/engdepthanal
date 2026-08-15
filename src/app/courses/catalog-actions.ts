"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import {
  confirmCatalogCandidate,
  markCatalogCandidateOutdated,
  proposeCatalogCorrection,
} from "@/lib/catalog/review";

const candidateSchema = z.object({ candidateId: z.string().uuid() });

async function authenticatedCandidate(formData: FormData) {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login?next=/courses");
  const parsed = candidateSchema.safeParse({
    candidateId: formData.get("candidateId"),
  });
  if (!parsed.success) throw new Error("invalid catalog candidate");
  return { studentId, candidateId: parsed.data.candidateId };
}

export async function confirmCatalogCandidateAction(formData: FormData) {
  const input = await authenticatedCandidate(formData);
  await confirmCatalogCandidate({
    candidateId: input.candidateId,
    reviewerId: input.studentId,
    method: "student",
  });
  revalidatePath("/courses");
}

export async function reportCatalogCandidateOutdatedAction(formData: FormData) {
  const input = await authenticatedCandidate(formData);
  await markCatalogCandidateOutdated({
    candidateId: input.candidateId,
    reviewerId: input.studentId,
  });
  revalidatePath("/courses");
}

export async function proposeCatalogCorrectionAction(formData: FormData) {
  const input = await authenticatedCandidate(formData);
  const note = z.string().trim().min(4).max(1_000).parse(formData.get("note"));
  await proposeCatalogCorrection({
    candidateId: input.candidateId,
    studentId: input.studentId,
    note,
  });
  revalidatePath("/courses");
}
