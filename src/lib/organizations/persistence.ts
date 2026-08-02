import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { universities } from "@/lib/db/schema";

import {
  normalizeOrganizationName,
  organizationResultSchema,
  type OrganizationResult,
} from "./schema";

/** Persist only an explicit, normalized selection; typed text is never imported. */
export async function persistOrganizationSelection(
  selection: OrganizationResult,
) {
  const organization = organizationResultSchema.parse(selection);
  if (organization.localId) {
    const [existing] = await db
      .select({ id: universities.id })
      .from(universities)
      .where(eq(universities.id, organization.localId))
      .limit(1);
    if (existing) return existing.id;
  }
  if (!organization.rorId || organization.source !== "ror") {
    throw new Error("A verified ROR selection is required");
  }
  const rorId = organization.rorId;

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: universities.id })
      .from(universities)
      .where(eq(universities.rorId, rorId))
      .limit(1);
    if (existing) return existing.id;

    const [inserted] = await tx
      .insert(universities)
      .values({
        name: organization.canonicalName,
        rorId,
        canonicalName: organization.canonicalName,
        displayName: organization.displayName,
        normalizedName: normalizeOrganizationName(organization.canonicalName),
        aliases: organization.aliases,
        acronyms: organization.acronyms,
        organizationType: organization.organizationType,
        countryCode: organization.countryCode,
        countryName: organization.countryName,
        city: organization.city,
        region: organization.region,
        domains: organization.domains,
        primaryDomain: organization.domains[0] ?? null,
        websiteUrl: organization.websiteUrl,
        externalSource: "ror",
        externalUpdatedAt: organization.externalUpdatedAt
          ? new Date(`${organization.externalUpdatedAt}T00:00:00Z`)
          : null,
        status: "verified",
        updatedAt: new Date(),
      })
      .onConflictDoNothing({ target: universities.rorId })
      .returning({ id: universities.id });
    if (inserted) return inserted.id;

    const [winner] = await tx
      .select({ id: universities.id })
      .from(universities)
      .where(eq(universities.rorId, rorId))
      .limit(1);
    if (!winner) throw new Error("Organization import lost its deduplication race");
    return winner.id;
  });
}
