"use server";

import { and, asc, eq, inArray, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import { hasExactCurriculumChangeScope } from "@/lib/courses/curriculum-change-rules";
import type {
  CurriculumApplyResult,
  CurriculumCoverageChange,
} from "@/lib/courses/curriculum-contract";
import { reserveUniqueSlug } from "@/lib/courses/core";
import {
  canEditCourse,
  loadCoursePermissionContext,
} from "@/lib/courses/permissions";
import { db } from "@/lib/db/client";
import {
  courseCurriculumVersions,
  coursePages,
  courseSubtopicPrerequisites,
  courseSubtopics,
  courseTopics,
} from "@/lib/db/schema";

const courseIdentitySchema = z.object({
  coursePageId: z.string().uuid(),
  courseSlug: z.string().min(1).max(120),
});

const topicSchema = courseIdentitySchema.extend({
  topicId: z.string().uuid(),
});

const subtopicSchema = courseIdentitySchema.extend({
  subtopicId: z.string().uuid(),
});

const topicEditSchema = topicSchema.extend({
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2_000).optional(),
});

const addTopicSchema = courseIdentitySchema.extend({
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2_000).optional(),
});

const subtopicEditSchema = subtopicSchema.extend({
  name: z.string().trim().min(1).max(220),
  description: z.string().trim().max(2_000).optional(),
  depthLevel: z.enum(["awareness", "procedural", "fluency", "proof"]),
  estHours: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().min(0).max(999).optional(),
  ),
  coverage: z.enum(["unknown", "covered", "not_covered"]).optional(),
});

const addSubtopicSchema = courseIdentitySchema.extend({
  topicId: z.string().uuid(),
  name: z.string().trim().min(1).max(220),
  description: z.string().trim().max(2_000).optional(),
  depthLevel: z.enum(["awareness", "procedural", "fluency", "proof"]),
  estHours: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().min(0).max(999).optional(),
  ),
});

async function editableDraft(coursePageId: string) {
  const studentId = await currentStudentId();
  if (!studentId) return null;
  const context = await loadCoursePermissionContext(coursePageId, studentId);
  if (!context || !canEditCourse(context)) return null;

  const [draft] = await db
    .select({
      id: courseCurriculumVersions.id,
      version: courseCurriculumVersions.version,
    })
    .from(courseCurriculumVersions)
    .where(
      and(
        eq(courseCurriculumVersions.coursePageId, coursePageId),
        eq(courseCurriculumVersions.status, "draft"),
      ),
    )
    .limit(1);
  return draft ? { ...draft, studentId } : null;
}

async function topicInDraft(topicId: string, draftId: string) {
  const [topic] = await db
    .select()
    .from(courseTopics)
    .where(
      and(
        eq(courseTopics.id, topicId),
        eq(courseTopics.curriculumVersionId, draftId),
      ),
    )
    .limit(1);
  return topic ?? null;
}

async function subtopicInDraft(subtopicId: string, draftId: string) {
  const [subtopic] = await db
    .select({
      id: courseSubtopics.id,
      courseTopicId: courseSubtopics.courseTopicId,
      position: courseSubtopics.position,
    })
    .from(courseSubtopics)
    .innerJoin(courseTopics, eq(courseSubtopics.courseTopicId, courseTopics.id))
    .where(
      and(
        eq(courseSubtopics.id, subtopicId),
        eq(courseTopics.curriculumVersionId, draftId),
      ),
    )
    .limit(1);
  return subtopic ?? null;
}

export async function addCourseTopicAction(formData: FormData) {
  const parsed = addTopicSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return;
  const draft = await editableDraft(parsed.data.coursePageId);
  if (!draft) return;

  const existing = await db
    .select({ slug: courseTopics.slug })
    .from(courseTopics)
    .where(eq(courseTopics.curriculumVersionId, draft.id));
  const [last] = await db
    .select({ position: max(courseTopics.position) })
    .from(courseTopics)
    .where(eq(courseTopics.curriculumVersionId, draft.id));
  await db.insert(courseTopics).values({
    curriculumVersionId: draft.id,
    slug: reserveUniqueSlug(
      parsed.data.name,
      new Set(existing.map((topic) => topic.slug)),
    ),
    name: parsed.data.name,
    description: parsed.data.description || null,
    position: Number(last?.position ?? 0) + 1,
    provenance: "course",
  });
  await touchDraft(draft.id, parsed.data.courseSlug);
}

export async function updateCourseTopicAction(formData: FormData) {
  const parsed = topicEditSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    topicId: formData.get("topicId"),
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return;
  const draft = await editableDraft(parsed.data.coursePageId);
  if (!draft || !(await topicInDraft(parsed.data.topicId, draft.id))) return;

  await db
    .update(courseTopics)
    .set({
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .where(eq(courseTopics.id, parsed.data.topicId));
  await touchDraft(draft.id, parsed.data.courseSlug);
}

export async function setCourseTopicHiddenAction(formData: FormData) {
  const parsed = topicSchema
    .extend({ hidden: z.enum(["yes", "no"]) })
    .safeParse({
      coursePageId: formData.get("coursePageId"),
      courseSlug: formData.get("courseSlug"),
      topicId: formData.get("topicId"),
      hidden: formData.get("hidden"),
    });
  if (!parsed.success) return;
  const draft = await editableDraft(parsed.data.coursePageId);
  if (!draft || !(await topicInDraft(parsed.data.topicId, draft.id))) return;
  await db
    .update(courseTopics)
    .set({ hiddenAt: parsed.data.hidden === "yes" ? new Date() : null })
    .where(eq(courseTopics.id, parsed.data.topicId));
  await touchDraft(draft.id, parsed.data.courseSlug);
}

export async function moveCourseTopicAction(formData: FormData) {
  const parsed = topicSchema
    .extend({ direction: z.enum(["up", "down"]) })
    .safeParse({
      coursePageId: formData.get("coursePageId"),
      courseSlug: formData.get("courseSlug"),
      topicId: formData.get("topicId"),
      direction: formData.get("direction"),
    });
  if (!parsed.success) return;
  const draft = await editableDraft(parsed.data.coursePageId);
  if (!draft) return;

  const rows = await db
    .select({ id: courseTopics.id, position: courseTopics.position })
    .from(courseTopics)
    .where(eq(courseTopics.curriculumVersionId, draft.id))
    .orderBy(asc(courseTopics.position));
  const index = rows.findIndex((row) => row.id === parsed.data.topicId);
  const otherIndex = parsed.data.direction === "up" ? index - 1 : index + 1;
  if (index < 0 || otherIndex < 0 || otherIndex >= rows.length) return;
  const current = rows[index];
  const other = rows[otherIndex];
  await db.transaction(async (tx) => {
    await tx
      .update(courseTopics)
      .set({ position: other.position })
      .where(eq(courseTopics.id, current.id));
    await tx
      .update(courseTopics)
      .set({ position: current.position })
      .where(eq(courseTopics.id, other.id));
    await tx
      .update(courseCurriculumVersions)
      .set({ updatedAt: new Date() })
      .where(eq(courseCurriculumVersions.id, draft.id));
  });
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

export async function addCourseSubtopicAction(formData: FormData) {
  const parsed = addSubtopicSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    topicId: formData.get("topicId"),
    name: formData.get("name"),
    description: formData.get("description"),
    depthLevel: formData.get("depthLevel"),
    estHours: formData.get("estHours"),
  });
  if (!parsed.success) return;
  const draft = await editableDraft(parsed.data.coursePageId);
  if (!draft || !(await topicInDraft(parsed.data.topicId, draft.id))) return;

  const existing = await db
    .select({ slug: courseSubtopics.slug })
    .from(courseSubtopics)
    .where(eq(courseSubtopics.courseTopicId, parsed.data.topicId));
  const [last] = await db
    .select({ position: max(courseSubtopics.position) })
    .from(courseSubtopics)
    .where(eq(courseSubtopics.courseTopicId, parsed.data.topicId));
  await db.insert(courseSubtopics).values({
    courseTopicId: parsed.data.topicId,
    slug: reserveUniqueSlug(
      parsed.data.name,
      new Set(existing.map((subtopic) => subtopic.slug)),
    ),
    name: parsed.data.name,
    description: parsed.data.description || null,
    depthLevel: parsed.data.depthLevel,
    estHours: parsed.data.estHours?.toString(),
    position: Number(last?.position ?? 0) + 1,
    provenance: "course",
    coverage: "unknown",
  });
  await touchDraft(draft.id, parsed.data.courseSlug);
}

export async function updateCourseSubtopicAction(formData: FormData) {
  const parsed = subtopicEditSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    subtopicId: formData.get("subtopicId"),
    name: formData.get("name"),
    description: formData.get("description"),
    depthLevel: formData.get("depthLevel"),
    estHours: formData.get("estHours"),
    coverage: formData.get("coverage"),
  });
  if (!parsed.success) return;
  const draft = await editableDraft(parsed.data.coursePageId);
  if (!draft || !(await subtopicInDraft(parsed.data.subtopicId, draft.id))) {
    return;
  }
  await db
    .update(courseSubtopics)
    .set({
      name: parsed.data.name,
      description: parsed.data.description || null,
      depthLevel: parsed.data.depthLevel,
      estHours: parsed.data.estHours?.toString() ?? null,
      ...(parsed.data.coverage ? { coverage: parsed.data.coverage } : {}),
    })
    .where(eq(courseSubtopics.id, parsed.data.subtopicId));
  await touchDraft(draft.id, parsed.data.courseSlug);
}

export async function setCourseSubtopicHiddenAction(formData: FormData) {
  const parsed = subtopicSchema
    .extend({ hidden: z.enum(["yes", "no"]) })
    .safeParse({
      coursePageId: formData.get("coursePageId"),
      courseSlug: formData.get("courseSlug"),
      subtopicId: formData.get("subtopicId"),
      hidden: formData.get("hidden"),
    });
  if (!parsed.success) return;
  const draft = await editableDraft(parsed.data.coursePageId);
  if (!draft || !(await subtopicInDraft(parsed.data.subtopicId, draft.id))) {
    return;
  }
  await db
    .update(courseSubtopics)
    .set({ hiddenAt: parsed.data.hidden === "yes" ? new Date() : null })
    .where(eq(courseSubtopics.id, parsed.data.subtopicId));
  await touchDraft(draft.id, parsed.data.courseSlug);
}

export async function moveCourseSubtopicAction(formData: FormData) {
  const parsed = subtopicSchema
    .extend({ direction: z.enum(["up", "down"]) })
    .safeParse({
      coursePageId: formData.get("coursePageId"),
      courseSlug: formData.get("courseSlug"),
      subtopicId: formData.get("subtopicId"),
      direction: formData.get("direction"),
    });
  if (!parsed.success) return;
  const draft = await editableDraft(parsed.data.coursePageId);
  if (!draft) return;
  const current = await subtopicInDraft(parsed.data.subtopicId, draft.id);
  if (!current) return;

  const rows = await db
    .select({ id: courseSubtopics.id, position: courseSubtopics.position })
    .from(courseSubtopics)
    .where(eq(courseSubtopics.courseTopicId, current.courseTopicId))
    .orderBy(asc(courseSubtopics.position));
  const index = rows.findIndex((row) => row.id === current.id);
  const otherIndex = parsed.data.direction === "up" ? index - 1 : index + 1;
  if (index < 0 || otherIndex < 0 || otherIndex >= rows.length) return;
  const other = rows[otherIndex];
  await db.transaction(async (tx) => {
    await tx
      .update(courseSubtopics)
      .set({ position: other.position })
      .where(eq(courseSubtopics.id, current.id));
    await tx
      .update(courseSubtopics)
      .set({ position: current.position })
      .where(eq(courseSubtopics.id, other.id));
    await tx
      .update(courseCurriculumVersions)
      .set({ updatedAt: new Date() })
      .where(eq(courseCurriculumVersions.id, draft.id));
  });
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

export async function bulkUpdateCourseSubtopicsAction(formData: FormData) {
  const parsed = courseIdentitySchema
    .extend({
      subtopicIds: z.array(z.string().uuid()).min(1).max(500),
      operation: z.enum([
        "covered",
        "not_covered",
        "unknown",
        "hide",
        "restore",
      ]),
    })
    .safeParse({
      coursePageId: formData.get("coursePageId"),
      courseSlug: formData.get("courseSlug"),
      subtopicIds: formData.getAll("subtopicIds"),
      operation: formData.get("operation"),
    });
  if (!parsed.success) return;
  const draft = await editableDraft(parsed.data.coursePageId);
  if (!draft) return;

  const allowedRows = await db
    .select({ id: courseSubtopics.id })
    .from(courseSubtopics)
    .innerJoin(courseTopics, eq(courseSubtopics.courseTopicId, courseTopics.id))
    .where(
      and(
        eq(courseTopics.curriculumVersionId, draft.id),
        inArray(courseSubtopics.id, parsed.data.subtopicIds),
      ),
    );
  const allowedIds = allowedRows.map((row) => row.id);
  if (allowedIds.length === 0) return;

  if (parsed.data.operation === "hide" || parsed.data.operation === "restore") {
    await db
      .update(courseSubtopics)
      .set({
        hiddenAt: parsed.data.operation === "hide" ? new Date() : null,
      })
      .where(inArray(courseSubtopics.id, allowedIds));
  } else {
    await db
      .update(courseSubtopics)
      .set({ coverage: parsed.data.operation })
      .where(inArray(courseSubtopics.id, allowedIds));
  }
  await touchDraft(draft.id, parsed.data.courseSlug);
}

const curriculumApplySchema = courseIdentitySchema.extend({
  changes: z
    .array(
      z.object({
        subtopicStableId: z.string().uuid(),
        coverage: z.enum(["unknown", "covered", "not_covered"]),
      }),
    )
    .max(500),
});

class CurriculumApplyError extends Error {
  constructor(
    readonly code: NonNullable<CurriculumApplyResult["code"]>,
    message: string,
  ) {
    super(message);
  }
}

export async function applyCurriculumChangesAction(input: {
  coursePageId: string;
  courseSlug: string;
  changes: CurriculumCoverageChange[];
}): Promise<CurriculumApplyResult> {
  const parsed = curriculumApplySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid",
      message: "Check the pending changes and try again.",
    };
  }
  if (
    new Set(parsed.data.changes.map((change) => change.subtopicStableId))
      .size !== parsed.data.changes.length
  ) {
    return {
      ok: false,
      code: "invalid",
      message: "A subtopic was submitted more than once.",
    };
  }

  const studentId = await currentStudentId();
  if (!studentId) {
    return {
      ok: false,
      code: "forbidden",
      message: "Sign in to apply curriculum changes.",
    };
  }
  const context = await loadCoursePermissionContext(
    parsed.data.coursePageId,
    studentId,
  );
  if (!context || !canEditCourse(context)) {
    return {
      ok: false,
      code: "forbidden",
      message: "Only the Owner or a Co-owner can edit the curriculum.",
    };
  }

  try {
    const updatedAt = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select ${coursePages.id} from ${coursePages} where ${coursePages.id} = ${parsed.data.coursePageId} for update`,
      );
      const [course] = await tx
        .select({ id: coursePages.id })
        .from(coursePages)
        .where(
          and(
            eq(coursePages.id, parsed.data.coursePageId),
            eq(coursePages.slug, parsed.data.courseSlug),
          ),
        )
        .limit(1);
      if (!course) {
        throw new CurriculumApplyError(
          "cross_course",
          "The submitted course identity does not match this curriculum.",
        );
      }

      const [draft] = await tx
        .select({
          id: courseCurriculumVersions.id,
          version: courseCurriculumVersions.version,
        })
        .from(courseCurriculumVersions)
        .where(
          and(
            eq(courseCurriculumVersions.coursePageId, parsed.data.coursePageId),
            eq(courseCurriculumVersions.status, "draft"),
          ),
        )
        .limit(1);
      if (!draft) {
        throw new CurriculumApplyError(
          "failed",
          "The editable curriculum is unavailable. Reload and try again.",
        );
      }

      if (parsed.data.changes.length) {
        const stableIds = parsed.data.changes.map(
          (change) => change.subtopicStableId,
        );
        const allowedRows = await tx
          .select({ stableId: courseSubtopics.stableId })
          .from(courseSubtopics)
          .innerJoin(
            courseTopics,
            eq(courseSubtopics.courseTopicId, courseTopics.id),
          )
          .where(
            and(
              eq(courseTopics.curriculumVersionId, draft.id),
              inArray(courseSubtopics.stableId, stableIds),
            ),
          );
        if (
          !hasExactCurriculumChangeScope(
            stableIds,
            allowedRows.map((row) => row.stableId),
          )
        ) {
          throw new CurriculumApplyError(
            "cross_course",
            "One or more subtopics do not belong to this course.",
          );
        }
        const values = sql.join(
          parsed.data.changes.map(
            (change) =>
              sql`(${change.subtopicStableId}::uuid, ${change.coverage}::course_coverage_state)`,
          ),
          sql`, `,
        );
        await tx.execute(sql`
          update "course_subtopics" as subtopic
          set "coverage" = changes.coverage
          from (values ${values}) as changes(stable_id, coverage),
               "course_topics" as topic
          where subtopic."stable_id" = changes.stable_id
            and topic."id" = subtopic."course_topic_id"
            and topic."curriculum_version_id" = ${draft.id}
        `);
      }

      const sourceTopics = await tx
        .select()
        .from(courseTopics)
        .where(eq(courseTopics.curriculumVersionId, draft.id))
        .orderBy(asc(courseTopics.position));
      const sourceSubtopics = await tx
        .select()
        .from(courseSubtopics)
        .innerJoin(
          courseTopics,
          eq(courseSubtopics.courseTopicId, courseTopics.id),
        )
        .where(eq(courseTopics.curriculumVersionId, draft.id))
        .then((rows) => rows.map((row) => row.course_subtopics));
      if (
        sourceTopics.every((topic) => topic.hiddenAt !== null) ||
        sourceSubtopics.every((subtopic) => subtopic.hiddenAt !== null)
      ) {
        throw new Error("A published curriculum needs visible content");
      }

      await tx
        .update(courseCurriculumVersions)
        .set({ status: "archived" })
        .where(
          and(
            eq(courseCurriculumVersions.coursePageId, parsed.data.coursePageId),
            eq(courseCurriculumVersions.status, "published"),
          ),
        );
      const now = new Date();
      await tx
        .update(courseCurriculumVersions)
        .set({ status: "published", publishedAt: now, updatedAt: now })
        .where(eq(courseCurriculumVersions.id, draft.id));

      const [highestVersion] = await tx
        .select({ value: max(courseCurriculumVersions.version) })
        .from(courseCurriculumVersions)
        .where(
          eq(courseCurriculumVersions.coursePageId, parsed.data.coursePageId),
        );
      const [nextDraft] = await tx
        .insert(courseCurriculumVersions)
        .values({
          coursePageId: parsed.data.coursePageId,
          version: Number(highestVersion?.value ?? draft.version) + 1,
          status: "draft",
          basedOnVersionId: draft.id,
          createdBy: studentId,
        })
        .returning({ id: courseCurriculumVersions.id });

      const nextTopics = await tx
        .insert(courseTopics)
        .values(
          sourceTopics.map((topic) => ({
            curriculumVersionId: nextDraft.id,
            stableId: topic.stableId,
            sourceTemplateTopicId: topic.sourceTemplateTopicId,
            provenance: topic.provenance,
            slug: topic.slug,
            name: topic.name,
            description: topic.description,
            position: topic.position,
            hiddenAt: topic.hiddenAt,
          })),
        )
        .returning({
          id: courseTopics.id,
          stableId: courseTopics.stableId,
        });
      const nextTopicByStableId = new Map(
        nextTopics.map((topic) => [topic.stableId, topic.id]),
      );
      const sourceTopicById = new Map(
        sourceTopics.map((topic) => [topic.id, topic]),
      );
      const nextSubtopics = await tx
        .insert(courseSubtopics)
        .values(
          sourceSubtopics.map((subtopic) => {
            const sourceTopic = sourceTopicById.get(subtopic.courseTopicId);
            const courseTopicId = sourceTopic
              ? nextTopicByStableId.get(sourceTopic.stableId)
              : undefined;
            if (!courseTopicId) {
              throw new Error("Failed to clone a course topic");
            }
            return {
              courseTopicId,
              stableId: subtopic.stableId,
              sourceTemplateSubtopicId: subtopic.sourceTemplateSubtopicId,
              provenance: subtopic.provenance,
              slug: subtopic.slug,
              name: subtopic.name,
              description: subtopic.description,
              depthLevel: subtopic.depthLevel,
              estHours: subtopic.estHours,
              position: subtopic.position,
              coverage: subtopic.coverage,
              hiddenAt: subtopic.hiddenAt,
            };
          }),
        )
        .returning({
          id: courseSubtopics.id,
          stableId: courseSubtopics.stableId,
        });
      const nextSubtopicByStableId = new Map(
        nextSubtopics.map((subtopic) => [subtopic.stableId, subtopic.id]),
      );
      const sourceSubtopicById = new Map(
        sourceSubtopics.map((subtopic) => [subtopic.id, subtopic]),
      );
      const sourceIds = sourceSubtopics.map((subtopic) => subtopic.id);
      const edges =
        sourceIds.length > 0
          ? await tx
              .select()
              .from(courseSubtopicPrerequisites)
              .where(inArray(courseSubtopicPrerequisites.subtopicId, sourceIds))
          : [];
      const nextEdges = edges.flatMap((edge) => {
        const source = sourceSubtopicById.get(edge.subtopicId);
        const prerequisite = sourceSubtopicById.get(edge.prerequisiteId);
        const subtopicId = source
          ? nextSubtopicByStableId.get(source.stableId)
          : undefined;
        const prerequisiteId = prerequisite
          ? nextSubtopicByStableId.get(prerequisite.stableId)
          : undefined;
        return subtopicId && prerequisiteId
          ? [{ subtopicId, prerequisiteId }]
          : [];
      });
      if (nextEdges.length > 0) {
        await tx
          .insert(courseSubtopicPrerequisites)
          .values(nextEdges)
          .onConflictDoNothing();
      }
      await tx
        .update(coursePages)
        .set({ updatedAt: now })
        .where(eq(coursePages.id, parsed.data.coursePageId));
      return now;
    });

    revalidatePath("/");
    revalidatePath("/courses");
    revalidatePath("/my-courses");
    revalidatePath(`/courses/${parsed.data.courseSlug}`);
    revalidatePath(`/courses/${parsed.data.courseSlug}/settings/curriculum`);
    return {
      ok: true,
      message: "Curriculum changes applied.",
      updatedAt: updatedAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof CurriculumApplyError) {
      return { ok: false, code: error.code, message: error.message };
    }
    return {
      ok: false,
      code: "failed",
      message:
        "The curriculum could not be applied. Your pending changes are still available.",
    };
  }
}

/** Compatibility action for old forms; standard UI uses the staged Apply bar. */
export async function publishCourseCurriculumAction(formData: FormData) {
  const parsed = courseIdentitySchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
  });
  if (!parsed.success) return;
  await applyCurriculumChangesAction({ ...parsed.data, changes: [] });
}

async function touchDraft(draftId: string, courseSlug: string) {
  await db
    .update(courseCurriculumVersions)
    .set({ updatedAt: new Date() })
    .where(eq(courseCurriculumVersions.id, draftId));
  revalidatePath(`/courses/${courseSlug}`);
}
