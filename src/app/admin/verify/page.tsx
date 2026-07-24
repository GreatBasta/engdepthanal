import Link from "next/link";
import { redirect } from "next/navigation";
import { alias } from "drizzle-orm/pg-core";
import { desc, eq } from "drizzle-orm";

import { currentAdmin } from "@/lib/admin";
import { db } from "@/lib/db/client";
import {
  programs,
  universities,
  universityPrograms,
} from "@/lib/db/schema";
import { ReviewButtons } from "../ui";

/**
 * Verify (or reject) the universities and university×course pairings that
 * students added during onboarding. Until verified, these don't count toward
 * any aggregate (STRUCTURE.md §5.4), so this is the gate that lets a new
 * university's data start feeding the gap analysis.
 */
export default async function VerifyReview() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");

  const uni = alias(universities, "uni");

  const [uniRows, progRows] = await Promise.all([
    db
      .select({
        id: universities.id,
        name: universities.name,
        countryCode: universities.countryCode,
        createdAt: universities.createdAt,
      })
      .from(universities)
      .where(eq(universities.status, "unverified"))
      .orderBy(desc(universities.createdAt)),
    db
      .select({
        id: universityPrograms.id,
        universityName: uni.name,
        countryCode: uni.countryCode,
        programName: programs.name,
      })
      .from(universityPrograms)
      .innerJoin(uni, eq(universityPrograms.universityId, uni.id))
      .innerJoin(programs, eq(universityPrograms.programId, programs.id))
      .where(eq(universityPrograms.status, "unverified"))
      .orderBy(desc(universityPrograms.createdAt)),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/admin"
        className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
      >
        ← Admin console
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        University verification
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Verify student-added entries so their data can feed the gap analysis.
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-500">
          Universities ({uniRows.length})
        </h2>
        {uniRows.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">None pending.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {uniRows.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-zinc-500">{u.countryCode}</p>
                </div>
                <ReviewButtons
                  kind="university"
                  id={u.id}
                  acceptLabel="Verify"
                  rejectLabel="Reject"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-500">
          Courses ({progRows.length})
        </h2>
        {progRows.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">None pending.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {progRows.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>
                  <p className="text-sm font-medium">{p.programName}</p>
                  <p className="text-xs text-zinc-500">
                    {p.universityName} · {p.countryCode}
                  </p>
                </div>
                <ReviewButtons
                  kind="program"
                  id={p.id}
                  acceptLabel="Verify"
                  rejectLabel="Reject"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
