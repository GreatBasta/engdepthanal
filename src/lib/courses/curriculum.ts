import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  courseCurriculumVersions,
  courseSubtopicProgress,
  courseSubtopics,
  courseTopics,
} from "@/lib/db/schema";

import type { CurriculumTopicPayload } from "./curriculum-contract";

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
      createdAt: courseCurriculumVersions.createdAt,
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
        sourceTemplateSubtopicId: courseSubtopics.sourceTemplateSubtopicId,
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
      .innerJoin(
        courseTopics,
        eq(courseSubtopics.courseTopicId, courseTopics.id),
      )
      .where(eq(courseTopics.curriculumVersionId, version.id))
      .orderBy(asc(courseTopics.position), asc(courseSubtopics.position)),
  ]);

  const subtopicsByTopic = new Map<string, (typeof subtopicRows)[number][]>();
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
      createdAt: courseCurriculumVersions.createdAt,
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
      subtopicCount: sql<number>`count(${courseSubtopics.id})::int`,
      classifiedCount: sql<number>`count(${courseSubtopics.id}) filter (where ${courseSubtopics.coverage} <> 'unknown')::int`,
      coveredCount: sql<number>`count(${courseSubtopics.id}) filter (where ${courseSubtopics.coverage} = 'covered')::int`,
      notCoveredCount: sql<number>`count(${courseSubtopics.id}) filter (where ${courseSubtopics.coverage} = 'not_covered')::int`,
    })
    .from(courseTopics)
    .leftJoin(
      courseSubtopics,
      and(
        eq(courseSubtopics.courseTopicId, courseTopics.id),
        view === "published" ? isNull(courseSubtopics.hiddenAt) : undefined,
      ),
    )
    .where(eq(courseTopics.curriculumVersionId, version.id))
    .groupBy(courseTopics.id)
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
          sourceTemplateSubtopicId: courseSubtopics.sourceTemplateSubtopicId,
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

/** Loads one topic after local accordion expansion, keeping closed topics out of the client payload. */
export async function getCourseCurriculumTopic(
  coursePageId: string,
  view: CurriculumView,
  topicStableId: string,
  studentId: string | null,
): Promise<CurriculumTopicPayload | null> {
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

  const [topic] = await db
    .select({
      id: courseTopics.id,
      stableId: courseTopics.stableId,
      name: courseTopics.name,
      description: courseTopics.description,
      position: courseTopics.position,
      provenance: courseTopics.provenance,
      hiddenAt: courseTopics.hiddenAt,
    })
    .from(courseTopics)
    .where(
      and(
        eq(courseTopics.curriculumVersionId, version.id),
        eq(courseTopics.stableId, topicStableId),
        view === "published" ? isNull(courseTopics.hiddenAt) : undefined,
      ),
    )
    .limit(1);
  if (!topic) return null;

  const subtopics = await db
    .select({
      id: courseSubtopics.id,
      stableId: courseSubtopics.stableId,
      name: courseSubtopics.name,
      description: courseSubtopics.description,
      depthLevel: courseSubtopics.depthLevel,
      estHours: courseSubtopics.estHours,
      position: courseSubtopics.position,
      provenance: courseSubtopics.provenance,
      coverage: courseSubtopics.coverage,
      hiddenAt: courseSubtopics.hiddenAt,
    })
    .from(courseSubtopics)
    .where(
      and(
        eq(courseSubtopics.courseTopicId, topic.id),
        view === "published" ? isNull(courseSubtopics.hiddenAt) : undefined,
      ),
    )
    .orderBy(asc(courseSubtopics.position));

  const progressRows =
    studentId && subtopics.length
      ? await db
          .select({
            stableId: courseSubtopicProgress.courseSubtopicStableId,
            state: courseSubtopicProgress.state,
          })
          .from(courseSubtopicProgress)
          .where(
            and(
              eq(courseSubtopicProgress.coursePageId, coursePageId),
              eq(courseSubtopicProgress.studentId, studentId),
            ),
          )
      : [];
  const progressByStableId = new Map(
    progressRows.map((row) => [row.stableId, row.state]),
  );
  const visibleSubtopics = subtopics.map((subtopic) => ({
    id: subtopic.id,
    stableId: subtopic.stableId,
    name: subtopic.name,
    description: subtopic.description,
    depthLevel: subtopic.depthLevel,
    estHours: subtopic.estHours,
    position: subtopic.position,
    provenance: subtopic.provenance,
    coverage: subtopic.coverage,
    hidden: subtopic.hiddenAt !== null,
    progress: progressByStableId.get(subtopic.stableId) ?? null,
  }));

  return {
    topic: {
      id: topic.id,
      stableId: topic.stableId,
      name: topic.name,
      description: topic.description,
      position: topic.position,
      provenance: topic.provenance,
      hidden: topic.hiddenAt !== null,
      subtopicCount: visibleSubtopics.length,
      classifiedCount: visibleSubtopics.filter(
        (subtopic) => subtopic.coverage !== "unknown",
      ).length,
      coveredCount: visibleSubtopics.filter(
        (subtopic) => subtopic.coverage === "covered",
      ).length,
      notCoveredCount: visibleSubtopics.filter(
        (subtopic) => subtopic.coverage === "not_covered",
      ).length,
    },
    subtopics: visibleSubtopics,
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
      .innerJoin(
        courseTopics,
        eq(courseSubtopics.courseTopicId, courseTopics.id),
      )
      .where(eq(courseTopics.curriculumVersionId, version.id))
      .orderBy(asc(courseTopics.position), asc(courseSubtopics.position)),
  ]);

  const subtopicsByTopic = new Map<string, (typeof subtopicRows)[number][]>();
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
