"use server";

import { and, count, eq, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import {
  canPostToCourse,
  loadCoursePermissionContext,
} from "@/lib/courses/permissions";
import { db } from "@/lib/db/client";
import { courseResources } from "@/lib/db/schema";

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value ? value : undefined),
  z.string().uuid().optional(),
);

const resourceSchema = z.object({
  coursePageId: z.string().uuid(),
  courseSlug: z.string().min(1).max(120),
  context: z.enum(["course", "topic", "subtopic", "exam"]),
  topicStableId: optionalUuid,
  subtopicStableId: optionalUuid,
  type: z.enum([
    "text_note",
    "link",
    "image",
    "pdf",
    "short_comment",
    "study_tip",
    "correction",
    "personal_notes",
    "permitted_material",
  ]),
  title: z.string().trim().max(180).optional(),
  body: z.string().trim().max(10_000).optional(),
  linkUrl: z.string().url().max(2_000).optional(),
  permissionConfirmed: z.boolean(),
});

export async function createResourceAction(formData: FormData) {
  const parsed = resourceSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    context: formData.get("context"),
    topicStableId: formData.get("topicStableId"),
    subtopicStableId: formData.get("subtopicStableId"),
    type: formData.get("type"),
    title: formData.get("title") || undefined,
    body: formData.get("body") || undefined,
    linkUrl: formData.get("linkUrl") || undefined,
    permissionConfirmed: formData.get("permissionConfirmed") === "yes",
  });
  if (!parsed.success) return;
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");
  const permission = await loadCoursePermissionContext(
    parsed.data.coursePageId,
    studentId,
  );
  if (!permission || !canPostToCourse(permission)) return;

  const [recent] = await db
    .select({ value: count() })
    .from(courseResources)
    .where(
      and(
        eq(courseResources.authorId, studentId),
        gte(courseResources.createdAt, new Date(Date.now() - 60 * 60 * 1_000)),
      ),
    );
  if (Number(recent?.value ?? 0) >= 20) return;

  if (parsed.data.type === "link" && !parsed.data.linkUrl) return;
  if (
    ["pdf", "image", "permitted_material"].includes(parsed.data.type) &&
    !parsed.data.permissionConfirmed
  ) {
    return;
  }

  await db.insert(courseResources).values({
    coursePageId: parsed.data.coursePageId,
    authorId: studentId,
    context: parsed.data.context,
    courseTopicStableId:
      parsed.data.context === "topic" ? parsed.data.topicStableId : null,
    courseSubtopicStableId:
      parsed.data.context === "subtopic"
        ? parsed.data.subtopicStableId
        : null,
    type: parsed.data.type,
    title: parsed.data.title || null,
    body: parsed.data.body || null,
    linkUrl: parsed.data.linkUrl || null,
    permissionConfirmed: parsed.data.permissionConfirmed,
  });
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}
