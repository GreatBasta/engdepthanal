import "server-only";

import { and, asc, eq, ilike, or } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { universities } from "@/lib/db/schema";

import {
  dedupeOrganizationResults,
  normalizeOrganizationName,
  normalizeRorResponse,
  organizationResultSchema,
  type OrganizationResult,
} from "./schema";

const ROR_ENDPOINT = "https://api.ror.org/v2/organizations";
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 100;
const rorCache = new Map<string, { expiresAt: number; value: OrganizationResult[] }>();

export async function searchLocalOrganizations(query: string, country?: string) {
  const normalized = normalizeOrganizationName(query);
  const rows = await db
    .select({
      id: universities.id,
      name: universities.name,
      rorId: universities.rorId,
      canonicalName: universities.canonicalName,
      displayName: universities.displayName,
      aliases: universities.aliases,
      acronyms: universities.acronyms,
      organizationType: universities.organizationType,
      countryCode: universities.countryCode,
      countryName: universities.countryName,
      city: universities.city,
      region: universities.region,
      domains: universities.domains,
      primaryDomain: universities.primaryDomain,
      websiteUrl: universities.websiteUrl,
      externalUpdatedAt: universities.externalUpdatedAt,
      status: universities.status,
    })
    .from(universities)
    .where(
      and(
        country ? eq(universities.countryCode, country) : undefined,
        or(
          ilike(universities.name, `%${query}%`),
          ilike(universities.normalizedName, `%${normalized}%`),
          ilike(universities.displayName, `%${query}%`),
          ilike(universities.primaryDomain, `%${query}%`),
        ),
      ),
    )
    .orderBy(asc(universities.name))
    .limit(10);

  return rows.map((row) =>
    organizationResultSchema.parse({
      localId: row.id,
      rorId: row.rorId,
      canonicalName: row.canonicalName ?? row.name,
      displayName: row.displayName ?? row.name,
      aliases: row.aliases,
      acronyms: row.acronyms,
      organizationType: row.organizationType ?? "education",
      city: row.city,
      region: row.region,
      countryCode: row.countryCode,
      countryName: row.countryName,
      domains: row.domains.length
        ? row.domains
        : row.primaryDomain
          ? [row.primaryDomain]
          : [],
      websiteUrl: row.websiteUrl,
      source: "local",
      verified: row.status === "verified",
      externalUpdatedAt: row.externalUpdatedAt
        ? row.externalUpdatedAt.toISOString().slice(0, 10)
        : null,
    }),
  );
}

export async function searchRorOrganizations(
  query: string,
  country?: string,
  fetcher: typeof fetch = fetch,
) {
  const cacheKey = `${normalizeOrganizationName(query)}|${country ?? ""}`;
  const cached = rorCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = new URL(ROR_ENDPOINT);
  url.searchParams.set("query", query);
  try {
    const response = await fetcher(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(3_500),
      next: { revalidate: 300 },
    });
    if (!response.ok) return [];
    const normalized = normalizeRorResponse(await response.json(), country);
    if (rorCache.size >= MAX_CACHE_ENTRIES) {
      rorCache.delete(rorCache.keys().next().value ?? "");
    }
    rorCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      value: normalized,
    });
    return normalized;
  } catch {
    return [];
  }
}

export async function searchOrganizations(query: string, country?: string) {
  const local = await searchLocalOrganizations(query, country);
  if (local.length >= 8) return local.slice(0, 10);
  const external = await searchRorOrganizations(query, country);
  return dedupeOrganizationResults([...local, ...external], 10);
}
