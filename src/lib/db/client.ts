import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Singleton Postgres client. `globalThis` caching keeps dev hot-reload from
 * exhausting the connection pool. Reads DATABASE_URL directly (not via
 * env()) so scripts like db:seed don't need the full app environment.
 */
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
  database?: ReturnType<typeof drizzle<typeof schema>>;
};

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // `prepare: false` is required when connecting through a transaction-mode
  // pooler (Neon/Supabase pooled endpoints, PgBouncer) — prepared statements
  // aren't supported there. `max` is kept low because each serverless
  // instance opens its own pool. Harmless for a direct local connection too.
  globalForDb.pgClient ??= postgres(url, { max: 5, prepare: false });
  return globalForDb.pgClient;
}

function database() {
  globalForDb.database ??= drizzle(client(), { schema });
  return globalForDb.database;
}

/**
 * Lazily create the database client on the first query. Merely importing a
 * route during `next build` must not require production credentials.
 */
export const db = new Proxy({} as ReturnType<typeof database>, {
  get(_target, property) {
    const target = database();
    return Reflect.get(target, property, target);
  },
});

/**
 * Close the cached client in finite-lived scripts such as the curriculum
 * seed. Application code should keep using the cached client for the lifetime
 * of the serverless instance.
 */
export async function closeDb() {
  const pgClient = globalForDb.pgClient;
  if (!pgClient) return;
  await pgClient.end({ timeout: 5 });
  delete globalForDb.pgClient;
  delete globalForDb.database;
}
