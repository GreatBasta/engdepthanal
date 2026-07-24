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
  return { studentId, enrollment, subjectEnrollment, subjectId: subject.id };
}

/** The set of subtopic ids that actually belong to this subject. */
async function subjectSubtopicIds(subjectId: string, ids: string[]) {
  if (ids.length === 0) return new Set<string>();
  const rows = await db
    .select({ id: subtopics.id })
    .from(subtopics)
    .innerJoin(topics, eq(subtopics.topicId, topics.id))
    .where(and(eq(topics.subjectId, subjectId), inArray(subtopics.id, ids)));
  return new Set(rows.map((r) => r.id));
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
  const { subjectEnrollment } = await requireFinishedEnrollment(subjectSlug);

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

  revalidatePath(`/subjects/${subjectSlug}/survey`);
  redirect(nextHref);
}

const applySchema = z.object({
  subjectSlug: z.string().min(1),
  entries: z
    .array(
      z.object({
        subtopicId: z.string().uuid(),
        // null clears the row (toggle off); a value upserts it.
        answer: z.enum(["yes_depth", "yes_brief", "no", "unsure"]).nullable(),
      }),
    )
    .min(1)
    .max(500),
});

/**
 * Autosave one or many coverage marks (a single tap, or a "fill the rest").
 * A null answer deletes the mark, so a blank row stays genuinely blank.
 * Aggregates are recomputed at finish, not on every tap — keeps marking snappy.
 */
export async function applyAnswers(input: unknown) {
  const { subjectSlug, entries } = applySchema.parse(input);
  const { subjectEnrollment, subjectId } =
    await requireFinishedEnrollment(subjectSlug);

  const valid = await subjectSubtopicIds(
    subjectId,
    entries.map((e) => e.subtopicId),
  );
  const now = new Date();

  const toUpsert = entries.filter(
    (e) => e.answer !== null && valid.has(e.subtopicId),
  ) as { subtopicId: string; answer: "yes_depth" | "yes_brief" | "no" | "unsure" }[];
  const toClear = entries
    .filter((e) => e.answer === null && valid.has(e.subtopicId))
    .map((e) => e.subtopicId);

  if (toUpsert.length > 0) {
    await db
      .insert(coverageResponses)
      .values(
        toUpsert.map((e) => ({
          subjectEnrollmentId: subjectEnrollment.id,
          subtopicId: e.subtopicId,
          answer: e.answer,
          answeredAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [
          coverageResponses.subjectEnrollmentId,
          coverageResponses.subtopicId,
        ],
        set: { answer: sql`excluded.answer`, updatedAt: now },
      });
  }

  if (toClear.length > 0) {
    await db
      .delete(coverageResponses)
      .where(
        and(
          eq(coverageResponses.subjectEnrollmentId, subjectEnrollment.id),
          inArray(coverageResponses.subtopicId, toClear),
        ),
      );
  }
}

const noteSchema = z.object({
  subjectSlug: z.string().min(1),
  body: z.string().trim().min(1).max(2000),
});

/** Optional "my course also covered X" note (feeds the admin review queue). */
export async function addNote(input: unknown) {
  const { subjectSlug, body } = noteSchema.parse(input);
  const { studentId, subjectId } =
    await requireFinishedEnrollment(subjectSlug);
  await db
    .insert(curriculumSuggestions)
    .values({ subjectId, studentId, body });
}

/** Finish the survey: refresh this cohort's gap analysis, then show the summary. */
export async function finishSurvey(subjectSlug: string) {
  const { enrollment, subjectId } =
    await requireFinishedEnrollment(subjectSlug);
  await recomputeSubjectAggregates(enrollment.universityProgramId, subjectId);
  revalidatePath(`/subjects/${subjectSlug}/survey`);
  revalidatePath("/dashboard");
  redirect(`/subjects/${subjectSlug}/survey?step=done`);
}
