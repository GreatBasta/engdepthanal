import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json(
      {
        status: "ok",
        database: "reachable",
        latencyMs: Date.now() - startedAt,
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    console.error(JSON.stringify({ event: "health.database_failed" }));
    return Response.json(
      { status: "degraded", database: "unreachable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
