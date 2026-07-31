"use server";

import { and, count, eq, gte, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import {
  canEditCourse,
  canModerateCourse,
  canPostToCourse,
  loadCoursePermissionContext,
} from "@/lib/courses/permissions";
import { db } from "@/lib/db/client";
import {
  courseAttachments,
  courseCurriculumVersions,
  courseExamProfiles,
  courseSubtopics,
  courseTopics,
  examExperiences,
  examMergeRequests,
  examQuestions,
  examQuestionVotes,
  moderationActions,
  questionOccurrences,
} from "@/lib/db/schema";
import { findLikelyQuestionDuplicates } from "@/lib/courses/question-duplicates";
import { consumeRateLimit } from "@/lib/rate-limit";

const courseIdentitySchema = z.object({
  coursePageId: z.string().uuid(),
  courseSlug: z.string().min(1).max(120),
});

async function examAuthorization(
  coursePageId: string,
  permission: "post" | "edit" | "moderate",
) {
  const studentId = await currentStudentId();
  if (!studentId) return null;
  const context = await loadCoursePermissionContext(coursePageId, studentId);
  if (!context) return null;
  const allowed =
    permission === "post"
      ? canPostToCourse(context)
      : permission === "edit"
        ? canEditCourse(context)
        : canModerateCourse(context);
  return allowed ? { studentId, context } : null;
}

export async function saveExamProfileAction(formData: FormData) {
  const parsed = courseIdentitySchema
    .extend({
      assessmentType: z
        .enum(["written", "oral", "practical", "project", "mixed"])
        .optional(),
      format: z.string().trim().max(500).optional(),
      gradingScale: z.string().trim().max(120).optional(),
      lastVerifiedAcademicYear: z.string().trim().max(20).optional(),
      durationMinutes: z.preprocess(
        (value) => (value === "" || value == null ? undefined : value),
        z.coerce.number().int().min(1).max(24 * 60).optional(),
      ),
      details: z.string().trim().max(4_000).optional(),
    })
    .safeParse({
      coursePageId: formData.get("coursePageId"),
      courseSlug: formData.get("courseSlug"),
      assessmentType: formData.get("assessmentType") || undefined,
      format: formData.get("format"),
      gradingScale: formData.get("gradingScale"),
      lastVerifiedAcademicYear: formData.get("lastVerifiedAcademicYear"),
      durationMinutes: formData.get("durationMinutes"),
      details: formData.get("details"),
    });
  if (!parsed.success) return;
  const authorized = await examAuthorization(
    parsed.data.coursePageId,
    "edit",
  );
  if (!authorized) return;

  const values = {
    assessmentType: parsed.data.assessmentType ?? null,
    format: parsed.data.format || null,
    gradingScale: parsed.data.gradingScale || null,
    durationMinutes: parsed.data.durationMinutes ?? null,
    openBook: formData.get("openBook") === "yes",
    calculatorAllowed: formData.get("calculatorAllowed") === "yes",
    details: parsed.data.details || null,
    lastVerifiedAcademicYear:
      parsed.data.lastVerifiedAcademicYear || null,
    studentReported: true,
    updatedBy: authorized.studentId,
    updatedAt: new Date(),
  };
  await db
    .insert(courseExamProfiles)
    .values({
      coursePageId: parsed.data.coursePageId,
      verificationCount: 1,
      ...values,
    })
    .onConflictDoUpdate({
      target: courseExamProfiles.coursePageId,
      set: {
        ...values,
        verificationCount: sql`${courseExamProfiles.verificationCount} + 1`,
      },
    });
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

export async function createExamExperienceAction(formData: FormData) {
  const parsed = courseIdentitySchema
    .extend({
      title: z.string().trim().min(2).max(180),
      body: z.string().trim().min(1).max(20_000),
      academicYear: z.string().trim().max(20).optional(),
      examDate: z
        .preprocess(
          (value) => (value === "" || value == null ? undefined : value),
          z.string().date().optional(),
        ),
      grade: z.string().trim().max(40).optional(),
    })
    .safeParse({
      coursePageId: formData.get("coursePageId"),
      courseSlug: formData.get("courseSlug"),
      title: formData.get("title"),
      body: formData.get("body"),
      academicYear: formData.get("academicYear"),
      examDate: formData.get("examDate"),
      grade: formData.get("grade"),
    });
  if (!parsed.success) return;
  const authorized = await examAuthorization(
    parsed.data.coursePageId,
    "post",
  );
  if (!authorized) return;

  const [recent] = await db
    .select({ value: count() })
    .from(examExperiences)
    .where(
      and(
        eq(examExperiences.authorId, authorized.studentId),
        gte(
          examExperiences.createdAt,
          new Date(Date.now() - 24 * 60 * 60 * 1_000),
        ),
      ),
    );
  if (Number(recent?.value ?? 0) >= 10) return;

  await db.insert(examExperiences).values({
    coursePageId: parsed.data.coursePageId,
    authorId: authorized.studentId,
    title: parsed.data.title,
    body: parsed.data.body,
    academicYear: parsed.data.academicYear || null,
    examDate: parsed.data.examDate || null,
    grade: parsed.data.grade || null,
    anonymous: formData.get("anonymous") === "yes",
  });
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

export interface ExamQuestionFormState {
  error: string | null;
  message: string | null;
  suggestions: Array<{ id: string; prompt: string; similarity: number }>;
}

export async function createExamQuestionAction(
  _previous: ExamQuestionFormState,
  formData: FormData,
): Promise<ExamQuestionFormState> {
  const contextTarget = String(formData.get("contextTarget") ?? "course");
  const [context, contextStableId] = contextTarget.split(":", 2);
  const parsed = courseIdentitySchema
    .extend({
      prompt: z.string().trim().min(4).max(10_000),
      answerGuidance: z.string().trim().max(10_000).optional(),
      questionType: z
        .enum([
          "calculation",
          "conceptual",
          "proof",
          "oral_prompt",
          "practical",
          "project",
        ])
        .optional(),
      topicStableId: z.string().uuid().optional(),
      subtopicStableId: z.string().uuid().optional(),
      difficulty: z.preprocess(
        (value) => (value === "" || value == null ? undefined : value),
        z.coerce.number().int().min(1).max(5).optional(),
      ),
    })
    .safeParse({
      coursePageId: formData.get("coursePageId"),
      courseSlug: formData.get("courseSlug"),
      prompt: formData.get("prompt"),
      answerGuidance: formData.get("answerGuidance"),
      questionType: formData.get("questionType") || undefined,
      topicStableId: context === "topic" ? contextStableId : undefined,
      subtopicStableId: context === "subtopic" ? contextStableId : undefined,
      difficulty: formData.get("difficulty"),
    });
  if (!parsed.success) {
    return {
      error: "Check the question fields and try again.",
      message: null,
      suggestions: [],
    };
  }
  const authorized = await examAuthorization(
    parsed.data.coursePageId,
    "post",
  );
  if (!authorized) {
    return {
      error: "Join this course before contributing exam questions.",
      message: null,
      suggestions: [],
    };
  }

  if (
    !(await examQuestionTargetExists(
      parsed.data.coursePageId,
      parsed.data.topicStableId,
      parsed.data.subtopicStableId,
    ))
  ) {
    return {
      error: "The selected curriculum context is unavailable.",
      message: null,
      suggestions: [],
    };
  }

  const candidates = await db
    .select({ id: examQuestions.id, prompt: examQuestions.prompt })
    .from(examQuestions)
    .where(
      and(
        eq(examQuestions.coursePageId, parsed.data.coursePageId),
        eq(examQuestions.status, "active"),
        isNull(examQuestions.hiddenAt),
      ),
    )
    .limit(250);
  const suggestions = findLikelyQuestionDuplicates(
    parsed.data.prompt,
    candidates,
  );
  if (suggestions.length && formData.get("duplicateOverride") !== "yes") {
    return {
      error: null,
      message:
        "Similar questions already exist. Reuse one, or confirm that this is distinct.",
      suggestions,
    };
  }

  if (
    !(await consumeRateLimit({
      action: "exam-question",
      identifier: authorized.studentId,
      limit: 30,
      windowMinutes: 60,
    }))
  ) {
    return {
      error: "Question limit reached. Try again later.",
      message: null,
      suggestions: [],
    };
  }

  await db.insert(examQuestions).values({
    coursePageId: parsed.data.coursePageId,
    createdBy: authorized.studentId,
    prompt: parsed.data.prompt,
    answerGuidance: parsed.data.answerGuidance || null,
    questionType: parsed.data.questionType ?? null,
    courseTopicStableId: parsed.data.topicStableId ?? null,
    courseSubtopicStableId: parsed.data.subtopicStableId ?? null,
    difficulty: parsed.data.difficulty ?? null,
  });
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
  return {
    error: null,
    message: "Question added.",
    suggestions: [],
  };
}

export async function reportQuestionOccurrenceAction(formData: FormData) {
  const parsed = courseIdentitySchema
    .extend({
      questionId: z.string().uuid(),
      sessionLabel: z.string().trim().min(2).max(120),
      occurredOn: z.preprocess(
        (value) => (value === "" || value == null ? undefined : value),
        z.string().date().optional(),
      ),
      notes: z.string().trim().max(2_000).optional(),
      professorName: z.string().trim().max(120).optional(),
    })
    .safeParse({
      coursePageId: formData.get("coursePageId"),
      courseSlug: formData.get("courseSlug"),
      questionId: formData.get("questionId"),
      sessionLabel: formData.get("sessionLabel"),
      occurredOn: formData.get("occurredOn"),
      notes: formData.get("notes"),
      professorName: formData.get("professorName"),
    });
  if (!parsed.success) return;
  const authorized = await examAuthorization(
    parsed.data.coursePageId,
    "post",
  );
  if (!authorized) return;
  if (
    !(await activeQuestionBelongsToCourse(
      parsed.data.questionId,
      parsed.data.coursePageId,
    ))
  ) {
    return;
  }
  if (
    !(await consumeRateLimit({
      action: "exam-occurrence",
      identifier: authorized.studentId,
      limit: 40,
      windowMinutes: 24 * 60,
    }))
  ) {
    return;
  }

  await db
    .insert(questionOccurrences)
    .values({
      questionId: parsed.data.questionId,
      reportedBy: authorized.studentId,
      sessionLabel: parsed.data.sessionLabel,
      occurredOn: parsed.data.occurredOn || null,
      notes: parsed.data.notes || null,
      professorName: parsed.data.professorName || null,
    })
    .onConflictDoNothing();
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

export async function voteExamQuestionAction(formData: FormData) {
  const parsed = courseIdentitySchema
    .extend({
      questionId: z.string().uuid(),
      value: z.coerce.number().int().refine((value) => value === -1 || value === 1),
    })
    .safeParse({
      coursePageId: formData.get("coursePageId"),
      courseSlug: formData.get("courseSlug"),
      questionId: formData.get("questionId"),
      value: formData.get("value"),
    });
  if (!parsed.success) return;
  const authorized = await examAuthorization(
    parsed.data.coursePageId,
    "post",
  );
  if (!authorized) return;
  if (
    !(await activeQuestionBelongsToCourse(
      parsed.data.questionId,
      parsed.data.coursePageId,
    ))
  ) {
    return;
  }
  await db
    .insert(examQuestionVotes)
    .values({
      questionId: parsed.data.questionId,
      studentId: authorized.studentId,
      value: parsed.data.value,
    })
    .onConflictDoUpdate({
      target: [examQuestionVotes.questionId, examQuestionVotes.studentId],
      set: { value: parsed.data.value, updatedAt: new Date() },
    });
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

export async function requestQuestionMergeAction(formData: FormData) {
  const parsed = courseIdentitySchema
    .extend({
      sourceQuestionId: z.string().uuid(),
      targetQuestionId: z.string().uuid(),
      rationale: z.string().trim().min(4).max(2_000),
    })
    .refine(
      (value) => value.sourceQuestionId !== value.targetQuestionId,
      "Choose two different questions",
    )
    .safeParse({
      coursePageId: formData.get("coursePageId"),
      courseSlug: formData.get("courseSlug"),
      sourceQuestionId: formData.get("sourceQuestionId"),
      targetQuestionId: formData.get("targetQuestionId"),
      rationale: formData.get("rationale"),
    });
  if (!parsed.success) return;
  const authorized = await examAuthorization(
    parsed.data.coursePageId,
    "post",
  );
  if (!authorized) return;

  const [sourceAllowed, targetAllowed] = await Promise.all([
    activeQuestionBelongsToCourse(
      parsed.data.sourceQuestionId,
      parsed.data.coursePageId,
    ),
    activeQuestionBelongsToCourse(
      parsed.data.targetQuestionId,
      parsed.data.coursePageId,
    ),
  ]);
  if (!sourceAllowed || !targetAllowed) return;

  await db
    .insert(examMergeRequests)
    .values({
      coursePageId: parsed.data.coursePageId,
      sourceQuestionId: parsed.data.sourceQuestionId,
      targetQuestionId: parsed.data.targetQuestionId,
      requestedBy: authorized.studentId,
      rationale: parsed.data.rationale,
    })
    .onConflictDoNothing();
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

export async function reviewQuestionMergeAction(formData: FormData) {
  const parsed = courseIdentitySchema
    .extend({
      mergeRequestId: z.string().uuid(),
      decision: z.enum(["accepted", "rejected"]),
    })
    .safeParse({
      coursePageId: formData.get("coursePageId"),
      courseSlug: formData.get("courseSlug"),
      mergeRequestId: formData.get("mergeRequestId"),
      decision: formData.get("decision"),
    });
  if (!parsed.success) return;
  const authorized = await examAuthorization(
    parsed.data.coursePageId,
    "moderate",
  );
  if (!authorized) return;

  const [request] = await db
    .select()
    .from(examMergeRequests)
    .where(
      and(
        eq(examMergeRequests.id, parsed.data.mergeRequestId),
        eq(examMergeRequests.coursePageId, parsed.data.coursePageId),
        eq(examMergeRequests.status, "open"),
      ),
    )
    .limit(1);
  if (!request) return;

  await db.transaction(async (tx) => {
    if (parsed.data.decision === "accepted") {
      const sourceOccurrences = await tx
        .select()
        .from(questionOccurrences)
        .where(eq(questionOccurrences.questionId, request.sourceQuestionId));
      if (sourceOccurrences.length > 0) {
        await tx
          .insert(questionOccurrences)
          .values(
            sourceOccurrences.map((occurrence) => ({
              questionId: request.targetQuestionId,
              reportedBy: occurrence.reportedBy,
              experienceId: occurrence.experienceId,
              sessionLabel: occurrence.sessionLabel,
              occurredOn: occurrence.occurredOn,
              notes: occurrence.notes,
              createdAt: occurrence.createdAt,
            })),
          )
          .onConflictDoNothing();
        await tx
          .delete(questionOccurrences)
          .where(eq(questionOccurrences.questionId, request.sourceQuestionId));
      }

      const sourceVotes = await tx
        .select()
        .from(examQuestionVotes)
        .where(eq(examQuestionVotes.questionId, request.sourceQuestionId));
      if (sourceVotes.length > 0) {
        await tx
          .insert(examQuestionVotes)
          .values(
            sourceVotes.map((vote) => ({
              questionId: request.targetQuestionId,
              studentId: vote.studentId,
              value: vote.value,
              createdAt: vote.createdAt,
              updatedAt: vote.updatedAt,
            })),
          )
          .onConflictDoNothing();
        await tx
          .delete(examQuestionVotes)
          .where(eq(examQuestionVotes.questionId, request.sourceQuestionId));
      }

      await tx
        .update(courseAttachments)
        .set({ parentId: request.targetQuestionId })
        .where(
          and(
            eq(courseAttachments.parentType, "exam_question"),
            eq(courseAttachments.parentId, request.sourceQuestionId),
          ),
        );
      await tx
        .update(examQuestions)
        .set({
          status: "merged",
          mergedIntoId: request.targetQuestionId,
          updatedAt: new Date(),
        })
        .where(eq(examQuestions.id, request.sourceQuestionId));
    }

    await tx
      .update(examMergeRequests)
      .set({
        status: parsed.data.decision,
        reviewedBy: authorized.studentId,
        reviewedAt: new Date(),
      })
      .where(eq(examMergeRequests.id, request.id));
  });
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

export async function setExamContentHiddenAction(formData: FormData) {
  const parsed = courseIdentitySchema
    .extend({
      targetType: z.enum(["exam_experience", "exam_question"]),
      targetId: z.string().uuid(),
      hidden: z.enum(["yes", "no"]),
    })
    .safeParse({
      coursePageId: formData.get("coursePageId"),
      courseSlug: formData.get("courseSlug"),
      targetType: formData.get("targetType"),
      targetId: formData.get("targetId"),
      hidden: formData.get("hidden"),
    });
  if (!parsed.success) return;
  const authorized = await examAuthorization(
    parsed.data.coursePageId,
    "moderate",
  );
  if (!authorized) return;
  const hiddenAt = parsed.data.hidden === "yes" ? new Date() : null;
  if (parsed.data.targetType === "exam_experience") {
    await db
      .update(examExperiences)
      .set({ hiddenAt })
      .where(
        and(
          eq(examExperiences.id, parsed.data.targetId),
          eq(examExperiences.coursePageId, parsed.data.coursePageId),
        ),
      );
  } else {
    await db
      .update(examQuestions)
      .set({ hiddenAt })
      .where(
        and(
          eq(examQuestions.id, parsed.data.targetId),
          eq(examQuestions.coursePageId, parsed.data.coursePageId),
        ),
      );
  }
  await db.insert(moderationActions).values({
    coursePageId: parsed.data.coursePageId,
    actorId: authorized.studentId,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    action: parsed.data.hidden === "yes" ? "hide" : "restore",
    reason: "Exam content moderator action",
  });
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

async function activeQuestionBelongsToCourse(
  questionId: string,
  coursePageId: string,
) {
  const [question] = await db
    .select({ id: examQuestions.id })
    .from(examQuestions)
    .where(
      and(
        eq(examQuestions.id, questionId),
        eq(examQuestions.coursePageId, coursePageId),
        eq(examQuestions.status, "active"),
      ),
    )
    .limit(1);
  return Boolean(question);
}

async function examQuestionTargetExists(
  coursePageId: string,
  topicStableId?: string,
  subtopicStableId?: string,
) {
  if (!topicStableId && !subtopicStableId) return true;
  if (topicStableId && subtopicStableId) return false;
  if (topicStableId) {
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
        eq(courseSubtopics.stableId, subtopicStableId!),
        isNull(courseTopics.hiddenAt),
        isNull(courseSubtopics.hiddenAt),
      ),
    )
    .limit(1);
  return Boolean(subtopic);
}
