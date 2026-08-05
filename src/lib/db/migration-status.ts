import { sql } from "drizzle-orm";

import journal from "../../../drizzle/meta/_journal.json";
import { db } from "./client";

/**
 * Is the running code newer than the database it is talking to?
 *
 * Migrations are applied by hand from a trusted checkout (see DEPLOY.md), and
 * the build no longer runs them. That is the right call — preview builds must
 * never mutate production — but it splits a deploy into two steps whose order
 * matters. Ship the code first and the site 500s with `relation "…" does not
 * exist`, which is exactly how this repository broke once before (PR #17).
 *
 * A missing migration is not a mystery worth debugging twice, so we make the
 * drift observable: the journal that ships with the bundle is the set of
 * migrations this code expects, and the `drizzle.__drizzle_migrations` table
 * is the set the database has actually applied. Comparing them answers the
 * question before a user does.
 */

/** One entry of `drizzle/meta/_journal.json`. */
export type JournalEntry = {
  /** Millisecond timestamp; Drizzle stores this as `created_at`. */
  when: number;
  /** Migration filename without the `.sql` suffix, e.g. `0007_organization…`. */
  tag: string;
};

export type MigrationStatus = {
  /** Migrations bundled with this build, oldest first. */
  expected: string[];
  /** Migrations the database has applied, oldest first. */
  applied: string[];
  /** Bundled migrations the database is missing, oldest first. */
  pending: string[];
  upToDate: boolean;
};

/** The migrations this build expects, oldest first. */
export function expectedMigrations(): JournalEntry[] {
  return [...(journal.entries as JournalEntry[])].sort((a, b) => a.when - b.when);
}

/**
 * Split the bundled migrations into applied and pending.
 *
 * Drizzle's migrator advances a high-water mark rather than tracking each
 * migration individually: it applies every file whose timestamp is newer than
 * the newest `created_at` in the database. We compare the same way, so this
 * reports what the migrator would actually do — including the sharp edge that
 * a migration authored with an older timestamp than one already applied is
 * silently skipped. Such a file is reported as applied because that is the
 * truth about what the migrator will do with it, and `db:status` warns
 * separately about the out-of-order file itself.
 */
export function splitMigrations(
  entries: readonly JournalEntry[],
  lastAppliedAt: number | null,
): { applied: string[]; pending: string[] } {
  const applied: string[] = [];
  const pending: string[] = [];
  for (const entry of [...entries].sort((a, b) => a.when - b.when)) {
    if (lastAppliedAt !== null && entry.when <= lastAppliedAt) applied.push(entry.tag);
    else pending.push(entry.tag);
  }
  return { applied, pending };
}

/**
 * Bundled migrations whose timestamp is older than a migration before them.
 * Drizzle's high-water mark would skip these without any error, so they are
 * worth naming explicitly.
 */
export function outOfOrderMigrations(entries: readonly JournalEntry[]): string[] {
  const byIndex = [...entries].sort((a, b) => a.when - b.when);
  const declared = [...entries];
  return declared
    .filter((entry, index) => byIndex[index]?.tag !== entry.tag)
    .map((entry) => entry.tag);
}

/** The newest `created_at` in `drizzle.__drizzle_migrations`, or null. */
async function lastAppliedAt(): Promise<number | null> {
  const [present] = await db.execute<{ table_name: string | null }>(
    sql`select to_regclass('drizzle.__drizzle_migrations')::text as table_name`,
  );
  // A database that has never been migrated has no bookkeeping table at all;
  // that is "everything is pending", not an error.
  if (!present?.table_name) return null;

  const [row] = await db.execute<{ created_at: string | number | null }>(
    sql`select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`,
  );
  if (row?.created_at === null || row?.created_at === undefined) return null;
  return Number(row.created_at);
}

/** Compare the bundled journal against the database. Throws if unreachable. */
export async function readMigrationStatus(): Promise<MigrationStatus> {
  const entries = expectedMigrations();
  const { applied, pending } = splitMigrations(entries, await lastAppliedAt());
  return {
    expected: entries.map((entry) => entry.tag),
    applied,
    pending,
    upToDate: pending.length === 0,
  };
}
