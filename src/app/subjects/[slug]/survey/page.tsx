import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import {
  coverageResponses,
  subjectEnrollments,
  subjects,
  subtopics,
  topics,
} from "@/lib/db/schema";
import { getStudentEnrollment } from "@/lib/enrollment";
import { GRADE_SCALES } from "@/lib/grades";
import { GradeForm } from "./ui";

type CoverageAnswer = "yes_depth" | "yes_brief" | "no" | "unsure";

interface SurveyTopic {
  id: string;
  position: number;
  name: string;
  subtopics: { id: string; name: string; answer: CoverageAnswer | null }[];
}

/**
 * The coverage survey: grade first, then the swipe deck (the only capture
 * mode). Available for a finished subject only. This route also renders the
 * completion summary; every other step redirects into the deck.
 */
export default async function SurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");
  const { slug } = await params;
  const { step } = await searchParams;

  const enrollment = await getStudentEnrollment(studentId);
  if (!enrollment) redirect("/onboarding");

  const [subject] = await db
    .select()
    .from(subjects)
    .where(eq(subjects.slug, slug))
    .limit(1);
  if (!subject) notFound();

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

  // Gated on a finished subject; send unfinished back to track.
  if (!subjectEnrollment || subjectEnrollment.status !== "finished") {
    redirect(`/subjects/${slug}/track`);
  }

  // Load the tree with this student's existing answers (scoped to them).
  const rows = await db
    .select({
      topicId: topics.id,
      topicName: topics.name,
      topicPosition: topics.position,
      subtopicId: subtopics.id,
      subtopicName: subtopics.name,
      answer: coverageResponses.answer,
    })
    .from(topics)
    .innerJoin(subtopics, eq(subtopics.topicId, topics.id))
    .leftJoin(
      coverageResponses,
      and(
        eq(coverageResponses.subtopicId, subtopics.id),
        eq(coverageResponses.subjectEnrollmentId, subjectEnrollment.id),
      ),
    )
    .where(eq(topics.subjectId, subject.id))
    .orderBy(asc(topics.position), asc(subtopics.position));

  const grouped = new Map<string, SurveyTopic>();
  const order: string[] = [];
  const answered: CoverageAnswer[] = [];
  for (const row of rows) {
    if (!grouped.has(row.topicId)) {
      grouped.set(row.topicId, {
        id: row.topicId,
        position: row.topicPosition,
        name: row.topicName,
        subtopics: [],
      });
      order.push(row.topicId);
    }
    grouped.get(row.topicId)!.subtopics.push({
      id: row.subtopicId,
      name: row.subtopicName,
      answer: (row.answer as CoverageAnswer | null) ?? null,
    });
    if (row.answer) answered.push(row.answer as CoverageAnswer);
  }
  const topicList = order.map((id) => grouped.get(id)!);

  const hasGrade = subjectEnrollment.gradeNormalized != null;
  // grade → the swipe deck → done. The deck is the only capture mode.
  const current = step ?? (hasGrade ? "deck" : "grade");
  if (current === "deck" || current === "capture" || current === "choose") {
    redirect(`/subjects/${slug}/swipe`);
  }

  // ---------- Completion summary ----------
  if (current === "done") {
    const subtopicTotal = topicList.reduce(
      (n, t) => n + t.subtopics.length,
      0,
    );
    const covered = answered.filter(
      (a) => a === "yes_depth" || a === "yes_brief",
    ).length;
    const notTaught = answered.filter((a) => a === "no").length;
    const inDepth = answered.filter((a) => a === "yes_depth").length;

    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">
          Survey complete — thank you 🎉
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Your answers for <strong>{subject.name}</strong> now feed the
          coverage map for your university and course. Once enough finished
          students respond, everyone starting your course sees what it does and
          doesn&apos;t teach.
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Subtopics" value={subtopicTotal} />
          <Stat label="Answered" value={answered.length} />
          <Stat label="Covered" value={covered} tone="emerald" />
          <Stat label="Not taught" value={notTaught} tone="rose" />
        </dl>
        <p className="mt-4 text-xs text-zinc-500">
          {inDepth} studied in depth · {subtopicTotal - answered.length} left
          blank.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/subjects/${slug}/swipe`}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Review my answers
          </Link>
          <Link
            href={`/subjects/${slug}/gaps`}
            className="rounded-lg bg-cyan-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700"
          >
            See the gap analysis →
          </Link>
        </div>
      </main>
    );
  }

  // ---------- Grade step ----------
  if (current === "grade") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link
          href={`/subjects/${slug}/track`}
          className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
        >
          ← {subject.name}
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          {subject.name} — coverage survey
        </h1>
        <GradeForm
          subjectSlug={slug}
          nextHref={`/subjects/${slug}/swipe`}
          scales={Object.entries(GRADE_SCALES).map(([id, s]) =>
            s.kind === "numeric"
              ? {
                  id,
                  label: s.label,
                  kind: "numeric" as const,
                  min: s.min,
                  max: s.max,
                  step: s.step,
                }
              : {
                  id,
                  label: s.label,
                  kind: "letter" as const,
                  options: s.options.map((o) => o.value),
                },
          )}
          existingScale={subjectEnrollment.gradeScale}
          existingValue={subjectEnrollment.gradeValue}
        />
      </main>
    );
  }

  // Unreachable — the deck redirect above handles every other step.
  redirect(`/subjects/${slug}/swipe`);
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "rose"
        ? "text-rose-600 dark:text-rose-400"
        : "";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <dd className={`text-2xl font-bold ${toneClass}`}>{value}</dd>
      <dt className="mt-1 text-xs text-zinc-500">{label}</dt>
    </div>
  );
}
