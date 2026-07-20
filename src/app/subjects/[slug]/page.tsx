import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import { subjects, subtopics, topics } from "@/lib/db/schema";

const DEPTH_LABEL: Record<string, string> = {
  awareness: "awareness",
  procedural: "procedural",
  fluency: "fluency",
  proof: "proof-level",
};

const DEPTH_CLASS: Record<string, string> = {
  awareness:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  procedural:
    "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  fluency:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  proof:
    "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

/**
 * The read-only "branch outlook": every topic and subtopic of the subject,
 * with how in-depth each goes. Phase 2 adds progress tracking on top;
 * Phase 4 overlays per-university coverage badges.
 */
export default async function SubjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");
  const { slug } = await params;

  const [subject] = await db
    .select()
    .from(subjects)
    .where(eq(subjects.slug, slug))
    .limit(1);
  if (!subject) notFound();

  const rows = await db
    .select({
      topicId: topics.id,
      topicName: topics.name,
      topicDescription: topics.description,
      topicPosition: topics.position,
      subtopicName: subtopics.name,
      subtopicDescription: subtopics.description,
      depthLevel: subtopics.depthLevel,
      estHours: subtopics.estHours,
    })
    .from(topics)
    .innerJoin(subtopics, eq(subtopics.topicId, topics.id))
    .where(eq(topics.subjectId, subject.id))
    .orderBy(asc(topics.position), asc(subtopics.position));

  const grouped = new Map<
    string,
    { name: string; description: string | null; position: number; items: typeof rows }
  >();
  for (const row of rows) {
    if (!grouped.has(row.topicId)) {
      grouped.set(row.topicId, {
        name: row.topicName,
        description: row.topicDescription,
        position: row.topicPosition,
        items: [],
      });
    }
    grouped.get(row.topicId)!.items.push(row);
  }
  const totalHours = rows.reduce(
    (sum, r) => sum + (r.estHours ? Number(r.estHours) : 0),
    0,
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/dashboard"
        className="text-sm text-zinc-500 underline-offset-2 hover:underline"
      >
        ← All subjects
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{subject.name}</h1>
      {subject.description && (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {subject.description}
        </p>
      )}
      <p className="mt-2 text-xs text-zinc-500">
        {grouped.size} topics · {rows.length} subtopics · ~
        {Math.round(totalHours)} study hours
      </p>

      <Link
        href={`/subjects/${slug}/track`}
        className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Track your progress →
      </Link>

      <ol className="mt-10 space-y-8">
        {[...grouped.values()].map((topic) => (
          <li key={topic.position}>
            <h2 className="text-lg font-semibold">
              {topic.position}. {topic.name}
            </h2>
            {topic.description && (
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                {topic.description}
              </p>
            )}
            <ul className="mt-3 space-y-px border-l-2 border-zinc-200 dark:border-zinc-800">
              {topic.items.map((item) => (
                <li
                  key={item.subtopicName}
                  className="flex items-start justify-between gap-4 py-2 pl-4"
                >
                  <div>
                    <p className="text-sm font-medium">{item.subtopicName}</p>
                    {item.subtopicDescription && (
                      <p className="text-xs text-zinc-500">
                        {item.subtopicDescription}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.estHours && (
                      <span className="text-xs text-zinc-400">
                        {Number(item.estHours)}h
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${DEPTH_CLASS[item.depthLevel]}`}
                    >
                      {DEPTH_LABEL[item.depthLevel]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </main>
  );
}
