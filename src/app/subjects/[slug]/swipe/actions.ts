"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import {
  coverageResponses,
  subjectEnrollments,
  subjects,
  subtopicComments,
  subtopicStars,
  subtopics,
  topics,
} from "@/lib/db/schema";
import { getStudentEnrollment } from "@/lib/enrollment";
import { recomputeSubjectAggregates } from "@/lib/aggregate";

async function requireFinished(subjectSlug: string) {
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

  const [se] = await db
    .select()
    .from(subjectEnrollments)
    .where(
      and(
        eq(subjectEnrollments.enrollmentId, enrollment.id),
        eq(subjectEnrollments.subjectId, subject.id),
      ),
    )
    .limit(1);
  if (!se || se.status !== "finished") throw new Error("subject not finished");
  return { studentId, enrollment, subjectEnrollment: se, subjectId: subject.id };
}

/** Guard: the subtopic must belong to this subject. */
async function assertInSubject(subjectId: string, subtopicId: string) {
  const [row] = await db
    .select({ id: subtopics.id })
    .from(subtopics)
    .innerJoin(topics, eq(subtopics.topicId, topics.id))
    .where(and(eq(subtopics.id, subtopicId), eq(topics.subjectId, subjectId)))
    .limit(1);
  if (!row) throw new Error("subtopic not in subject");
}

const cardSchema = z.discriminatedUnion("studied", [
  z.object({
    subjectSlug: z.string().min(1),
    subtopicId: z.string().uuid(),
    studied: z.literal(true),
    /** 1–5; omitted when the student skips the detail step. */
    difficulty: z.number().int().min(1).max(5).nullable(),
    studiedDepth: z
      .enum(["awareness", "procedural", "fluency", "proof"])
      .nullable(),
  }),
  z.object({
    subjectSlug: z.string().min(1),
    subtopicId: z.string().uuid(),
    studied: z.literal(false),
    reason: z.enum(["not_covered", "not_reached", "skipped"]),
  }),
]);

/**
 * Save one card.
 *
 * Mapping to the coverage answer that aggregation already understands:
 *  - studied, reached fluency/proof  → yes_depth
 *  - studied, awareness/procedural   → yes_brief
 *  - studied, depth not given        → yes_depth (they affirmed studying it)
 *  - not studied, "never covered"    → no        (a real university gap)
 *  - not studied, "not reached yet" or "skipped for now" → unsure
 *
 * That last line matters: `unsure` is excluded from coverage denominators, so
 * a student who simply hasn't got there yet never makes their university look
 * like it failed to teach something.
 */
export async function saveCard(input: unknown) {
  const data = cardSchema.parse(input);
  const { subjectEnrollment, subjectId } = await requireFinished(
    data.subjectSlug,
  );
  await assertInSubject(subjectId, data.subtopicId);

  const now = new Date();
  const row = data.studied
    ? {
        answer:
          data.studiedDepth === "awareness" || data.studiedDepth === "procedural"
            ? ("yes_brief" as const)
            : ("yes_depth" as const),
        difficulty: data.difficulty,
        studiedDepth: data.studiedDepth,
        notStudiedReason: null,
      }
    : {
        answer:
          data.reason === "not_covered" ? ("no" as const) : ("unsure" as const),
        difficulty: null,
        studiedDepth: null,
        notStudiedReason: data.reason,
      };

  await db
    .insert(coverageResponses)
    .values({
      subjectEnrollmentId: subjectEnrollment.id,
      subtopicId: data.subtopicId,
      ...row,
      answeredAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        coverageResponses.subjectEnrollmentId,
        coverageResponses.subtopicId,
      ],
      set: {
        answer: sql`excluded.answer`,
        difficulty: sql`excluded.difficulty`,
        studiedDepth: sql`excluded.studied_depth`,
        notStudiedReason: sql`excluded.not_studied_reason`,
        updatedAt: now,
      },
    });
}

const undoSchema = z.object({
  subjectSlug: z.string().min(1),
  subtopicId: z.string().uuid(),
});

/** Undo a card — removes the answer so the row is blank again. */
export async function undoCard(input: unknown) {
  const { subjectSlug, subtopicId } = undoSchema.parse(input);
  const { subjectEnrollment, subjectId } = await requireFinished(subjectSlug);
  await assertInSubject(subjectId, subtopicId);
  await db
    .delete(coverageResponses)
    .where(
      and(
        eq(coverageResponses.subjectEnrollmentId, subjectEnrollment.id),
        inArray(coverageResponses.subtopicId, [subtopicId]),
      ),
    );
}

const starSchema = z.object({
  subjectSlug: z.string().min(1),
  subtopicId: z.string().uuid(),
  starred: z.boolean(),
});

/** Star / unstar a subtopic (the student's own saved list). */
export async function toggleStar(input: unknown) {
  const { subjectSlug, subtopicId, starred } = starSchema.parse(input);
  const { studentId, subjectId } = await requireFinished(subjectSlug);
  await assertInSubject(subjectId, subtopicId);

  if (starred) {
    await db
      .insert(subtopicStars)
      .values({ studentId, subtopicId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(subtopicStars)
      .where(
        and(
          eq(subtopicStars.studentId, studentId),
          eq(subtopicStars.subtopicId, subtopicId),
        ),
      );
  }
}

const commentSchema = z.object({
  subjectSlug: z.string().min(1),
  subtopicId: z.string().uuid(),
  body: z.string().trim().min(1).max(1000),
});

/** Post a note on a subtopic, visible to others on the same course. */
export async function postComment(input: unknown) {
  const { subjectSlug, subtopicId, body } = commentSchema.parse(input);
  const { studentId, enrollment, subjectId } =
    await requireFinished(subjectSlug);
  await assertInSubject(subjectId, subtopicId);

  await db.insert(subtopicComments).values({
    subtopicId,
    studentId,
    universityProgramId: enrollment.universityProgramId,
    body,
  });
  revalidatePath(`/subjects/${subjectSlug}/swipe`);
}

/** Finish the deck: refresh this cohort's gap analysis, then show the summary. */
export async function finishDeck(subjectSlug: string) {
  const { enrollment, subjectId } = await requireFinished(subjectSlug);
  await recomputeSubjectAggregates(enrollment.universityProgramId, subjectId);
  revalidatePath(`/subjects/${subjectSlug}/survey`);
  revalidatePath("/dashboard");
  redirect(`/subjects/${subjectSlug}/survey?step=done`);
}
