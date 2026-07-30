import "server-only";

import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  inArray,
  isNull,
  sum,
} from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  courseAttachments,
  courseExamProfiles,
  courseResources,
  examExperiences,
  examMergeRequests,
  examQuestions,
  examQuestionVotes,
  questionOccurrences,
  students,
} from "@/lib/db/schema";

import { rankExamQuestion } from "./exam-ranking";

export async function getCourseExam(
  coursePageId: string,
  includeHidden: boolean,
) {
  const [profileRows, experienceRows, questionRows, materialRows] =
    await Promise.all([
    db
      .select()
      .from(courseExamProfiles)
      .where(eq(courseExamProfiles.coursePageId, coursePageId))
      .limit(1),
    db
      .select({
        id: examExperiences.id,
        authorId: examExperiences.authorId,
        authorName: students.displayName,
        title: examExperiences.title,
        body: examExperiences.body,
        academicYear: examExperiences.academicYear,
        examDate: examExperiences.examDate,
        grade: examExperiences.grade,
        anonymous: examExperiences.anonymous,
        hiddenAt: examExperiences.hiddenAt,
        createdAt: examExperiences.createdAt,
      })
      .from(examExperiences)
      .innerJoin(students, eq(examExperiences.authorId, students.id))
      .where(
        and(
          eq(examExperiences.coursePageId, coursePageId),
          includeHidden ? undefined : isNull(examExperiences.hiddenAt),
        ),
      )
      .orderBy(desc(examExperiences.createdAt)),
    db
      .select({
        id: examQuestions.id,
        creatorName: students.displayName,
        prompt: examQuestions.prompt,
        answerGuidance: examQuestions.answerGuidance,
        courseTopicStableId: examQuestions.courseTopicStableId,
        courseSubtopicStableId: examQuestions.courseSubtopicStableId,
        questionType: examQuestions.questionType,
        difficulty: examQuestions.difficulty,
        status: examQuestions.status,
        mergedIntoId: examQuestions.mergedIntoId,
        hiddenAt: examQuestions.hiddenAt,
        createdAt: examQuestions.createdAt,
      })
      .from(examQuestions)
      .innerJoin(students, eq(examQuestions.createdBy, students.id))
      .where(
        and(
          eq(examQuestions.coursePageId, coursePageId),
          includeHidden ? undefined : isNull(examQuestions.hiddenAt),
          eq(examQuestions.status, "active"),
        ),
      )
      .orderBy(desc(examQuestions.createdAt)),
    db
      .select({
        id: courseResources.id,
        title: courseResources.title,
        body: courseResources.body,
        linkUrl: courseResources.linkUrl,
        createdAt: courseResources.createdAt,
        authorName: students.displayName,
      })
      .from(courseResources)
      .innerJoin(students, eq(courseResources.authorId, students.id))
      .where(
        and(
          eq(courseResources.coursePageId, coursePageId),
          eq(courseResources.context, "exam"),
          eq(courseResources.type, "permitted_material"),
          eq(courseResources.permissionConfirmed, true),
          isNull(courseResources.hiddenAt),
          isNull(courseResources.deletedAt),
        ),
      )
      .orderBy(desc(courseResources.createdAt)),
    ]);

  const questionIds = questionRows.map((question) => question.id);
  const experienceIds = experienceRows.map((experience) => experience.id);
  const materialIds = materialRows.map((material) => material.id);
  const [
    occurrenceAggregates,
    voteAggregates,
    occurrenceRows,
    attachmentRows,
    mergeRows,
  ] = await Promise.all([
    questionIds.length > 0
      ? db
          .select({
            questionId: questionOccurrences.questionId,
            occurrences: count(),
            distinctSessions: countDistinct(questionOccurrences.sessionLabel),
            distinctContributors: countDistinct(
              questionOccurrences.reportedBy,
            ),
          })
          .from(questionOccurrences)
          .where(inArray(questionOccurrences.questionId, questionIds))
          .groupBy(questionOccurrences.questionId)
      : Promise.resolve([]),
    questionIds.length > 0
      ? db
          .select({
            questionId: examQuestionVotes.questionId,
            netVotes: sum(examQuestionVotes.value),
          })
          .from(examQuestionVotes)
          .where(inArray(examQuestionVotes.questionId, questionIds))
          .groupBy(examQuestionVotes.questionId)
      : Promise.resolve([]),
    questionIds.length > 0
      ? db
          .select({
            id: questionOccurrences.id,
            questionId: questionOccurrences.questionId,
            sessionLabel: questionOccurrences.sessionLabel,
            occurredOn: questionOccurrences.occurredOn,
            notes: questionOccurrences.notes,
            professorName: questionOccurrences.professorName,
            createdAt: questionOccurrences.createdAt,
          })
          .from(questionOccurrences)
          .where(inArray(questionOccurrences.questionId, questionIds))
          .orderBy(desc(questionOccurrences.createdAt))
      : Promise.resolve([]),
    questionIds.length > 0 ||
    experienceIds.length > 0 ||
    materialIds.length > 0
      ? db
          .select({
            id: courseAttachments.id,
            parentType: courseAttachments.parentType,
            parentId: courseAttachments.parentId,
            fileName: courseAttachments.fileName,
            mimeType: courseAttachments.mimeType,
            sizeBytes: courseAttachments.sizeBytes,
            access: courseAttachments.access,
          })
          .from(courseAttachments)
          .where(
            and(
              eq(courseAttachments.coursePageId, coursePageId),
              isNull(courseAttachments.deletedAt),
            ),
          )
      : Promise.resolve([]),
    db
      .select()
      .from(examMergeRequests)
      .where(
        and(
          eq(examMergeRequests.coursePageId, coursePageId),
          eq(examMergeRequests.status, "open"),
        ),
      )
      .orderBy(asc(examMergeRequests.createdAt)),
  ]);

  return {
    profile: profileRows[0] ?? null,
    materials: materialRows.map((material) => ({
      ...material,
      attachments: attachmentRows.filter(
        (attachment) =>
          attachment.parentType === "course_resource" &&
          attachment.parentId === material.id,
      ),
    })),
    experiences: experienceRows.map((experience) => ({
      ...experience,
      attachments: attachmentRows.filter(
        (attachment) =>
          attachment.parentType === "exam_experience" &&
          attachment.parentId === experience.id,
      ),
    })),
    questions: questionRows.map((question) => {
      const occurrences = Number(
        occurrenceAggregates.find((row) => row.questionId === question.id)
          ?.occurrences ?? 0,
      );
      const distinctSessions = Number(
        occurrenceAggregates.find((row) => row.questionId === question.id)
          ?.distinctSessions ?? 0,
      );
      const netVotes = Number(
        voteAggregates.find((row) => row.questionId === question.id)
          ?.netVotes ?? 0,
      );
      const distinctContributors = Number(
        occurrenceAggregates.find((row) => row.questionId === question.id)
          ?.distinctContributors ?? 0,
      );
      return {
        ...question,
        evidence: {
          occurrences,
          distinctSessions,
          distinctContributors,
          netVotes,
        },
        rank: rankExamQuestion({
          occurrences,
          distinctSessions,
          distinctContributors,
          netVotes,
        }),
        occurrences: occurrenceRows.filter(
          (row) => row.questionId === question.id,
        ),
        attachments: attachmentRows.filter(
          (attachment) =>
            attachment.parentType === "exam_question" &&
            attachment.parentId === question.id,
        ),
      };
    }),
    mergeRequests: mergeRows,
  };
}
