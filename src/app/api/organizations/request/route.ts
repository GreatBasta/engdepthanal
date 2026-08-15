import { z } from "zod";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import { organizationRequests } from "@/lib/db/schema";
import { consumeRateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({
  name: z.string().trim().min(2).max(200),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  city: z.string().trim().max(160).optional(),
  websiteUrl: z.string().trim().url().max(500).optional(),
});

export async function POST(request: Request) {
  const studentId = await currentStudentId();
  if (!studentId) {
    return Response.json({ error: "sign_in_required" }, { status: 401 });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const allowed = await consumeRateLimit({
    action: "organization-request",
    identifier: studentId,
    limit: 5,
    windowMinutes: 60,
  });
  if (!allowed) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const [created] = await db
    .insert(organizationRequests)
    .values({
      studentId,
      requestedName: parsed.data.name,
      countryCode: parsed.data.countryCode,
      city: parsed.data.city,
      websiteUrl: parsed.data.websiteUrl,
    })
    .returning({ id: organizationRequests.id });
  return Response.json({ id: created.id, status: "pending" }, { status: 201 });
}
