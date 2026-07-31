"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import {
  canPostToCourse,
  loadCoursePermissionContext,
} from "@/lib/courses/permissions";
import { db } from "@/lib/db/client";
import {
  courseCurriculumVersions,
  courseResourceComments,
  courseResourceReactions,
  courseResources,
  courseSubtopics,
  courseTopics,
} from "@/lib/db/schema";
import { consumeRateLimit } from "@/lib/rate-limit";

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

const resourceIdentitySchema = z.object({
  coursePageId: z.string().uuid(),
  courseSlug: z.string().min(1).max(120),
  resourceId: z.string().uuid(),
});

const commentSchema = resourceIdentitySchema.extend({
  body: z.string().trim().min(1).max(1_000),
});

const reactionSchema = resourceIdentitySchema.extend({
  kind: z.enum(["like", "helpful", "insightful"]),
});

async function resourceTargetExists(
  coursePageId: string,
  context: "course" | "topic" | "subtopic" | "exam",
  topicStableId?: string,
  subtopicStableId?: string,
) {
  if (context === "course" || context === "exam") {
    return !topicStableId && !subtopicStableId;
  }
  if (context === "topic" && topicStableId && !subtopicStableId) {
    const [topic] = await db
      .select({ id: courseTopics.id })
      .from(courseTopics)
      .innerJoin(
        courseCurriculumVersions,
        eq(courseTopics.curriculumVersionId, courseCurriculumVersions.id),
      )
      .where(
        and(
          eq(courseCurriculumVersions.coursePageId, coursePageId),
          eq(courseCurriculumVersions.status, "published"),
          eq(courseTopics.stableId, topicStableId),
          isNull(courseTopics.hiddenAt),
        ),
      )
      .limit(1);
    return Boolean(topic);
  }
  if (context === "subtopic" && subtopicStableId) {
    const [subtopic] = await db
      .select({ id: courseSubtopics.id })
      .from(courseSubtopics)
      .innerJoin(courseTopics, eq(courseSubtopics.courseTopicId, courseTopics.id))
      .innerJoin(
        courseCurriculumVersions,
        eq(courseTopics.curriculumVersionId, courseCurriculumVersions.id),
      )
      .where(
        and(
          eq(courseCurriculumVersions.coursePageId, coursePageId),
          eq(courseCurriculumVersions.status, "published"),
          eq(courseSubtopics.stableId, subtopicStableId),
          isNull(courseTopics.hiddenAt),
          isNull(courseSubtopics.hiddenAt),
        ),
      )
      .limit(1);
    return Boolean(subtopic);
  }
  return false;
}

async function activeResourceExists(coursePageId: string, resourceId: string) {
  const [resource] = await db
    .select({ id: courseResources.id })
    .from(courseResources)
    .where(
      and(
        eq(courseResources.id, resourceId),
        eq(courseResources.coursePageId, coursePageId),
        isNull(courseResources.hiddenAt),
        isNull(courseResources.deletedAt),
      ),
    )
    .limit(1);
  return Boolean(resource);
}

export async function createResourceAction(formData: FormData) {
  const contextTarget = String(
    formData.get("contextTarget") ?? formData.get("context") ?? "",
  );
  const [context, stableId] = contextTarget.split(":", 2);
  const parsed = resourceSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    context,
    topicStableId:
      context === "topic" ? stableId || formData.get("topicStableId") : undefined,
    subtopicStableId:
      context === "subtopic"
        ? stableId || formData.get("subtopicStableId")
        : undefined,
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

  if (
    !(await consumeRateLimit({
      action: "course-resource",
      identifier: studentId,
      limit: 20,
      windowMinutes: 60,
    }))
  ) {
    return;
  }

  if (parsed.data.type === "link" && !parsed.data.linkUrl) return;
  if (!parsed.data.title && !parsed.data.body && !parsed.data.linkUrl) return;
  if (
    ["pdf", "image", "permitted_material"].includes(parsed.data.type) &&
    !parsed.data.permissionConfirmed
  ) {
    return;
  }
  if (
    !(await resourceTargetExists(
      parsed.data.coursePageId,
      parsed.data.context,
      parsed.data.topicStableId,
      parsed.data.subtopicStableId,
    ))
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

export async function createResourceCommentAction(formData: FormData) {
  const parsed = commentSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    resourceId: formData.get("resourceId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return;
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");
  const permission = await loadCoursePermissionContext(
    parsed.data.coursePageId,
    studentId,
  );
  if (!permission || !canPostToCourse(permission)) return;
  if (
    !(await consumeRateLimit({
      action: "resource-comment",
      identifier: studentId,
      limit: 30,
      windowMinutes: 60,
    }))
  ) {
    return;
  }
  if (
    !(await activeResourceExists(
      parsed.data.coursePageId,
      parsed.data.resourceId,
    ))
  ) {
    return;
  }

  await db.insert(courseResourceComments).values({
    resourceId: parsed.data.resourceId,
    authorId: studentId,
    body: parsed.data.body,
  });
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

export async function toggleResourceReactionAction(formData: FormData) {
  const parsed = reactionSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    resourceId: formData.get("resourceId"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return;
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");
  const permission = await loadCoursePermissionContext(
    parsed.data.coursePageId,
    studentId,
  );
  if (!permission || !canPostToCourse(permission)) return;
  if (
    !(await consumeRateLimit({
      action: "resource-reaction",
      identifier: studentId,
      limit: 60,
      windowMinutes: 60,
    }))
  ) {
    return;
  }
  if (
    !(await activeResourceExists(
      parsed.data.coursePageId,
      parsed.data.resourceId,
    ))
  ) {
    return;
  }

  const key = and(
    eq(courseResourceReactions.resourceId, parsed.data.resourceId),
    eq(courseResourceReactions.studentId, studentId),
    eq(courseResourceReactions.kind, parsed.data.kind),
  );
  const [existing] = await db
    .select({ resourceId: courseResourceReactions.resourceId })
    .from(courseResourceReactions)
    .where(key)
    .limit(1);
  if (existing) {
    await db.delete(courseResourceReactions).where(key);
  } else {
    await db
      .insert(courseResourceReactions)
      .values({
        resourceId: parsed.data.resourceId,
        studentId,
        kind: parsed.data.kind,
      })
      .onConflictDoNothing();
  }
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}
