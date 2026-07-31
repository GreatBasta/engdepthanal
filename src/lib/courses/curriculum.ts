import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

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

/**
 * Lightweight curriculum shape for the interactive outline. It loads topic
 * headers and counts first, then fetches subtopics for only the explicitly
 * opened topic. Closed topics never inflate the initial HTML.
 */
export async function getCourseCurriculumOutline(
  coursePageId: string,
  view: CurriculumView,
  selectedTopicStableId?: string,
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

  const topicRows = await db
    .select({
      id: courseTopics.id,
      curriculumVersionId: courseTopics.curriculumVersionId,
      stableId: courseTopics.stableId,
      sourceTemplateTopicId: courseTopics.sourceTemplateTopicId,
      provenance: courseTopics.provenance,
      slug: courseTopics.slug,
      name: courseTopics.name,
      description: courseTopics.description,
      position: courseTopics.position,
      hiddenAt: courseTopics.hiddenAt,
      subtopicCount: sql<number>`(
        select count(*)::int
        from course_subtopics outline_subtopic
        where outline_subtopic.course_topic_id = ${courseTopics.id}
      )`,
    })
    .from(courseTopics)
    .where(eq(courseTopics.curriculumVersionId, version.id))
    .orderBy(asc(courseTopics.position));

  const selectedTopic = selectedTopicStableId
    ? topicRows.find((topic) => topic.stableId === selectedTopicStableId)
    : undefined;
  const selectedSubtopics = selectedTopic
    ? await db
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
        .where(eq(courseSubtopics.courseTopicId, selectedTopic.id))
        .orderBy(asc(courseSubtopics.position))
    : [];

  return {
    version,
    topics: topicRows.map((topic) => ({
      ...topic,
      subtopics: topic.id === selectedTopic?.id ? selectedSubtopics : [],
    })),
  };
}

/**
 * Names-only index for contextual pickers. Resources and exams do not need
 * curriculum descriptions, coverage, hours, or provenance just to populate
 * their topic/subtopic selectors.
 */
export async function getCourseCurriculumIndex(
  coursePageId: string,
  view: CurriculumView,
) {
  const [version] = await db
    .select({ id: courseCurriculumVersions.id })
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
      .select({
        id: courseTopics.id,
        stableId: courseTopics.stableId,
        name: courseTopics.name,
        position: courseTopics.position,
        hiddenAt: courseTopics.hiddenAt,
      })
      .from(courseTopics)
      .where(eq(courseTopics.curriculumVersionId, version.id))
      .orderBy(asc(courseTopics.position)),
    db
      .select({
        courseTopicId: courseSubtopics.courseTopicId,
        stableId: courseSubtopics.stableId,
        name: courseSubtopics.name,
        position: courseSubtopics.position,
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
    topics: topicRows.map((topic) => ({
      ...topic,
      subtopics: subtopicsByTopic.get(topic.id) ?? [],
    })),
  };
}

