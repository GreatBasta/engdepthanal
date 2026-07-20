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
};

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  globalForDb.pgClient ??= postgres(url, { max: 10 });
  return globalForDb.pgClient;
}

export const db = drizzle(client(), { schema });
