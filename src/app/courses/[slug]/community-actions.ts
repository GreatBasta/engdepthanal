"use server";

import { createHash, randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { and, count, eq, gte, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import {
  safeAttachmentName,
  validateAttachmentBytes,
  validateAttachmentMetadata,
} from "@/lib/courses/attachment-policy";
import {
  canModerateCourse,
  canPostToCourse,
  canViewCourse,
  loadCoursePermissionContext,
} from "@/lib/courses/permissions";
import { db } from "@/lib/db/client";
import {
  contentReports,
  courseAttachments,
  coursePostReactions,
  coursePosts,
  courseResources,
  courseReplies,
  courseReplyReactions,
  examExperiences,
  examQuestions,
  moderationActions,
} from "@/lib/db/schema";

export interface AttachmentState {
  error: string | null;
  message: string | null;
}

const courseIdentitySchema = z.object({
  coursePageId: z.string().uuid(),
  courseSlug: z.string().min(1).max(120),
});

const postSchema = courseIdentitySchema.extend({
  kind: z.enum(["discussion", "resource", "announcement"]),
  title: z.string().trim().max(180).optional(),
  body: z.string().trim().min(1).max(20_000),
});

const replySchema = courseIdentitySchema.extend({
  postId: z.string().uuid(),
  body: z.string().trim().min(1).max(10_000),
});

const reactionSchema = courseIdentitySchema.extend({
  targetType: z.enum(["post", "reply"]),
  targetId: z.string().uuid(),
  kind: z.enum(["like", "helpful", "insightful"]),
});

const reportSchema = courseIdentitySchema.extend({
  targetType: z.enum(["post", "reply", "course_resource", "attachment"]),
  targetId: z.string().uuid(),
  reason: z.enum([
    "spam",
    "harassment",
    "personal_info",
    "copyright",
    "unauthorized_exam_material",
    "incorrect_info",
    "inappropriate",
    "other",
  ]),
  details: z.string().trim().max(2_000).optional(),
});

const moderationSchema = courseIdentitySchema.extend({
  targetType: z.enum(["post", "reply", "course_resource", "attachment"]),
  targetId: z.string().uuid(),
  action: z.enum(["hide", "restore", "lock", "unlock"]),
  reason: z.string().trim().min(2).max(500),
});

async function authorizedContext(
  coursePageId: string,
  permission: "view" | "post" | "moderate",
) {
  const studentId = await currentStudentId();
  if (!studentId) return null;
  const context = await loadCoursePermissionContext(coursePageId, studentId);
  if (!context) return null;
  const allowed =
    permission === "view"
      ? canViewCourse(context)
      : permission === "post"
        ? canPostToCourse(context)
        : canModerateCourse(context);
  return allowed ? { studentId, context } : null;
}

export async function createCoursePostAction(formData: FormData) {
  const parsed = postSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    kind: formData.get("kind"),
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) return;
  const authorized = await authorizedContext(parsed.data.coursePageId, "post");
  if (!authorized) return;

  const [recent] = await db
    .select({ value: count() })
    .from(coursePosts)
    .where(
      and(
        eq(coursePosts.authorId, authorized.studentId),
        gte(coursePosts.createdAt, new Date(Date.now() - 60 * 60 * 1_000)),
      ),
    );
  if (Number(recent?.value ?? 0) >= 20) return;

  await db.insert(coursePosts).values({
    coursePageId: parsed.data.coursePageId,
    authorId: authorized.studentId,
    kind: parsed.data.kind,
    title: parsed.data.title || null,
    body: parsed.data.body,
  });
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

export async function createCourseReplyAction(formData: FormData) {
  const parsed = replySchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    postId: formData.get("postId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return;
  const authorized = await authorizedContext(parsed.data.coursePageId, "post");
  if (!authorized) return;

  const [post] = await db
    .select({
      id: coursePosts.id,
      lockedAt: coursePosts.lockedAt,
      hiddenAt: coursePosts.hiddenAt,
    })
    .from(coursePosts)
    .where(
      and(
        eq(coursePosts.id, parsed.data.postId),
        eq(coursePosts.coursePageId, parsed.data.coursePageId),
      ),
    )
    .limit(1);
  if (!post || post.lockedAt || post.hiddenAt) return;

  const [recent] = await db
    .select({ value: count() })
    .from(courseReplies)
    .where(
      and(
        eq(courseReplies.authorId, authorized.studentId),
        gte(courseReplies.createdAt, new Date(Date.now() - 60 * 60 * 1_000)),
      ),
    );
  if (Number(recent?.value ?? 0) >= 60) return;

  await db.insert(courseReplies).values({
    postId: post.id,
    authorId: authorized.studentId,
    body: parsed.data.body,
  });
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

export async function toggleCourseReactionAction(formData: FormData) {
  const parsed = reactionSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return;
  const authorized = await authorizedContext(parsed.data.coursePageId, "post");
  if (!authorized) return;

  if (parsed.data.targetType === "post") {
    const [target] = await db
      .select({ id: coursePosts.id })
      .from(coursePosts)
      .where(
        and(
          eq(coursePosts.id, parsed.data.targetId),
          eq(coursePosts.coursePageId, parsed.data.coursePageId),
          isNull(coursePosts.hiddenAt),
        ),
      )
      .limit(1);
    if (!target) return;
    const key = and(
      eq(coursePostReactions.postId, target.id),
      eq(coursePostReactions.studentId, authorized.studentId),
      eq(coursePostReactions.kind, parsed.data.kind),
    );
    const [existing] = await db
      .select({ postId: coursePostReactions.postId })
      .from(coursePostReactions)
      .where(key)
      .limit(1);
    if (existing) {
      await db.delete(coursePostReactions).where(key);
    } else {
      await db.insert(coursePostReactions).values({
        postId: target.id,
        studentId: authorized.studentId,
        kind: parsed.data.kind,
      });
    }
  } else {
    const [target] = await db
      .select({ id: courseReplies.id })
      .from(courseReplies)
      .innerJoin(coursePosts, eq(courseReplies.postId, coursePosts.id))
      .where(
        and(
          eq(courseReplies.id, parsed.data.targetId),
          eq(coursePosts.coursePageId, parsed.data.coursePageId),
          isNull(courseReplies.hiddenAt),
          isNull(coursePosts.hiddenAt),
        ),
      )
      .limit(1);
    if (!target) return;
    const key = and(
      eq(courseReplyReactions.replyId, target.id),
      eq(courseReplyReactions.studentId, authorized.studentId),
      eq(courseReplyReactions.kind, parsed.data.kind),
    );
    const [existing] = await db
      .select({ replyId: courseReplyReactions.replyId })
      .from(courseReplyReactions)
      .where(key)
      .limit(1);
    if (existing) {
      await db.delete(courseReplyReactions).where(key);
    } else {
      await db.insert(courseReplyReactions).values({
        replyId: target.id,
        studentId: authorized.studentId,
        kind: parsed.data.kind,
      });
    }
  }
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

export async function reportCourseContentAction(formData: FormData) {
  const parsed = reportSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    reason: formData.get("reason"),
    details: formData.get("details"),
  });
  if (!parsed.success) return;
  const authorized = await authorizedContext(parsed.data.coursePageId, "view");
  if (!authorized) return;
  if (
    !(await targetBelongsToCourse(
      parsed.data.coursePageId,
      parsed.data.targetType,
      parsed.data.targetId,
    ))
  ) {
    return;
  }

  const [recent] = await db
    .select({ value: count() })
    .from(contentReports)
    .where(
      and(
        eq(contentReports.reporterId, authorized.studentId),
        gte(
          contentReports.createdAt,
          new Date(Date.now() - 24 * 60 * 60 * 1_000),
        ),
      ),
    );
  if (Number(recent?.value ?? 0) >= 20) return;

  await db
    .insert(contentReports)
    .values({
      coursePageId: parsed.data.coursePageId,
      reporterId: authorized.studentId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
      details: parsed.data.details || null,
    })
    .onConflictDoNothing();
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

export async function moderateCourseContentAction(formData: FormData) {
  const parsed = moderationSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    action: formData.get("action"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return;
  const authorized = await authorizedContext(
    parsed.data.coursePageId,
    "moderate",
  );
  if (!authorized) return;
  if (
    !(await targetBelongsToCourse(
      parsed.data.coursePageId,
      parsed.data.targetType,
      parsed.data.targetId,
    ))
  ) {
    return;
  }

  const now = new Date();
  if (parsed.data.targetType === "post") {
    await db
      .update(coursePosts)
      .set(
        parsed.data.action === "lock" || parsed.data.action === "unlock"
          ? { lockedAt: parsed.data.action === "lock" ? now : null }
          : { hiddenAt: parsed.data.action === "hide" ? now : null },
      )
      .where(eq(coursePosts.id, parsed.data.targetId));
  } else if (parsed.data.targetType === "reply") {
    if (
      parsed.data.action !== "hide" &&
      parsed.data.action !== "restore"
    ) {
      return;
    }
    await db
      .update(courseReplies)
      .set({ hiddenAt: parsed.data.action === "hide" ? now : null })
      .where(eq(courseReplies.id, parsed.data.targetId));
  } else if (parsed.data.targetType === "course_resource") {
    if (
      parsed.data.action !== "hide" &&
      parsed.data.action !== "restore"
    ) {
      return;
    }
    await db
      .update(courseResources)
      .set({ hiddenAt: parsed.data.action === "hide" ? now : null })
      .where(eq(courseResources.id, parsed.data.targetId));
  } else {
    if (
      parsed.data.action !== "hide" &&
      parsed.data.action !== "restore"
    ) {
      return;
    }
    await db
      .update(courseAttachments)
      .set({ deletedAt: parsed.data.action === "hide" ? now : null })
      .where(eq(courseAttachments.id, parsed.data.targetId));
  }

  await db.insert(moderationActions).values({
    coursePageId: parsed.data.coursePageId,
    actorId: authorized.studentId,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    action: parsed.data.action,
    reason: parsed.data.reason,
  });
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

export async function resolveCourseReportAction(formData: FormData) {
  const parsed = courseIdentitySchema
    .extend({
      reportId: z.string().uuid(),
      resolution: z.enum(["dismissed", "actioned"]),
    })
    .safeParse({
      coursePageId: formData.get("coursePageId"),
      courseSlug: formData.get("courseSlug"),
      reportId: formData.get("reportId"),
      resolution: formData.get("resolution"),
    });
  if (!parsed.success) return;
  const authorized = await authorizedContext(
    parsed.data.coursePageId,
    "moderate",
  );
  if (!authorized) return;

  const [report] = await db
    .select({
      id: contentReports.id,
      targetType: contentReports.targetType,
      targetId: contentReports.targetId,
    })
    .from(contentReports)
    .where(
      and(
        eq(contentReports.id, parsed.data.reportId),
        eq(contentReports.coursePageId, parsed.data.coursePageId),
        eq(contentReports.status, "open"),
      ),
    )
    .limit(1);
  if (!report) return;

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(contentReports)
      .set({
        status: parsed.data.resolution,
        resolvedBy: authorized.studentId,
        resolvedAt: now,
      })
      .where(eq(contentReports.id, report.id));
    await tx.insert(moderationActions).values({
      coursePageId: parsed.data.coursePageId,
      actorId: authorized.studentId,
      targetType: report.targetType,
      targetId: report.targetId,
      action: "resolve_report",
      reason: `Report ${parsed.data.resolution}`,
      metadata: { reportId: report.id, resolution: parsed.data.resolution },
    });
  });
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

const attachmentSchema = courseIdentitySchema.extend({
  parentType: z.enum([
    "post",
    "reply",
    "exam_experience",
    "exam_question",
    "course_resource",
  ]),
  parentId: z.string().uuid(),
  access: z.enum(["public", "course"]),
});

const permanentAttachmentDeleteSchema = courseIdentitySchema.extend({
  attachmentId: z.string().uuid(),
  confirmation: z.literal("delete"),
});

export async function uploadCourseAttachmentAction(
  _previous: AttachmentState,
  formData: FormData,
): Promise<AttachmentState> {
  const parsed = attachmentSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    parentType: formData.get("parentType"),
    parentId: formData.get("parentId"),
    access: formData.get("access"),
  });
  const file = formData.get("file");
  if (!parsed.success || !(file instanceof File)) {
    return { error: "Choose a valid attachment.", message: null };
  }
  const authorized = await authorizedContext(parsed.data.coursePageId, "post");
  if (!authorized) {
    return {
      error: "You do not have permission to upload here.",
      message: null,
    };
  }
  if (
    !(await targetBelongsToCourse(
      parsed.data.coursePageId,
      parsed.data.parentType,
      parsed.data.parentId,
    ))
  ) {
    return { error: "The attachment target is unavailable.", message: null };
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const metadataError = validateAttachmentMetadata(file);
  if (metadataError) {
    return { error: metadataError, message: null };
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_OIDC_TOKEN) {
    return {
      error: "Attachment storage is not configured.",
      message: null,
    };
  }

  const [recent] = await db
    .select({ value: count() })
    .from(courseAttachments)
    .where(
      and(
        eq(courseAttachments.uploaderId, authorized.studentId),
        gte(
          courseAttachments.createdAt,
          new Date(Date.now() - 60 * 60 * 1_000),
        ),
      ),
    );
  if (Number(recent?.value ?? 0) >= 20) {
    return {
      error: "Upload limit reached. Try again in an hour.",
      message: null,
    };
  }

  const bytes = await file.arrayBuffer();
  const contentError = validateAttachmentBytes(
    new Uint8Array(bytes),
    file.type,
  );
  if (contentError) {
    return { error: contentError, message: null };
  }
  const sha256 = createHash("sha256")
    .update(Buffer.from(bytes))
    .digest("hex");
  const [duplicate] = await db
    .select({ id: courseAttachments.id })
    .from(courseAttachments)
    .where(
      and(
        eq(courseAttachments.coursePageId, parsed.data.coursePageId),
        eq(courseAttachments.sha256, sha256),
        isNull(courseAttachments.deletedAt),
      ),
    )
    .limit(1);
  if (duplicate) {
    return {
      error: "This exact file is already attached to the course.",
      message: null,
    };
  }

  const safeName = safeAttachmentName(file.name, extension);
  const storageKey = `courses/${parsed.data.coursePageId}/${randomUUID()}-${safeName}`;
  let blob: Awaited<ReturnType<typeof put>> | null = null;
  try {
    blob = await put(storageKey, bytes, {
      access: "private",
      addRandomSuffix: false,
      contentType: file.type,
    });
    await db.insert(courseAttachments).values({
      coursePageId: parsed.data.coursePageId,
      uploaderId: authorized.studentId,
      parentType: parsed.data.parentType,
      parentId: parsed.data.parentId,
      storageKey: blob.pathname,
      blobUrl: blob.url,
      fileName: safeName,
      mimeType: file.type,
      sizeBytes: file.size,
      sha256,
      access: parsed.data.access,
    });
  } catch (error) {
    if (blob) {
      try {
        await del(blob.url);
      } catch {
        // A failed cleanup is safe to retry from the private store dashboard.
      }
    }
    console.error("course attachment upload failed", error);
    return {
      error: "The attachment could not be uploaded.",
      message: null,
    };
  }

  revalidatePath(`/courses/${parsed.data.courseSlug}`);
  return { error: null, message: "Attachment uploaded." };
}

export async function permanentlyDeleteCourseAttachmentAction(
  formData: FormData,
) {
  const parsed = permanentAttachmentDeleteSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    attachmentId: formData.get("attachmentId"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) return;

  const authorized = await authorizedContext(
    parsed.data.coursePageId,
    "moderate",
  );
  if (!authorized) return;
  const [attachment] = await db
    .select({
      id: courseAttachments.id,
      blobUrl: courseAttachments.blobUrl,
      fileName: courseAttachments.fileName,
      deletedAt: courseAttachments.deletedAt,
    })
    .from(courseAttachments)
    .where(
      and(
        eq(courseAttachments.id, parsed.data.attachmentId),
        eq(courseAttachments.coursePageId, parsed.data.coursePageId),
      ),
    )
    .limit(1);
  // Permanent removal is deliberately a second step after moderation hide.
  if (!attachment?.deletedAt) return;
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_OIDC_TOKEN) {
    console.error("course attachment permanent delete storage unavailable", {
      attachmentId: attachment.id,
      coursePageId: parsed.data.coursePageId,
    });
    return;
  }

  try {
    await del(attachment.blobUrl);
    await db.transaction(async (tx) => {
      await tx.insert(moderationActions).values({
        coursePageId: parsed.data.coursePageId,
        actorId: authorized.studentId,
        targetType: "attachment",
        targetId: attachment.id,
        action: "hide",
        reason: "Permanent attachment removal after moderation soft delete",
        metadata: {
          permanent: true,
          blobDeleted: true,
          fileName: attachment.fileName,
        },
      });
      await tx
        .delete(courseAttachments)
        .where(eq(courseAttachments.id, attachment.id));
    });
  } catch (error) {
    console.error("course attachment permanent delete failed", {
      attachmentId: attachment.id,
      coursePageId: parsed.data.coursePageId,
      error,
    });
    return;
  }
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
  revalidatePath(`/courses/${parsed.data.courseSlug}/settings`);
}

async function targetBelongsToCourse(
  coursePageId: string,
  targetType:
    | "post"
    | "reply"
    | "attachment"
    | "exam_experience"
    | "exam_question"
    | "course_resource",
  targetId: string,
) {
  if (targetType === "post") {
    const [row] = await db
      .select({ id: coursePosts.id })
      .from(coursePosts)
      .where(
        and(
          eq(coursePosts.id, targetId),
          eq(coursePosts.coursePageId, coursePageId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
  if (targetType === "course_resource") {
    const [row] = await db
      .select({ id: courseResources.id })
      .from(courseResources)
      .where(
        and(
          eq(courseResources.id, targetId),
          eq(courseResources.coursePageId, coursePageId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
  if (targetType === "reply") {
    const [row] = await db
      .select({ id: courseReplies.id })
      .from(courseReplies)
      .innerJoin(coursePosts, eq(courseReplies.postId, coursePosts.id))
      .where(
        and(
          eq(courseReplies.id, targetId),
          eq(coursePosts.coursePageId, coursePageId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
  if (targetType === "exam_experience") {
    const [row] = await db
      .select({ id: examExperiences.id })
      .from(examExperiences)
      .where(
        and(
          eq(examExperiences.id, targetId),
          eq(examExperiences.coursePageId, coursePageId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
  if (targetType === "exam_question") {
    const [row] = await db
      .select({ id: examQuestions.id })
      .from(examQuestions)
      .where(
        and(
          eq(examQuestions.id, targetId),
          eq(examQuestions.coursePageId, coursePageId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
  const [row] = await db
    .select({ id: courseAttachments.id })
    .from(courseAttachments)
    .where(
      and(
        eq(courseAttachments.id, targetId),
        eq(courseAttachments.coursePageId, coursePageId),
      ),
    )
    .limit(1);
  return Boolean(row);
}
