"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import {
  subjectEnrollments,
  subjects,
  subtopicProgress,
  subtopics,
  topics,
} from "@/lib/db/schema";
import {
  getOrCreateSubjectEnrollment,
  getStudentEnrollment,
} from "@/lib/enrollment";

const setStateSchema = z.object({
  subjectSlug: z.string().min(1),
  subtopicId: z.string().uuid(),
  state: z.enum(["not_started", "in_progress", "done"]),
});

/**
 * Resolve the current student's subject enrollment for `subjectSlug`,
 * creating it on first track. All mutations below derive identity from the
 * session — never from client input — so a student can only ever touch
 * their own rows.
 */
async function requireSubjectEnrollment(subjectSlug: string) {
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

  const subjectEnrollment = await getOrCreateSubjectEnrollment(
    enrollment.id,
    subject.id,
  );
  return { subjectEnrollment, subjectId: subject.id };
}

/** Toggle one subtopic's progress state (actively-attending tracker). */
export async function setSubtopicState(input: unknown) {
  const { subjectSlug, subtopicId, state } = setStateSchema.parse(input);
  const { subjectEnrollment, subjectId } =
    await requireSubjectEnrollment(subjectSlug);

  // The subtopic must belong to this subject — blocks cross-subject writes.
  const [owned] = await db
    .select({ id: subtopics.id })
    .from(subtopics)
    .innerJoin(topics, eq(subtopics.topicId, topics.id))
    .where(and(eq(subtopics.id, subtopicId), eq(topics.subjectId, subjectId)))
    .limit(1);
  if (!owned) throw new Error("subtopic not in subject");

  await db
    .insert(subtopicProgress)
    .values({
      subjectEnrollmentId: subjectEnrollment.id,
      subtopicId,
      state,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        subtopicProgress.subjectEnrollmentId,
        subtopicProgress.subtopicId,
      ],
      set: { state, updatedAt: new Date() },
    });

  revalidatePath(`/subjects/${subjectSlug}/track`);
}

/**
 * Mark the subject finished — the deliberate, dated action that gates the
 * Phase 3 coverage survey (STRUCTURE.md §2.4). Only a currently in-progress
 * subject can be finished.
 */
export async function markSubjectFinished(subjectSlug: string) {
  const { subjectEnrollment } = await requireSubjectEnrollment(subjectSlug);

  await db
    .update(subjectEnrollments)
    .set({ status: "finished", finishedAt: new Date() })
    .where(
      and(
        eq(subjectEnrollments.id, subjectEnrollment.id),
        eq(subjectEnrollments.status, "in_progress"),
      ),
    );

  revalidatePath(`/subjects/${subjectSlug}/track`);
  revalidatePath("/dashboard");
}

/** Reopen a finished subject (e.g. marked finished by mistake). */
export async function reopenSubject(subjectSlug: string) {
  const { subjectEnrollment } = await requireSubjectEnrollment(subjectSlug);

  await db
    .update(subjectEnrollments)
    .set({ status: "in_progress", finishedAt: null })
    .where(
      and(
        eq(subjectEnrollments.id, subjectEnrollment.id),
        eq(subjectEnrollments.status, "finished"),
      ),
    );

  revalidatePath(`/subjects/${subjectSlug}/track`);
  revalidatePath("/dashboard");
}
