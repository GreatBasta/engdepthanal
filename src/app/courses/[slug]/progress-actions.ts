"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import { loadCoursePermissionContext } from "@/lib/courses/permissions";
import { db } from "@/lib/db/client";
import { courseSubtopicProgress } from "@/lib/db/schema";

const schema = z.object({
  coursePageId: z.string().uuid(),
  courseSlug: z.string().min(1).max(120),
  subtopicStableId: z.string().uuid(),
  state: z.enum(["not_started", "learning", "completed", "saved"]),
});

export async function setCourseProgressAction(formData: FormData) {
  const parsed = schema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    subtopicStableId: formData.get("subtopicStableId"),
    state: formData.get("state"),
  });
  if (!parsed.success) return;
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");
  const context = await loadCoursePermissionContext(
    parsed.data.coursePageId,
    studentId,
  );
  if (!context?.membership) return;

  await db
    .insert(courseSubtopicProgress)
    .values({
      coursePageId: parsed.data.coursePageId,
      courseSubtopicStableId: parsed.data.subtopicStableId,
      studentId,
      state: parsed.data.state,
    })
    .onConflictDoUpdate({
      target: [
        courseSubtopicProgress.coursePageId,
        courseSubtopicProgress.courseSubtopicStableId,
        courseSubtopicProgress.studentId,
      ],
      set: {
        state: parsed.data.state,
        updatedAt: new Date(),
      },
    });
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}
