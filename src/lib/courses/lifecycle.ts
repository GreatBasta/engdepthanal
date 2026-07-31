import "server-only";

import { del } from "@vercel/blob";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  courseAttachments,
  courseMembers,
  coursePages,
} from "@/lib/db/schema";

async function getOwnedCourse(coursePageId: string, studentId: string) {
  const [course] = await db
    .select({
      id: coursePages.id,
      slug: coursePages.slug,
      localName: coursePages.localName,
      archivedAt: coursePages.archivedAt,
    })
    .from(coursePages)
    .innerJoin(
      courseMembers,
      and(
        eq(courseMembers.coursePageId, coursePages.id),
        eq(courseMembers.studentId, studentId),
        eq(courseMembers.role, "owner"),
      ),
    )
    .where(eq(coursePages.id, coursePageId))
    .limit(1);
  return course ?? null;
}

export async function archiveOwnedCourse(
  coursePageId: string,
  studentId: string,
) {
  const course = await getOwnedCourse(coursePageId, studentId);
  if (!course || course.archivedAt) return null;
  await db
    .update(coursePages)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(coursePages.id, coursePageId));
  return course;
}

export async function restoreOwnedCourse(
  coursePageId: string,
  studentId: string,
) {
  const course = await getOwnedCourse(coursePageId, studentId);
  if (!course?.archivedAt) return null;
  await db
    .update(coursePages)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(coursePages.id, coursePageId));
  return course;
}

export async function permanentlyDeleteOwnedCourse(
  coursePageId: string,
  studentId: string,
  confirmation: string,
) {
  const course = await getOwnedCourse(coursePageId, studentId);
  if (
    !course?.archivedAt ||
    confirmation.trim() !== course.localName
  ) {
    return null;
  }

  const attachments = await db
    .select({ blobUrl: courseAttachments.blobUrl })
    .from(courseAttachments)
    .where(eq(courseAttachments.coursePageId, coursePageId));
  if (attachments.length) {
    await del(attachments.map((attachment) => attachment.blobUrl));
  }

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`delete from course_exam_materials where course_page_id = ${coursePageId}`,
    );
    await tx.execute(
      sql`delete from exam_merge_requests where course_page_id = ${coursePageId}`,
    );
    await tx.execute(
      sql`delete from question_occurrences where question_id in (select id from exam_questions where course_page_id = ${coursePageId})`,
    );
    await tx.execute(
      sql`delete from exam_question_votes where question_id in (select id from exam_questions where course_page_id = ${coursePageId})`,
    );
    await tx.execute(
      sql`delete from exam_questions where course_page_id = ${coursePageId}`,
    );
    await tx.execute(
      sql`delete from exam_experiences where course_page_id = ${coursePageId}`,
    );
    await tx.execute(
      sql`delete from course_exam_profiles where course_page_id = ${coursePageId}`,
    );

    await tx.execute(
      sql`delete from content_reports where course_page_id = ${coursePageId}`,
    );
    await tx.execute(
      sql`delete from moderation_actions where course_page_id = ${coursePageId}`,
    );
    await tx.execute(
      sql`delete from course_attachments where course_page_id = ${coursePageId}`,
    );

    await tx.execute(
      sql`delete from course_resource_comments where resource_id in (select id from course_resources where course_page_id = ${coursePageId})`,
    );
    await tx.execute(
      sql`delete from course_resource_reactions where resource_id in (select id from course_resources where course_page_id = ${coursePageId})`,
    );
    await tx.execute(
      sql`delete from course_resources where course_page_id = ${coursePageId}`,
    );

    await tx.execute(
      sql`delete from course_reply_reactions where reply_id in (select course_replies.id from course_replies inner join course_posts on course_replies.post_id = course_posts.id where course_posts.course_page_id = ${coursePageId})`,
    );
    await tx.execute(
      sql`delete from course_post_reactions where post_id in (select id from course_posts where course_page_id = ${coursePageId})`,
    );
    await tx.execute(
      sql`delete from course_replies where post_id in (select id from course_posts where course_page_id = ${coursePageId})`,
    );
    await tx.execute(
      sql`delete from course_posts where course_page_id = ${coursePageId}`,
    );

    await tx.execute(
      sql`delete from course_subtopic_progress where course_page_id = ${coursePageId}`,
    );
    await tx.execute(
      sql`delete from course_subtopic_prerequisites where subtopic_id in (
        select course_subtopics.id from course_subtopics
        inner join course_topics on course_subtopics.course_topic_id = course_topics.id
        inner join course_curriculum_versions on course_topics.curriculum_version_id = course_curriculum_versions.id
        where course_curriculum_versions.course_page_id = ${coursePageId}
      ) or prerequisite_id in (
        select course_subtopics.id from course_subtopics
        inner join course_topics on course_subtopics.course_topic_id = course_topics.id
        inner join course_curriculum_versions on course_topics.curriculum_version_id = course_curriculum_versions.id
        where course_curriculum_versions.course_page_id = ${coursePageId}
      )`,
    );
    await tx.execute(
      sql`delete from course_subtopics where course_topic_id in (
        select course_topics.id from course_topics
        inner join course_curriculum_versions on course_topics.curriculum_version_id = course_curriculum_versions.id
        where course_curriculum_versions.course_page_id = ${coursePageId}
      )`,
    );
    await tx.execute(
      sql`delete from course_topics where curriculum_version_id in (
        select id from course_curriculum_versions where course_page_id = ${coursePageId}
      )`,
    );
    await tx.execute(
      sql`delete from course_curriculum_versions where course_page_id = ${coursePageId}`,
    );
    await tx.execute(
      sql`delete from course_invites where course_page_id = ${coursePageId}`,
    );
    await tx.execute(
      sql`delete from course_members where course_page_id = ${coursePageId}`,
    );
    await tx.execute(
      sql`delete from course_page_templates where course_page_id = ${coursePageId}`,
    );
    await tx.execute(
      sql`delete from course_pages where id = ${coursePageId}`,
    );
  });
  return course;
}
