import { spawnSync } from "node:child_process";
import postgres from "postgres";

/**
 * Bring the database up to date as part of a deploy — but ONLY for a real
 * production deploy.
 *
 * Why this exists: the build step used to run `db:setup` unconditionally,
 * which meant every preview build could mutate the production database and
 * concurrent builds could race. That was correctly removed. But moving it to
 * a manual step meant a deploy could ship code that expects tables the
 * database doesn't have yet — which is exactly what happened: the site 500'd
 * with `relation "course_pages" does not exist` because migrations 0002 and
 * 0003 were never applied.
 *
 * So: previews still never touch the database, and production deploys are
 * self-healing.
 *
 *   - Runs when VERCEL_ENV=production, or locally with DB_DEPLOY=1.
 *   - Skips (exit 0, build continues) anywhere else, including previews.
 *   - Holds a Postgres advisory lock, so two concurrent production builds
 *     serialise instead of racing the same migrations.
 *   - Migrations prefer a direct (unpooled) connection, like drizzle.config.
 */

/** Stable arbitrary key so every deploy contends on the same lock. */
const LOCK_KEY = 918273645;

function decide(): { run: boolean; reason: string } {
  if (process.env.DB_DEPLOY === "1") {
    return { run: true, reason: "DB_DEPLOY=1" };
  }
  if (process.env.VERCEL_ENV === "production") {
    return { run: true, reason: "VERCEL_ENV=production" };
  }
  if (process.env.VERCEL_ENV) {
    return {
      run: false,
      reason: `VERCEL_ENV=${process.env.VERCEL_ENV} (previews never touch the database)`,
    };
  }
  return { run: false, reason: "not a production deploy; set DB_DEPLOY=1 to force" };
}

function step(label: string, args: string[]) {
  console.log(`[db:deploy] ${label}…`);
  const res = spawnSync("npx", args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (res.status !== 0) {
    throw new Error(`${label} failed with exit code ${res.status}`);
  }
}

async function main() {
  const { run, reason } = decide();
  if (!run) {
    console.log(`[db:deploy] skipped — ${reason}`);
    return;
  }
  console.log(`[db:deploy] running — ${reason}`);

  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // A dedicated single connection holds the lock for the whole deploy.
  const lockSql = postgres(url, { max: 1, prepare: false });
  try {
    await lockSql`select pg_advisory_lock(${LOCK_KEY})`;
    console.log("[db:deploy] acquired deploy lock");

    step("applying migrations", ["drizzle-kit", "migrate"]);
    step("seeding curriculum", ["tsx", "src/lib/db/seed.ts"]);

    console.log("[db:deploy] database is up to date");
  } finally {
    try {
      await lockSql`select pg_advisory_unlock(${LOCK_KEY})`;
    } finally {
      await lockSql.end({ timeout: 5 });
    }
  }
}

main().catch((err) => {
  console.error("[db:deploy] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
