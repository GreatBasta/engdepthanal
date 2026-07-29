import "server-only";

import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  courseCurriculumVersions,
  courseMembers,
  coursePages,
  coursePageTemplates,
  courseSubtopicPrerequisites,
  courseSubtopics,
  courseTopics,
  curriculumTemplates,
  templateSubtopicPrerequisites,
  templateSubtopics,
  templateTopics,
} from "@/lib/db/schema";

import {
  courseDuplicateKey,
  normalizeCourseText,
  reserveUniqueSlug,
  slugifyCourse,
} from "./core";

export interface CreateCourseInput {
  universityProgramId: string;
  localName: string;
  courseCode?: string | null;
  professorName?: string | null;
  academicYear: string;
  cohortYear?: number | null;
  semester?: number | null;
  description?: string | null;
  visibility: "public" | "unlisted" | "private";
  attendance: "attended" | "not_attended";
  templateIds: string[];
  createdBy: string;
}

export interface DuplicateCourseWarning {
  slug: string;
  localName: string;
  courseCode: string | null;
  professorName: string | null;
  academicYear: string;
  semester: number | null;
  visibility: "public" | "unlisted" | "private";
}

export async function findDuplicateCourses(
  input: Omit<CreateCourseInput, "templateIds" | "attendance">,
): Promise<DuplicateCourseWarning[]> {
  const duplicateKey = courseDuplicateKey(input);
  const normalizedName = normalizeCourseText(input.localName);
  const normalizedCode = normalizeCourseText(input.courseCode);

  return db
    .select({
      slug: coursePages.slug,
      localName: coursePages.localName,
      courseCode: coursePages.courseCode,
      professorName: coursePages.professorName,
      academicYear: coursePages.academicYear,
      semester: coursePages.semester,
      visibility: coursePages.visibility,
    })
    .from(coursePages)
    .leftJoin(
      courseMembers,
      and(
        eq(courseMembers.coursePageId, coursePages.id),
        eq(courseMembers.studentId, input.createdBy),
      ),
    )
    .where(
      and(
        eq(coursePages.universityProgramId, input.universityProgramId),
        sql`${coursePages.archivedAt} is null`,
        or(
          eq(coursePages.duplicateKey, duplicateKey),
          and(
            sql`lower(trim(${coursePages.localName})) = ${normalizedName}`,
            eq(coursePages.academicYear, input.academicYear),
            input.semester == null
              ? sql`${coursePages.semester} is null`
              : eq(coursePages.semester, input.semester),
          ),
          normalizedCode
            ? and(
                sql`lower(trim(coalesce(${coursePages.courseCode}, ''))) = ${normalizedCode}`,
                eq(coursePages.academicYear, input.academicYear),
              )
            : undefined,
        ),
        or(
          ne(coursePages.visibility, "private"),
          isNotNull(courseMembers.studentId),
        ),
      ),
    )
    .orderBy(asc(coursePages.createdAt))
    .limit(5);
}

export async function createCourseFromTemplates(input: CreateCourseInput) {
  const requestedTemplateIds = Array.from(new Set(input.templateIds));
  if (requestedTemplateIds.length === 0) {
    throw new Error("At least one curriculum template is required");
  }

  return db.transaction(async (tx) => {
    const selectedTemplates = await tx
      .select()
      .from(curriculumTemplates)
      .where(
        and(
          inArray(curriculumTemplates.id, requestedTemplateIds),
          eq(curriculumTemplates.isActive, true),
        ),
      );
    if (selectedTemplates.length !== requestedTemplateIds.length) {
      throw new Error("One or more curriculum templates are unavailable");
    }

    const templateOrder = new Map(
      requestedTemplateIds.map((templateId, index) => [templateId, index]),
    );
    selectedTemplates.sort(
      (left, right) =>
        (templateOrder.get(left.id) ?? 0) - (templateOrder.get(right.id) ?? 0),
    );

    const baseSlug = slugifyCourse(
      [input.localName, input.courseCode, input.academicYear]
        .filter(Boolean)
        .join("-"),
    );
    const slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
    const [course] = await tx
      .insert(coursePages)
      .values({
        slug,
        universityProgramId: input.universityProgramId,
        localName: input.localName,
        courseCode: input.courseCode || null,
        professorName: input.professorName || null,
        academicYear: input.academicYear,
        cohortYear: input.cohortYear ?? null,
        semester: input.semester ?? null,
        description: input.description || null,
        visibility: input.visibility,
        duplicateKey: courseDuplicateKey(input),
        createdBy: input.createdBy,
      })
      .returning({ id: coursePages.id, slug: coursePages.slug });

    await tx.insert(courseMembers).values({
      coursePageId: course.id,
      studentId: input.createdBy,
      role: "owner",
      attendance: input.attendance,
    });

    await tx.insert(coursePageTemplates).values(
      selectedTemplates.map((template, position) => ({
        coursePageId: course.id,
        templateId: template.id,
        position: position + 1,
        addedBy: input.createdBy,
      })),
    );

    const [version] = await tx
      .insert(courseCurriculumVersions)
      .values({
        coursePageId: course.id,
        version: 1,
        status: "draft",
        createdBy: input.createdBy,
      })
      .returning({ id: courseCurriculumVersions.id });

    const sourceTopics = await tx
      .select()
      .from(templateTopics)
      .where(inArray(templateTopics.templateId, requestedTemplateIds));
    sourceTopics.sort((left, right) => {
      const templateDifference =
        (templateOrder.get(left.templateId) ?? 0) -
        (templateOrder.get(right.templateId) ?? 0);
      return templateDifference || left.position - right.position;
    });

    const usedTopicSlugs = new Set<string>();
    const clonedTopics = await tx
      .insert(courseTopics)
      .values(
        sourceTopics.map((topic, position) => ({
          curriculumVersionId: version.id,
          stableId: topic.id,
          sourceTemplateTopicId: topic.id,
          provenance: "template" as const,
          slug: reserveUniqueSlug(topic.slug, usedTopicSlugs),
          name: topic.name,
          description: topic.description,
          position: position + 1,
        })),
      )
      .returning({
        id: courseTopics.id,
        sourceTemplateTopicId: courseTopics.sourceTemplateTopicId,
      });

    const courseTopicByTemplateId = new Map(
      clonedTopics.flatMap((topic) =>
        topic.sourceTemplateTopicId
          ? [[topic.sourceTemplateTopicId, topic.id] as const]
          : [],
      ),
    );
    const sourceTopicPosition = new Map(
      sourceTopics.map((topic, index) => [topic.id, index]),
    );
    const sourceSubtopics = await tx
      .select()
      .from(templateSubtopics)
      .where(
        inArray(
          templateSubtopics.templateTopicId,
          sourceTopics.map((topic) => topic.id),
        ),
      );
    sourceSubtopics.sort((left, right) => {
      const topicDifference =
        (sourceTopicPosition.get(left.templateTopicId) ?? 0) -
        (sourceTopicPosition.get(right.templateTopicId) ?? 0);
      return topicDifference || left.position - right.position;
    });

    const usedSubtopicSlugs = new Map<string, Set<string>>();
    const clonedSubtopics = await tx
      .insert(courseSubtopics)
      .values(
        sourceSubtopics.map((subtopic) => {
          const courseTopicId = courseTopicByTemplateId.get(
            subtopic.templateTopicId,
          );
          if (!courseTopicId) {
            throw new Error("Failed to map a template topic into the course");
          }
          const used =
            usedSubtopicSlugs.get(courseTopicId) ?? new Set<string>();
          usedSubtopicSlugs.set(courseTopicId, used);
          return {
            courseTopicId,
            stableId: subtopic.id,
            sourceTemplateSubtopicId: subtopic.id,
            provenance: "template" as const,
            slug: reserveUniqueSlug(subtopic.slug, used),
            name: subtopic.name,
            description: subtopic.description,
            depthLevel: subtopic.depthLevel,
            estHours: subtopic.estHours,
            position: subtopic.position,
            coverage: "unknown" as const,
          };
        }),
      )
      .returning({
        id: courseSubtopics.id,
        sourceTemplateSubtopicId: courseSubtopics.sourceTemplateSubtopicId,
      });

    const courseSubtopicByTemplateId = new Map(
      clonedSubtopics.flatMap((subtopic) =>
        subtopic.sourceTemplateSubtopicId
          ? [[subtopic.sourceTemplateSubtopicId, subtopic.id] as const]
          : [],
      ),
    );
    const sourceSubtopicIds = sourceSubtopics.map((subtopic) => subtopic.id);
    const sourceEdges =
      sourceSubtopicIds.length > 0
        ? await tx
            .select()
            .from(templateSubtopicPrerequisites)
            .where(
              inArray(
                templateSubtopicPrerequisites.subtopicId,
                sourceSubtopicIds,
              ),
            )
        : [];
    const clonedEdges = sourceEdges.flatMap((edge) => {
      const subtopicId = courseSubtopicByTemplateId.get(edge.subtopicId);
      const prerequisiteId = courseSubtopicByTemplateId.get(
        edge.prerequisiteId,
      );
      return subtopicId && prerequisiteId
        ? [{ subtopicId, prerequisiteId }]
        : [];
    });
    if (clonedEdges.length > 0) {
      await tx
        .insert(courseSubtopicPrerequisites)
        .values(clonedEdges)
        .onConflictDoNothing();
    }

    return course;
  });
}

