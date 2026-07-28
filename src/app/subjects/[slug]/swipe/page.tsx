import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, sql } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import {
  coverageResponses,
  programs,
  students,
  subjectEnrollments,
  subjects,
  subtopicComments,
  subtopicStars,
  subtopics,
  topics,
  universityPrograms,
} from "@/lib/db/schema";
import { getStudentEnrollment } from "@/lib/enrollment";
import { SwipeDeck, type Card } from "./ui";

/**
 * The swipe deck: one subtopic per card. Right = studied (then difficulty +
 * depth), left = didn't (then why), up = notes from your course, down = save.
 * Richer than the quick highlighter pass, and doubles as a study journal.
 */
export default async function SwipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");
  const { slug } = await params;

  const enrollment = await getStudentEnrollment(studentId);
  if (!enrollment) redirect("/onboarding");

  const [subject] = await db
    .select()
    .from(subjects)
    .where(eq(subjects.slug, slug))
    .limit(1);
  if (!subject) notFound();

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
  if (!se || se.status !== "finished") redirect(`/subjects/${slug}/track`);

  const [rows, commentRows, starRows] = await Promise.all([
    db
      .select({
        topicName: topics.name,
        topicPosition: topics.position,
        subtopicId: subtopics.id,
        name: subtopics.name,
        description: subtopics.description,
        targetDepth: subtopics.depthLevel,
        estHours: subtopics.estHours,
        answer: coverageResponses.answer,
      })
      .from(topics)
      .innerJoin(subtopics, eq(subtopics.topicId, topics.id))
      .leftJoin(
        coverageResponses,
        and(
          eq(coverageResponses.subtopicId, subtopics.id),
          eq(coverageResponses.subjectEnrollmentId, se.id),
        ),
      )
      .where(eq(topics.subjectId, subject.id))
      .orderBy(asc(topics.position), asc(subtopics.position)),
    // Notes are hard-scoped to the student's OWN UNIVERSITY — never anyone
    // else's. Each is tagged with the course it came from so the reader can
    // narrow to just their own course in the UI.
    db
      .select({
        subtopicId: subtopicComments.subtopicId,
        body: subtopicComments.body,
        author: students.displayName,
        course: programs.name,
        sameCourse: sql<boolean>`${subtopicComments.universityProgramId} = ${enrollment.universityProgramId}`,
        createdAt: subtopicComments.createdAt,
      })
      .from(subtopicComments)
      .innerJoin(students, eq(subtopicComments.studentId, students.id))
      .innerJoin(
        universityPrograms,
        eq(subtopicComments.universityProgramId, universityPrograms.id),
      )
      .innerJoin(programs, eq(universityPrograms.programId, programs.id))
      .where(
        eq(
          universityPrograms.universityId,
          sql`(select university_id from university_programs where id = ${enrollment.universityProgramId})`,
        ),
      )
      .orderBy(desc(subtopicComments.createdAt)),
    db
      .select({ subtopicId: subtopicStars.subtopicId })
      .from(subtopicStars)
      .where(eq(subtopicStars.studentId, studentId)),
  ]);

  const commentsBy = new Map<
    string,
    { author: string; body: string; course: string; sameCourse: boolean }[]
  >();
  for (const c of commentRows) {
    const list = commentsBy.get(c.subtopicId) ?? [];
    list.push({
      author: c.author,
      body: c.body,
      course: c.course,
      sameCourse: Boolean(c.sameCourse),
    });
    commentsBy.set(c.subtopicId, list);
  }
  const starred = new Set(starRows.map((s) => s.subtopicId));

  const cards: Card[] = rows.map((r) => ({
    id: r.subtopicId,
    topic: `${r.topicPosition}. ${r.topicName}`,
    name: r.name,
    description: r.description,
    targetDepth: r.targetDepth,
    estHours: r.estHours ? Number(r.estHours) : null,
    answered: r.answer != null,
    starred: starred.has(r.subtopicId),
    comments: commentsBy.get(r.subtopicId) ?? [],
  }));

  const [myProgram] = await db
    .select({ name: programs.name })
    .from(universityPrograms)
    .innerJoin(programs, eq(universityPrograms.programId, programs.id))
    .where(eq(universityPrograms.id, enrollment.universityProgramId))
    .limit(1);

  return (
    <SwipeDeck
      subjectSlug={slug}
      subjectName={subject.name}
      cards={cards}
      answeredAtStart={cards.filter((c) => c.answered).length}
      myCourse={myProgram?.name ?? "your course"}
    />
  );
}
