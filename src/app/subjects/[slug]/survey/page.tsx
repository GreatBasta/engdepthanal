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
import { GradeForm, SurveyProgress, TopicForm } from "./ui";

type CoverageAnswer = "yes_depth" | "yes_brief" | "no" | "unsure";

function surveyHref(slug: string, step: string) {
  return `/subjects/${slug}/survey?step=${encodeURIComponent(step)}`;
}

/**
 * The coverage survey (Phase 3): grade first, then one topic per screen of
 * "Have you studied: {subtopic}?" questions. Available only for a finished
 * subject. Resumable — every answer is persisted per subtopic, so the
 * survey reopens at the first unanswered step.
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

  // The survey is gated on a finished subject; send unfinished back to track.
  if (!subjectEnrollment || subjectEnrollment.status !== "finished") {
    redirect(`/subjects/${slug}/track`);
  }

  // Load the tree and this student's existing answers.
  const rows = await db
    .select({
      topicId: topics.id,
      topicName: topics.name,
      topicPosition: topics.position,
      subtopicId: subtopics.id,
      subtopicName: subtopics.name,
      subtopicDescription: subtopics.description,
      depthLevel: subtopics.depthLevel,
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

  interface TopicData {
    id: string;
    slug: string;
    name: string;
    position: number;
    subtopics: {
      id: string;
      name: string;
      description: string | null;
      depthLevel: string;
      answer: CoverageAnswer | null;
    }[];
  }

  // Only THIS student's answers should count — filter the left-joined rows.
  const answered = new Map<string, CoverageAnswer>();
  const grouped = new Map<string, TopicData>();
  const topicOrder: string[] = [];
  for (const row of rows) {
    if (!grouped.has(row.topicId)) {
      grouped.set(row.topicId, {
        id: row.topicId,
        slug: `t${row.topicPosition}`,
        name: row.topicName,
        position: row.topicPosition,
        subtopics: [],
      });
      topicOrder.push(row.topicId);
    }
    const topic = grouped.get(row.topicId)!;
    if (!topic.subtopics.some((s) => s.id === row.subtopicId)) {
      topic.subtopics.push({
        id: row.subtopicId,
        name: row.subtopicName,
        description: row.subtopicDescription,
        depthLevel: row.depthLevel,
        answer: row.answer as CoverageAnswer | null,
      });
    }
    if (row.answer) answered.set(row.subtopicId, row.answer as CoverageAnswer);
  }
  const topicList = topicOrder.map((id) => grouped.get(id)!);

  // Form steps: 'grade' then one per topic (keyed t1..tN). 'done' is terminal.
  const stepKeys = ["grade", ...topicList.map((t) => t.slug)];
  const hasGrade = subjectEnrollment.gradeNormalized != null;

  function firstUnansweredStep(): string {
    if (!hasGrade) return "grade";
    for (const topic of topicList) {
      if (topic.subtopics.some((s) => s.answer == null)) return topic.slug;
    }
    return "done";
  }

  const current = step ?? firstUnansweredStep();

  // ---- Completion summary ----
  if (current === "done") {
    const subtopicTotal = topicList.reduce(
      (n, t) => n + t.subtopics.length,
      0,
    );
    const answers = [...answered.values()];
    const covered = answers.filter(
      (a) => a === "yes_depth" || a === "yes_brief",
    ).length;
    const notTaught = answers.filter((a) => a === "no").length;
    const inDepth = answers.filter((a) => a === "yes_depth").length;

    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold">Survey complete — thank you 🎉</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Your answers for <strong>{subject.name}</strong> now feed the
          coverage map for your university and course. Once enough finished
          students respond, everyone starting your course will see what it
          does and doesn&apos;t teach.
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Subtopics" value={subtopicTotal} />
          <Stat label="Answered" value={answers.length} />
          <Stat label="Covered" value={covered} tone="emerald" />
          <Stat label="Not taught" value={notTaught} tone="rose" />
        </dl>
        <p className="mt-4 text-xs text-zinc-500">
          {inDepth} studied in depth. The per-university gap analysis lands in
          Phase 4.
        </p>

        <div className="mt-8 flex gap-3">
          <Link
            href={surveyHref(slug, topicList[0]?.slug ?? "grade")}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Review my answers
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const currentIndex = Math.max(0, stepKeys.indexOf(current));
  const nextKey = stepKeys[currentIndex + 1] ?? "done";
  const nextHref = surveyHref(slug, nextKey);
  const backHref =
    currentIndex === 0
      ? `/subjects/${slug}/track`
      : surveyHref(slug, stepKeys[currentIndex - 1]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href={`/subjects/${slug}/track`}
        className="text-sm text-zinc-500 underline-offset-2 hover:underline"
      >
        ← {subject.name}
      </Link>
      <h1 className="mt-3 text-2xl font-bold">
        {subject.name} — coverage survey
      </h1>

      <SurveyProgress
        current={currentIndex}
        total={stepKeys.length}
        labels={["Grade", ...topicList.map((t) => `${t.position}`)]}
      />

      {current === "grade" ? (
        <GradeForm
          subjectSlug={slug}
          nextHref={nextHref}
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
      ) : (
        (() => {
          const topic = topicList.find((t) => t.slug === current);
          if (!topic) notFound();
          return (
            <TopicForm
              subjectSlug={slug}
              topicId={topic.id}
              topicName={`${topic.position}. ${topic.name}`}
              subtopics={topic.subtopics}
              nextHref={nextHref}
              backHref={backHref}
              isLastTopic={nextKey === "done"}
            />
          );
        })()
      )}
    </main>
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
