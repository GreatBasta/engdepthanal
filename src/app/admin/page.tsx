import Link from "next/link";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";

import { signOut } from "@/auth";
import { currentAdmin } from "@/lib/admin";
import { db } from "@/lib/db/client";
import {
  curriculumSuggestions,
  universities,
  universityPrograms,
} from "@/lib/db/schema";

/**
 * Admin review console. Requires a normal account with a DB admin role or the
 * temporary bootstrap allowlist; otherwise redirects to normal login.
 */
export default async function AdminHome() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");

  const [[suggestions], [unis], [progs]] = await Promise.all([
    db
      .select({ n: count() })
      .from(curriculumSuggestions)
      .where(eq(curriculumSuggestions.status, "unverified")),
    db
      .select({ n: count() })
      .from(universities)
      .where(eq(universities.status, "unverified")),
    db
      .select({ n: count() })
      .from(universityPrograms)
      .where(eq(universityPrograms.status, "unverified")),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/dashboard"
        className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
      >
        ← Dashboard
      </Link>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin console</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Signed in as {admin.label}. Review what students contribute before
            it feeds the platform.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="shrink-0 text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
          >
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <AdminCard
          href="/admin/curriculum"
          title="Curriculum suggestions"
          count={suggestions.n}
          blurb="“My course also covered X” notes from the coverage survey, awaiting review."
        />
        <AdminCard
          href="/admin/verify"
          title="University verification"
          count={unis.n + progs.n}
          blurb="Universities and courses students added during onboarding, pending verification."
        />
      </div>
    </main>
  );
}

function AdminCard({
  href,
  title,
  count,
  blurb,
}: {
  href: string;
  title: string;
  count: number;
  blurb: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
          {title}
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            count > 0
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
          }`}
        >
          {count} pending
        </span>
      </div>
      <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">{blurb}</p>
    </Link>
  );
}
