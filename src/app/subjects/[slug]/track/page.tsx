import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import {
  subjectEnrollments,
  subjects,
  subtopicProgress,
  subtopics,
  topics,
} from "@/lib/db/schema";
import { getStudentEnrollment } from "@/lib/enrollment";
import { TrackUI, type TrackTopic } from "./ui";

/**
 * The interactive tracker (Phase 2): an actively-attending student marks
 * each subtopic not-started / in-progress / done, and marks the whole
 * subject finished — the gate into the Phase 3 coverage survey.
 */
export default async function TrackPage({
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

  // The subject enrollment may not exist until the first toggle creates it;
  // until then the tracker simply renders every subtopic as not-started.
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

  // Load the tree together with THIS student's progress (join scoped to
  // their subject enrollment, so no one else's marks leak in).
  const rows = await db
    .select({
      topicId: topics.id,
      topicName: topics.name,
      topicPosition: topics.position,
      subtopicId: subtopics.id,
      subtopicName: subtopics.name,
      depthLevel: subtopics.depthLevel,
      state: subtopicProgress.state,
    })
    .from(topics)
    .innerJoin(subtopics, eq(subtopics.topicId, topics.id))
    .leftJoin(
      subtopicProgress,
      and(
        eq(subtopicProgress.subtopicId, subtopics.id),
        subjectEnrollment
          ? eq(subtopicProgress.subjectEnrollmentId, subjectEnrollment.id)
          : // No enrollment yet: force the join to match nothing.
            eq(subtopicProgress.subjectEnrollmentId, subtopics.id),
      ),
    )
    .where(eq(topics.subjectId, subject.id))
    .orderBy(asc(topics.position), asc(subtopics.position));

  const grouped = new Map<string, TrackTopic>();
  for (const row of rows) {
    if (!grouped.has(row.topicId)) {
      grouped.set(row.topicId, {
        id: row.topicId,
        name: row.topicName,
        position: row.topicPosition,
        subtopics: [],
      });
    }
    grouped.get(row.topicId)!.subtopics.push({
      id: row.subtopicId,
      name: row.subtopicName,
      depthLevel: row.depthLevel,
      state: row.state ?? "not_started",
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={`/subjects/${slug}`}
        className="text-sm text-zinc-500 underline-offset-2 hover:underline"
      >
        ← {subject.name} outlook
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Track: {subject.name}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Mark what you&apos;ve covered. When you finish the subject, you&apos;ll
        be able to record what your university actually taught.
      </p>

      <TrackUI
        subjectSlug={slug}
        topics={[...grouped.values()]}
        finished={subjectEnrollment?.status === "finished"}
      />
    </main>
  );
}
