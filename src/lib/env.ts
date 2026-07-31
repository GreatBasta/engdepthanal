import { z } from "zod";

const schema = z.object({
  AUTH_SECRET: z.string().min(1),
});

let cached: z.infer<typeof schema> | null = null;

/**
 * Lazy env access: parse on first use, not at import time, so `next build`
 * works without a configured environment.
 */
export function env(): z.infer<typeof schema> {
  cached ??= schema.parse({
    AUTH_SECRET: process.env.AUTH_SECRET,
  });
  return cached;
}
