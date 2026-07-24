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
import { CaptureForm, GradeForm, type CaptureTopic } from "./ui";

type CoverageAnswer = "yes_depth" | "yes_brief" | "no" | "unsure";

/**
 * The coverage survey. Grade first, then a single fast "highlighter" capture
 * page for the whole subject: pick an answer, tap the subtopics it applies to,
 * fill the rest in one tap. Available only for a finished subject; every mark
 * autosaves, so it's fully resumable.
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
      subtopicDescription: subtopics.description,
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

  const grouped = new Map<string, CaptureTopic>();
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
      description: row.subtopicDescription,
      answer: (row.answer as CoverageAnswer | null) ?? null,
    });
    if (row.answer) answered.push(row.answer as CoverageAnswer);
  }
  const topicList = order.map((id) => grouped.get(id)!);

  const hasGrade = subjectEnrollment.gradeNormalized != null;
  const anyAnswered = answered.length > 0;
  // grade → pick a mode → capture (highlighter) or the swipe deck → done
  const current =
    step ?? (!hasGrade ? "grade" : anyAnswered ? "capture" : "choose");

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
            href={`/subjects/${slug}/survey?step=capture`}
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
          nextHref={`/subjects/${slug}/survey?step=choose`}
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

  // ---------- Mode chooser ----------
  if (current === "choose") {
    const total = topicList.reduce((n, t) => n + t.subtopics.length, 0);
    return (
      <main className="mx-auto max-w-lg px-6 py-12">
        <Link
          href={`/subjects/${slug}/track`}
          className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
        >
          ← {subject.name}
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          How do you want to do this?
        </h1>
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          {total} subtopics in {subject.name}. Both record the same thing —
          pick whichever suits you. You can switch later.
        </p>

        <div className="mt-7 space-y-3">
          <Link
            href={`/subjects/${slug}/survey?step=capture`}
            className="group block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-600 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold group-hover:text-cyan-800 dark:group-hover:text-cyan-300">
                🖍️ Quick pass
              </h2>
              <span className="shrink-0 rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-bold text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300">
                ~2 min
              </span>
            </div>
            <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              Pick a highlighter, tap the exceptions, fill the rest in one go.
              Fastest way to map the whole subject.
            </p>
          </Link>

          <Link
            href={`/subjects/${slug}/swipe`}
            className="group block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                🃏 Card by card
              </h2>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                richer
              </span>
            </div>
            <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              Swipe through one at a time. Rate how hard each was, how deep you
              went, save the ones to revisit, and read notes from others on your
              course.
            </p>
          </Link>
        </div>
      </main>
    );
  }

  // ---------- Capture step (the highlighter) ----------
  return (
    <CaptureForm
      subjectSlug={slug}
      subjectName={subject.name}
      topics={topicList}
      gradeHref={`/subjects/${slug}/survey?step=grade`}
    />
  );
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
