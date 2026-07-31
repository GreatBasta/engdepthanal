import "server-only";

import { createHmac } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

import { db } from "./db/client";
import { rateLimitBuckets } from "./db/schema";

export async function consumeRateLimit(input: {
  action: string;
  identifier: string;
  limit: number;
  windowMinutes: number;
}) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  const keyHash = createHmac("sha256", secret)
    .update(input.identifier.trim().toLocaleLowerCase("en"))
    .digest("hex");
  const windowMs = input.windowMinutes * 60_000;
  const windowStart = new Date(
    Math.floor(Date.now() / windowMs) * windowMs,
  );

  const [row] = await db
    .insert(rateLimitBuckets)
    .values({
      action: input.action,
      keyHash,
      windowStart,
      attempts: 1,
    })
    .onConflictDoUpdate({
      target: [
        rateLimitBuckets.action,
        rateLimitBuckets.keyHash,
        rateLimitBuckets.windowStart,
      ],
      set: { attempts: sql`${rateLimitBuckets.attempts} + 1` },
    })
    .returning({ attempts: rateLimitBuckets.attempts });

  return Number(row?.attempts ?? 1) <= input.limit;
}
