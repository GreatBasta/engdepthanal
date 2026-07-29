import "server-only";

import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  courseAttachments,
  contentReports,
  coursePostReactions,
  coursePosts,
  courseReplies,
  courseReplyReactions,
  students,
} from "@/lib/db/schema";

export async function getOpenCourseReports(coursePageId: string) {
  return db
    .select({
      id: contentReports.id,
      targetType: contentReports.targetType,
      targetId: contentReports.targetId,
      reason: contentReports.reason,
      details: contentReports.details,
      reporterName: students.displayName,
      createdAt: contentReports.createdAt,
    })
    .from(contentReports)
    .innerJoin(students, eq(contentReports.reporterId, students.id))
    .where(
      and(
        eq(contentReports.coursePageId, coursePageId),
        eq(contentReports.status, "open"),
      ),
    )
    .orderBy(asc(contentReports.createdAt));
}

export async function getCourseCommunity(
  coursePageId: string,
  includeHidden: boolean,
) {
  const postRows = await db
    .select({
      id: coursePosts.id,
      authorId: coursePosts.authorId,
      authorName: students.displayName,
      kind: coursePosts.kind,
      title: coursePosts.title,
      body: coursePosts.body,
      pinnedAt: coursePosts.pinnedAt,
      lockedAt: coursePosts.lockedAt,
      hiddenAt: coursePosts.hiddenAt,
      createdAt: coursePosts.createdAt,
      updatedAt: coursePosts.updatedAt,
    })
    .from(coursePosts)
    .innerJoin(students, eq(coursePosts.authorId, students.id))
    .where(
      and(
        eq(coursePosts.coursePageId, coursePageId),
        includeHidden ? undefined : isNull(coursePosts.hiddenAt),
      ),
    )
    .orderBy(desc(coursePosts.pinnedAt), desc(coursePosts.createdAt));
  if (postRows.length === 0) return [];

  const postIds = postRows.map((post) => post.id);
  const [replyRows, postReactionRows, attachmentRows] = await Promise.all([
    db
      .select({
        id: courseReplies.id,
        postId: courseReplies.postId,
        authorId: courseReplies.authorId,
        authorName: students.displayName,
        body: courseReplies.body,
        hiddenAt: courseReplies.hiddenAt,
        createdAt: courseReplies.createdAt,
      })
      .from(courseReplies)
      .innerJoin(students, eq(courseReplies.authorId, students.id))
      .where(
        and(
          inArray(courseReplies.postId, postIds),
          includeHidden ? undefined : isNull(courseReplies.hiddenAt),
        ),
      )
      .orderBy(asc(courseReplies.createdAt)),
    db
      .select({
        postId: coursePostReactions.postId,
        kind: coursePostReactions.kind,
        value: count(),
      })
      .from(coursePostReactions)
      .where(inArray(coursePostReactions.postId, postIds))
      .groupBy(coursePostReactions.postId, coursePostReactions.kind),
    db
      .select({
        id: courseAttachments.id,
        parentType: courseAttachments.parentType,
        parentId: courseAttachments.parentId,
        fileName: courseAttachments.fileName,
        mimeType: courseAttachments.mimeType,
        sizeBytes: courseAttachments.sizeBytes,
        access: courseAttachments.access,
        createdAt: courseAttachments.createdAt,
      })
      .from(courseAttachments)
      .where(
        and(
          eq(courseAttachments.coursePageId, coursePageId),
          eq(courseAttachments.parentType, "post"),
          isNull(courseAttachments.deletedAt),
          inArray(courseAttachments.parentId, postIds),
        ),
      )
      .orderBy(asc(courseAttachments.createdAt)),
  ]);

  const replyIds = replyRows.map((reply) => reply.id);
  const replyReactionRows =
    replyIds.length > 0
      ? await db
          .select({
            replyId: courseReplyReactions.replyId,
            kind: courseReplyReactions.kind,
            value: count(),
          })
          .from(courseReplyReactions)
          .where(inArray(courseReplyReactions.replyId, replyIds))
          .groupBy(courseReplyReactions.replyId, courseReplyReactions.kind)
      : [];
  const replyAttachmentRows =
    replyIds.length > 0
      ? await db
          .select({
            id: courseAttachments.id,
            parentType: courseAttachments.parentType,
            parentId: courseAttachments.parentId,
            fileName: courseAttachments.fileName,
            mimeType: courseAttachments.mimeType,
            sizeBytes: courseAttachments.sizeBytes,
            access: courseAttachments.access,
            createdAt: courseAttachments.createdAt,
          })
          .from(courseAttachments)
          .where(
            and(
              eq(courseAttachments.coursePageId, coursePageId),
              eq(courseAttachments.parentType, "reply"),
              isNull(courseAttachments.deletedAt),
              inArray(courseAttachments.parentId, replyIds),
            ),
          )
      : [];

  const attachments = [...attachmentRows, ...replyAttachmentRows];
  return postRows.map((post) => ({
    ...post,
    reactions: postReactionRows.filter(
      (reaction) => reaction.postId === post.id,
    ),
    attachments: attachments.filter(
      (attachment) =>
        attachment.parentType === "post" && attachment.parentId === post.id,
    ),
    replies: replyRows
      .filter((reply) => reply.postId === post.id)
      .map((reply) => ({
        ...reply,
        reactions: replyReactionRows.filter(
          (reaction) => reaction.replyId === reply.id,
        ),
        attachments: attachments.filter(
          (attachment) =>
            attachment.parentType === "reply" &&
            attachment.parentId === reply.id,
        ),
      })),
  }));
}
