import "server-only";

import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { academicTaxonomy } from "@/lib/academics/taxonomy";
import { db } from "@/lib/db/client";
import {
  academicFields,
  degreeProgrammeAcademicFields,
  degreeProgrammes,
  organizationCatalogScans,
  organizationProgramCandidates,
  organizationUnitCandidates,
  organizationalUnits,
  programAcademicFields,
  programs,
  universities,
  universityPrograms,
} from "@/lib/db/schema";
import {
  persistOrganizationProgramSelection,
  persistOrganizationSelection,
} from "@/lib/organizations/persistence";
import {
  organizationResultSchema,
  type OrganizationResult,
} from "@/lib/organizations/schema";

const choiceKinds = ["taxonomy", "local", "degree", "candidate"] as const;
const unitChoiceKinds = ["unit", "unit-candidate"] as const;

export const onboardingProgrammeChoiceSchema = z
  .string()
  .max(160)
  .refine((value) => {
    const [kind, id] = value.split(":", 2);
    return choiceKinds.includes(kind as (typeof choiceKinds)[number]) && Boolean(id);
  }, "Select a degree programme or field of study");

export const onboardingUnitChoiceSchema = z
  .string()
  .max(160)
  .refine((value) => {
    if (!value) return true;
    const [kind, id] = value.split(":", 2);
    return unitChoiceKinds.includes(kind as (typeof unitChoiceKinds)[number]) && Boolean(id);
  }, "Select an organizational unit from the list");

export interface OnboardingProgrammeOption {
  value: string;
  kind: "local" | "official" | "discovered";
  name: string;
  secondary: string | null;
  status: "official" | "local" | "needs_review";
  officialUrl: string | null;
  unitChoice: string | null;
}

export interface OnboardingUnitOption {
  value: string;
  name: string;
  type: string;
  status: "official" | "needs_review";
}

function localizedName(
  canonical: string,
  names: Record<string, string> | null | undefined,
  locale: string,
) {
  return names?.[locale] ?? names?.en ?? canonical;
}

export function getTaxonomyOnboardingOptions(locale: string) {
  return academicTaxonomy.map((field) => ({
    value: `taxonomy:${field.key}`,
    name: localizedName(field.labels.en, field.labels, locale),
    secondary: field.parentKey
      ? localizedName(
          academicTaxonomy.find((item) => item.key === field.parentKey)?.labels.en ??
            field.parentKey,
          academicTaxonomy.find((item) => item.key === field.parentKey)?.labels,
          locale,
        )
      : null,
    level: field.level,
    aliases: [...(field.aliases[locale] ?? []), ...(field.aliases.en ?? [])],
  }));
}

export async function organizationIdForOnboardingRead(
  input: unknown,
): Promise<string | null> {
  const parsed = organizationResultSchema.safeParse(input);
  if (!parsed.success) return null;
  const selection = parsed.data;
  const condition = selection.localId
    ? eq(universities.id, selection.localId)
    : selection.rorId
      ? eq(universities.rorId, selection.rorId)
      : null;
  if (!condition) return null;
  const [row] = await db
    .select({ id: universities.id })
    .from(universities)
    .where(condition)
    .limit(1);
  return row?.id ?? null;
}

export async function getInstitutionOnboardingOptions(
  organizationId: string,
  locale: string,
) {
  const [localRows, degreeRows, candidateRows, unitRows, unitCandidateRows, latestScan] =
    await Promise.all([
      db
        .select({
          id: universityPrograms.id,
          degreeProgrammeId: universityPrograms.degreeProgrammeId,
          localName: universityPrograms.localName,
          localizedNames: universityPrograms.localizedNames,
          taxonomyName: programs.name,
          taxonomyLocalizedNames: programs.localizedNames,
          degreeName: degreeProgrammes.canonicalName,
          degreeLocalizedNames: degreeProgrammes.localizedNames,
          degreeLevel: universityPrograms.degreeLevel,
          officialUrl: universityPrograms.officialUrl,
          organizationalUnitId: universityPrograms.organizationalUnitId,
          status: universityPrograms.status,
        })
        .from(universityPrograms)
        .innerJoin(programs, eq(programs.id, universityPrograms.programId))
        .leftJoin(
          degreeProgrammes,
          eq(degreeProgrammes.id, universityPrograms.degreeProgrammeId),
        )
        .where(eq(universityPrograms.universityId, organizationId))
        .orderBy(asc(universityPrograms.localName), asc(programs.name)),
      db
        .select()
        .from(degreeProgrammes)
        .where(eq(degreeProgrammes.organizationId, organizationId))
        .orderBy(asc(degreeProgrammes.canonicalName)),
      db
        .select()
        .from(organizationProgramCandidates)
        .where(
          and(
            eq(organizationProgramCandidates.organizationId, organizationId),
            inArray(organizationProgramCandidates.status, [
              "candidate",
              "confirmed",
              "merged",
            ]),
          ),
        )
        .orderBy(
          desc(organizationProgramCandidates.status),
          asc(organizationProgramCandidates.canonicalSourceName),
        )
        .limit(100),
      db
        .select()
        .from(organizationalUnits)
        .where(eq(organizationalUnits.organizationId, organizationId))
        .orderBy(asc(organizationalUnits.canonicalName)),
      db
        .select()
        .from(organizationUnitCandidates)
        .where(
          and(
            eq(organizationUnitCandidates.organizationId, organizationId),
            inArray(organizationUnitCandidates.status, [
              "candidate",
              "confirmed",
              "merged",
            ]),
          ),
        )
        .orderBy(
          desc(organizationUnitCandidates.status),
          asc(organizationUnitCandidates.canonicalSourceName),
        )
        .limit(100),
      db
        .select({
          status: organizationCatalogScans.status,
          requestedAt: organizationCatalogScans.requestedAt,
          finishedAt: organizationCatalogScans.finishedAt,
        })
        .from(organizationCatalogScans)
        .where(eq(organizationCatalogScans.organizationId, organizationId))
        .orderBy(desc(organizationCatalogScans.requestedAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

  const linkedDegreeIds = new Set(
    localRows.flatMap((row) => (row.degreeProgrammeId ? [row.degreeProgrammeId] : [])),
  );
  const linkedOfficialUrls = new Set(
    [...localRows, ...degreeRows]
      .map((row) => row.officialUrl)
      .filter((url): url is string => Boolean(url)),
  );

  const programmes: OnboardingProgrammeOption[] = [
    ...localRows.map((row) => ({
      value: `local:${row.id}`,
      kind: row.degreeProgrammeId ? ("official" as const) : ("local" as const),
      name:
        row.localName ??
        (row.degreeName
          ? localizedName(row.degreeName, row.degreeLocalizedNames, locale)
          : localizedName(row.taxonomyName, row.taxonomyLocalizedNames, locale)),
      secondary: row.degreeLevel?.replaceAll("_", " ") ?? null,
      status:
        row.status === "verified" ? ("official" as const) : ("local" as const),
      officialUrl: row.officialUrl,
      unitChoice: row.organizationalUnitId
        ? `unit:${row.organizationalUnitId}`
        : null,
    })),
    ...degreeRows
      .filter((row) => !linkedDegreeIds.has(row.id))
      .map((row) => ({
        value: `degree:${row.id}`,
        kind: "official" as const,
        name: localizedName(row.canonicalName, row.localizedNames, locale),
        secondary: row.degreeLevel?.replaceAll("_", " ") ?? null,
        status:
          row.status === "verified"
            ? ("official" as const)
            : ("needs_review" as const),
        officialUrl: row.officialUrl,
        unitChoice: row.organizationalUnitId
          ? `unit:${row.organizationalUnitId}`
          : null,
      })),
    ...candidateRows
      .filter((row) => !linkedOfficialUrls.has(row.officialUrl))
      .map((row) => ({
        value: `candidate:${row.id}`,
        kind: "discovered" as const,
        name: row.localDisplayName ?? row.canonicalSourceName,
        secondary: row.degreeLevel?.replaceAll("_", " ") ?? null,
        status:
          row.status === "confirmed"
            ? ("official" as const)
            : ("needs_review" as const),
        officialUrl: row.officialUrl,
        unitChoice: row.unitCandidateId
          ? `unit-candidate:${row.unitCandidateId}`
          : null,
      })),
  ];

  const units: OnboardingUnitOption[] = [
    ...unitRows.map((row) => ({
      value: `unit:${row.id}`,
      name: localizedName(row.canonicalName, row.localizedNames, locale),
      type: row.unitType,
      status:
        row.status === "verified" ? ("official" as const) : ("needs_review" as const),
    })),
    ...unitCandidateRows.map((row) => ({
      value: `unit-candidate:${row.id}`,
      name: localizedName(row.canonicalSourceName, row.localizedNames, locale),
      type: row.unitType,
      status:
        row.status === "confirmed" ? ("official" as const) : ("needs_review" as const),
    })),
  ];

  return { programmes, units, latestScan };
}

async function programIdForFieldKeys(fieldKeys: string[]) {
  if (fieldKeys.length) {
    const [row] = await db
      .select({ id: programs.id })
      .from(programs)
      .innerJoin(
        programAcademicFields,
        eq(programAcademicFields.programId, programs.id),
      )
      .innerJoin(
        academicFields,
        eq(academicFields.id, programAcademicFields.academicFieldId),
      )
      .where(inArray(academicFields.stableKey, fieldKeys))
      .orderBy(desc(programAcademicFields.isPrimary))
      .limit(1);
    if (row) return row.id;
  }
  const [fallback] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(eq(programs.slug, "interdisciplinary-studies"))
    .limit(1);
  if (!fallback) throw new Error("Academic taxonomy is not initialized");
  return fallback.id;
}

async function materializeUnitCandidate(
  organizationId: string,
  candidateId: string,
) {
  const [candidate] = await db
    .select()
    .from(organizationUnitCandidates)
    .where(
      and(
        eq(organizationUnitCandidates.id, candidateId),
        eq(organizationUnitCandidates.organizationId, organizationId),
        inArray(organizationUnitCandidates.status, [
          "candidate",
          "confirmed",
          "merged",
        ]),
      ),
    )
    .limit(1);
  if (!candidate) throw new Error("Organizational unit is not available");
  const identity = candidate.externalSourceId
    ? eq(organizationalUnits.externalSourceId, candidate.externalSourceId)
    : eq(organizationalUnits.officialUrl, candidate.officialUrl);
  const [existing] = await db
    .select({ id: organizationalUnits.id })
    .from(organizationalUnits)
    .where(and(eq(organizationalUnits.organizationId, organizationId), identity))
    .limit(1);
  if (existing) return existing.id;
  const [inserted] = await db
    .insert(organizationalUnits)
    .values({
      organizationId,
      unitType: candidate.unitType,
      canonicalName: candidate.canonicalSourceName,
      localizedNames: candidate.localizedNames,
      externalSourceId: candidate.externalSourceId,
      officialUrl: candidate.officialUrl,
      sourceEvidence: candidate.evidence.map((item) => ({
        url: item.sourceUrl,
        label: item.field,
      })),
      status: candidate.status === "confirmed" ? "verified" : "unverified",
    })
    .onConflictDoNothing()
    .returning({ id: organizationalUnits.id });
  if (inserted) return inserted.id;
  const [winner] = await db
    .select({ id: organizationalUnits.id })
    .from(organizationalUnits)
    .where(and(eq(organizationalUnits.organizationId, organizationId), identity))
    .limit(1);
  if (!winner) throw new Error("Organizational unit resolution lost its race");
  return winner.id;
}

async function materializeProgrammeCandidate(
  organizationId: string,
  candidateId: string,
) {
  const [candidate] = await db
    .select()
    .from(organizationProgramCandidates)
    .where(
      and(
        eq(organizationProgramCandidates.id, candidateId),
        eq(organizationProgramCandidates.organizationId, organizationId),
        inArray(organizationProgramCandidates.status, [
          "candidate",
          "confirmed",
          "merged",
        ]),
      ),
    )
    .limit(1);
  if (!candidate) throw new Error("Degree programme is not available");
  const identity = candidate.externalSourceId
    ? eq(degreeProgrammes.externalSourceId, candidate.externalSourceId)
    : eq(degreeProgrammes.officialUrl, candidate.officialUrl);
  let [degree] = await db
    .select()
    .from(degreeProgrammes)
    .where(and(eq(degreeProgrammes.organizationId, organizationId), identity))
    .limit(1);
  if (!degree) {
    const unitId = candidate.unitCandidateId
      ? await materializeUnitCandidate(organizationId, candidate.unitCandidateId)
      : null;
    [degree] = await db
      .insert(degreeProgrammes)
      .values({
        organizationId,
        organizationalUnitId: unitId,
        externalSourceId: candidate.externalSourceId,
        canonicalName: candidate.canonicalSourceName,
        localizedNames: {},
        degreeLevel: candidate.degreeLevel,
        officialUrl: candidate.officialUrl,
        languageCodes: candidate.languageCodes,
        credits: candidate.credits,
        durationYears: candidate.durationYears,
        sourceEvidence: candidate.evidence.map((item) => ({
          url: item.sourceUrl,
          label: item.field,
        })),
        status: candidate.status === "confirmed" ? "verified" : "unverified",
      })
      .onConflictDoNothing()
      .returning();
    if (!degree) {
      [degree] = await db
        .select()
        .from(degreeProgrammes)
        .where(and(eq(degreeProgrammes.organizationId, organizationId), identity))
        .limit(1);
    }
  }
  if (!degree) throw new Error("Degree programme resolution lost its race");

  if (candidate.academicFieldKeys.length) {
    const fields = await db
      .select({ id: academicFields.id, key: academicFields.stableKey })
      .from(academicFields)
      .where(inArray(academicFields.stableKey, candidate.academicFieldKeys));
    for (const [index, field] of fields.entries()) {
      await db
        .insert(degreeProgrammeAcademicFields)
        .values({
          degreeProgrammeId: degree.id,
          academicFieldId: field.id,
          isPrimary: index === 0,
        })
        .onConflictDoNothing();
    }
  }
  return { degree, fieldKeys: candidate.academicFieldKeys };
}

async function degreeFieldKeys(degreeProgrammeId: string) {
  return db
    .select({ key: academicFields.stableKey })
    .from(degreeProgrammeAcademicFields)
    .innerJoin(
      academicFields,
      eq(academicFields.id, degreeProgrammeAcademicFields.academicFieldId),
    )
    .where(eq(degreeProgrammeAcademicFields.degreeProgrammeId, degreeProgrammeId))
    .orderBy(desc(degreeProgrammeAcademicFields.isPrimary))
    .then((rows) => rows.map((row) => row.key));
}

async function ensureDegreeProgrammeBridge(
  organizationId: string,
  degree: typeof degreeProgrammes.$inferSelect,
  fieldKeys: string[],
) {
  const [existing] = await db
    .select({ id: universityPrograms.id })
    .from(universityPrograms)
    .where(eq(universityPrograms.degreeProgrammeId, degree.id))
    .limit(1);
  if (existing) return existing.id;

  const programId = await programIdForFieldKeys(fieldKeys);
  const [inserted] = await db
    .insert(universityPrograms)
    .values({
      universityId: organizationId,
      programId,
      degreeProgrammeId: degree.id,
      organizationalUnitId: degree.organizationalUnitId,
      localName: degree.canonicalName,
      localizedNames: degree.localizedNames,
      degreeLevel: degree.degreeLevel,
      externalSourceId: degree.externalSourceId,
      officialUrl: degree.officialUrl,
      languageCodes: degree.languageCodes,
      credits: degree.credits,
      durationYears: degree.durationYears,
      sourceEvidence: degree.sourceEvidence,
      sourceUpdatedAt: degree.sourceUpdatedAt,
      status: degree.status,
    })
    .onConflictDoNothing()
    .returning({ id: universityPrograms.id });
  if (inserted) return inserted.id;

  const [winner] = await db
    .select({ id: universityPrograms.id })
    .from(universityPrograms)
    .where(
      or(
        eq(universityPrograms.degreeProgrammeId, degree.id),
        degree.externalSourceId
          ? and(
              eq(universityPrograms.universityId, organizationId),
              eq(universityPrograms.externalSourceId, degree.externalSourceId),
            )
          : undefined,
      ),
    )
    .limit(1);
  if (!winner) throw new Error("Degree programme bridge lost its race");
  return winner.id;
}

export async function persistOnboardingProgrammeChoice(input: {
  organization: OrganizationResult;
  programmeChoice: string;
  unitChoice?: string | null;
}) {
  const organization = organizationResultSchema.parse(input.organization);
  const programmeChoice = onboardingProgrammeChoiceSchema.parse(
    input.programmeChoice,
  );
  const organizationId = await persistOrganizationSelection(organization);
  const [kind, id] = programmeChoice.split(":", 2);

  let universityProgramId: string;
  let defaultUnitId: string | null = null;
  if (kind === "taxonomy") {
    const taxonomy = await persistOrganizationProgramSelection(organization, id);
    universityProgramId = taxonomy.universityProgramId;
  } else if (kind === "local") {
    const [row] = await db
      .select({
        id: universityPrograms.id,
        organizationalUnitId: universityPrograms.organizationalUnitId,
      })
      .from(universityPrograms)
      .where(
        and(
          eq(universityPrograms.id, id),
          eq(universityPrograms.universityId, organizationId),
        ),
      )
      .limit(1);
    if (!row) throw new Error("Degree programme is not available");
    universityProgramId = row.id;
    defaultUnitId = row.organizationalUnitId;
  } else {
    const materialized =
      kind === "candidate"
        ? await materializeProgrammeCandidate(organizationId, id)
        : await db
            .select()
            .from(degreeProgrammes)
            .where(
              and(
                eq(degreeProgrammes.id, id),
                eq(degreeProgrammes.organizationId, organizationId),
              ),
            )
            .limit(1)
            .then((rows) => {
              if (!rows[0]) throw new Error("Degree programme is not available");
              return { degree: rows[0], fieldKeys: null };
            });
    const fieldKeys =
      materialized.fieldKeys ?? (await degreeFieldKeys(materialized.degree.id));
    universityProgramId = await ensureDegreeProgrammeBridge(
      organizationId,
      materialized.degree,
      fieldKeys,
    );
    defaultUnitId = materialized.degree.organizationalUnitId;
  }

  let organizationalUnitId = defaultUnitId;
  const unitChoice = onboardingUnitChoiceSchema.parse(input.unitChoice ?? "");
  if (unitChoice) {
    const [unitKind, unitId] = unitChoice.split(":", 2);
    if (unitKind === "unit-candidate") {
      organizationalUnitId = await materializeUnitCandidate(
        organizationId,
        unitId,
      );
    } else {
      const [unit] = await db
        .select({ id: organizationalUnits.id })
        .from(organizationalUnits)
        .where(
          and(
            eq(organizationalUnits.id, unitId),
            eq(organizationalUnits.organizationId, organizationId),
          ),
        )
        .limit(1);
      if (!unit) throw new Error("Organizational unit is not available");
      organizationalUnitId = unit.id;
    }
  }

  return { organizationId, universityProgramId, organizationalUnitId };
}
