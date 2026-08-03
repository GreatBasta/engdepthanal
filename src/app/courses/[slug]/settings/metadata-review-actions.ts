"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import { reviewOfficialMetadataChange } from "@/lib/catalog/review";

export async function reviewOfficialMetadataAction(formData: FormData) {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");
  const input = z
    .object({
      reviewId: z.string().uuid(),
      courseSlug: z.string().min(1).max(160),
      decision: z.enum(["accept", "reject"]),
    })
    .parse(Object.fromEntries(formData));
  await reviewOfficialMetadataChange({
    reviewId: input.reviewId,
    reviewerId: studentId,
    accepted: input.decision === "accept",
  });
  revalidatePath(`/courses/${input.courseSlug}`);
  revalidatePath(`/courses/${input.courseSlug}/settings`);
  revalidatePath("/courses");
  revalidateTag("course-directory");
}
