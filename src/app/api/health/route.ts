import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { readMigrationStatus } from "@/lib/db/migration-status";

export const dynamic = "force-dynamic";

/**
 * Is this instance actually able to serve requests?
 *
 * Three things have to hold, and each one has broken here before, so each is
 * reported separately rather than collapsed into a single boolean:
 *
 *   - the database answers;
 *   - it has every migration this build expects (migrations are applied by
 *     hand now, so code can ship ahead of its schema — see DEPLOY.md);
 *   - the secrets the app needs at request time are present.
 *
 * Anything less answers 503. A smoke check that only looks at the status code
 * should fail when the site is one click away from 500ing for real users.
 */
export async function GET() {
  const startedAt = Date.now();

  const configured = Boolean(process.env.AUTH_SECRET);

  try {
    await db.execute(sql`select 1`);
    const migrations = await readMigrationStatus();
    const healthy = migrations.upToDate && configured;

    return Response.json(
      {
        status: healthy ? "ok" : "degraded",
        database: "reachable",
        migrations: {
          applied: migrations.applied.length,
          expected: migrations.expected.length,
          pending: migrations.pending,
        },
        config: configured ? "ok" : "missing AUTH_SECRET",
        latencyMs: Date.now() - startedAt,
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
      },
      {
        status: healthy ? 200 : 503,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch {
    console.error(JSON.stringify({ event: "health.database_failed" }));
    return Response.json(
      { status: "degraded", database: "unreachable", config: configured ? "ok" : "missing AUTH_SECRET" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
