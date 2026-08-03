import { currentStudentId } from "@/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { organizationSearchParamsSchema } from "@/lib/organizations/schema";
import { searchOrganizations } from "@/lib/organizations/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = organizationSearchParamsSchema.safeParse({
    q: url.searchParams.get("q"),
    country: url.searchParams.get("country") || undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { results: [], error: "invalid_search" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const studentId = await currentStudentId();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0];
  const allowed = await consumeRateLimit({
    action: "organization-search",
    identifier: studentId ?? forwarded ?? "anonymous",
    limit: 50,
    windowMinutes: 5,
  });
  if (!allowed) {
    return Response.json(
      { results: [], error: "rate_limited" },
      { status: 429, headers: { "cache-control": "no-store" } },
    );
  }

  const results = await searchOrganizations(parsed.data.q, parsed.data.country);
  return Response.json(
    { results, upstreamAvailable: results.some((result) => result.source === "ror") },
    { headers: { "cache-control": "private, max-age=60" } },
  );
}
