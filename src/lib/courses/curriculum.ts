import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  courseCurriculumVersions,
  courseSubtopics,
  courseTopics,
} from "@/lib/db/schema";

export type CurriculumView = "draft" | "published";

export async function getCourseCurriculum(
  coursePageId: string,
  view: CurriculumView,
) {
  const [version] = await db
    .select({
      id: courseCurriculumVersions.id,
      version: courseCurriculumVersions.version,
      status: courseCurriculumVersions.status,
      updatedAt: courseCurriculumVersions.updatedAt,
      publishedAt: courseCurriculumVersions.publishedAt,
    })
    .from(courseCurriculumVersions)
    .where(
      and(
        eq(courseCurriculumVersions.coursePageId, coursePageId),
        eq(courseCurriculumVersions.status, view),
      ),
    )
    .limit(1);
  if (!version) return null;

  const [topicRows, subtopicRows] = await Promise.all([
    db
      .select()
      .from(courseTopics)
      .where(eq(courseTopics.curriculumVersionId, version.id))
      .orderBy(asc(courseTopics.position)),
    db
      .select({
        id: courseSubtopics.id,
        courseTopicId: courseSubtopics.courseTopicId,
        stableId: courseSubtopics.stableId,
        sourceTemplateSubtopicId:
          courseSubtopics.sourceTemplateSubtopicId,
        provenance: courseSubtopics.provenance,
        slug: courseSubtopics.slug,
        name: courseSubtopics.name,
        description: courseSubtopics.description,
        depthLevel: courseSubtopics.depthLevel,
        estHours: courseSubtopics.estHours,
        position: courseSubtopics.position,
        coverage: courseSubtopics.coverage,
        hiddenAt: courseSubtopics.hiddenAt,
      })
      .from(courseSubtopics)
      .innerJoin(courseTopics, eq(courseSubtopics.courseTopicId, courseTopics.id))
      .where(eq(courseTopics.curriculumVersionId, version.id))
      .orderBy(asc(courseTopics.position), asc(courseSubtopics.position)),
  ]);

  const subtopicsByTopic = new Map<
    string,
    (typeof subtopicRows)[number][]
  >();
  for (const subtopic of subtopicRows) {
    const list = subtopicsByTopic.get(subtopic.courseTopicId) ?? [];
    list.push(subtopic);
    subtopicsByTopic.set(subtopic.courseTopicId, list);
  }

  return {
    version,
    topics: topicRows.map((topic) => ({
      ...topic,
      subtopics: subtopicsByTopic.get(topic.id) ?? [],
    })),
  };
}

