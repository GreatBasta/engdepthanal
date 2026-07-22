"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import {
  coverageResponses,
  curriculumSuggestions,
  subjectEnrollments,
  subjects,
  subtopics,
  topics,
} from "@/lib/db/schema";
import { getStudentEnrollment } from "@/lib/enrollment";
import { normalizeGrade } from "@/lib/grades";
import { recomputeSubjectAggregates } from "@/lib/aggregate";

/**
 * Resolve the current student's FINISHED subject enrollment. The survey is
 * only ever available for subjects the student has marked finished
 * (STRUCTURE.md §2.4) — enforced here and again by the DB trigger.
 */
async function requireFinishedEnrollment(subjectSlug: string) {
  const studentId = await currentStudentId();
  if (!studentId) throw new Error("not authenticated");

  const enrollment = await getStudentEnrollment(studentId);
  if (!enrollment) throw new Error("not onboarded");

  const [subject] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.slug, subjectSlug))
    .limit(1);
  if (!subject) throw new Error("unknown subject");

  const [subjectEnrollment] = await db
    .select()
    .from(subjectEnrollments)
    .where(
      and(
        eq(subjectEnrollments.enrollmentId, enrollment.id),
        eq(subjectEnrollments.subjectId, subject.id),
      ),
    )
    .limit(1);
  if (!subjectEnrollment || subjectEnrollment.status !== "finished") {
    throw new Error("subject is not finished");
  }
  return {
    studentId,
    enrollment,
    subjectEnrollment,
    subjectId: subject.id,
  };
}

const gradeSchema = z.object({
  subjectSlug: z.string().min(1),
  scale: z.string().min(1),
  rawValue: z.string().min(1),
  nextHref: z.string().startsWith("/"),
});

/** Save the student's grade (normalized to 0–100), then advance. */
export async function saveGrade(input: unknown) {
  const { subjectSlug, scale, rawValue, nextHref } = gradeSchema.parse(input);
  const { enrollment, subjectEnrollment, subjectId } =
    await requireFinishedEnrollment(subjectSlug);

  const normalized = normalizeGrade(scale, rawValue);
  if (!normalized) throw new Error("invalid grade for the chosen scale");

  await db
    .update(subjectEnrollments)
    .set({
      gradeScale: normalized.scale,
      gradeValue: normalized.rawValue,
      gradeNormalized: String(normalized.normalized),
    })
    .where(eq(subjectEnrollments.id, subjectEnrollment.id));

  // The grade feeds the average in the aggregates — refresh them.
  await recomputeSubjectAggregates(enrollment.universityProgramId, subjectId);

  revalidatePath(`/subjects/${subjectSlug}/survey`);
  redirect(nextHref);
}

const answersSchema = z.object({
  subjectSlug: z.string().min(1),
  topicId: z.string().uuid(),
  answers: z.record(
    z.string().uuid(),
    z.enum(["yes_depth", "yes_brief", "no", "unsure"]),
  ),
  suggestion: z.string().trim().max(2000).optional(),
  nextHref: z.string().startsWith("/"),
});

/**
 * Save one topic's coverage answers (partial is fine — resumable) plus an
 * optional "my course also covered X" note, then advance to the next step.
 */
export async function saveTopicAnswers(input: unknown) {
  const { subjectSlug, topicId, answers, suggestion, nextHref } =
    answersSchema.parse(input);
  const { studentId, enrollment, subjectEnrollment, subjectId } =
    await requireFinishedEnrollment(subjectSlug);

  // The topic must belong to this subject.
  const [topic] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.id, topicId), eq(topics.subjectId, subjectId)))
    .limit(1);
  if (!topic) throw new Error("topic not in subject");

  const answerEntries = Object.entries(answers);
  if (answerEntries.length > 0) {
    // Only accept answers for subtopics that actually belong to this topic.
    const validIds = new Set(
      (
        await db
          .select({ id: subtopics.id })
          .from(subtopics)
          .where(
            and(
              eq(subtopics.topicId, topicId),
              inArray(
                subtopics.id,
                answerEntries.map(([id]) => id),
              ),
            ),
          )
      ).map((r) => r.id),
    );

    const now = new Date();
    const rows = answerEntries
      .filter(([id]) => validIds.has(id))
      .map(([subtopicId, answer]) => ({
        subjectEnrollmentId: subjectEnrollment.id,
        subtopicId,
        answer,
        answeredAt: now,
        updatedAt: now,
      }));

    if (rows.length > 0) {
      await db
        .insert(coverageResponses)
        .values(rows)
        .onConflictDoUpdate({
          target: [
            coverageResponses.subjectEnrollmentId,
            coverageResponses.subtopicId,
          ],
          set: {
            answer: sql`excluded.answer`,
            updatedAt: now,
          },
        });
    }
  }

  if (suggestion && suggestion.length > 0) {
    await db.insert(curriculumSuggestions).values({
      subjectId,
      topicId,
      studentId,
      body: suggestion,
    });
  }

  // Keep this university-program's gap analysis current (STRUCTURE.md §6:
  // "on N new responses"). Cheap at this scale; a nightly job also exists.
  await recomputeSubjectAggregates(enrollment.universityProgramId, subjectId);

  revalidatePath(`/subjects/${subjectSlug}/survey`);
  redirect(nextHref);
}
