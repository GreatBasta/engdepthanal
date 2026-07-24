import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { currentAdmin } from "@/lib/admin";
import { db } from "@/lib/db/client";
import { curriculumSuggestions, subjects, topics } from "@/lib/db/schema";
import { ReviewButtons } from "../ui";

/**
 * Review the free-text "my course also covered X" notes students leave on
 * the coverage survey. Accepting flags them for the editorial queue;
 * dismissing hides them. (Both are soft — nothing is deleted.)
 */
export default async function CurriculumReview() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");

  const rows = await db
    .select({
      id: curriculumSuggestions.id,
      body: curriculumSuggestions.body,
      createdAt: curriculumSuggestions.createdAt,
      subjectName: subjects.name,
      topicName: topics.name,
    })
    .from(curriculumSuggestions)
    .innerJoin(subjects, eq(curriculumSuggestions.subjectId, subjects.id))
    .leftJoin(topics, eq(curriculumSuggestions.topicId, topics.id))
    .where(eq(curriculumSuggestions.status, "unverified"))
    .orderBy(desc(curriculumSuggestions.createdAt));

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/admin"
        className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
      >
        ← Admin console
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        Curriculum suggestions
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {rows.length} awaiting review.
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Nothing to review right now. 🎉
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  {r.subjectName}
                  {r.topicName ? ` · ${r.topicName}` : ""}
                </p>
                <p className="mt-1 text-sm">{r.body}</p>
              </div>
              <ReviewButtons kind="suggestion" id={r.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
