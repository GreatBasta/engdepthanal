import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  courseCandidateMatches,
  courseMetadataChangeReviews,
  coursePages,
  courseSourceSnapshots,
  organizationCatalogDomains,
  organizationCatalogScans,
  organizationCatalogSources,
  organizationCourseCandidates,
  organizationProgramCandidates,
  organizationUnitCandidates,
  programs,
  universities,
  universityPrograms,
} from "@/lib/db/schema";

import { discoverInitialCatalogSources } from "./connectors";
import {
  candidateIdentityKeys,
  canonicalCatalogUrl,
  fallbackCourseDedupKey,
  matchCandidateToExistingCourses,
  normalizeCourseCode,
  normalizeCourseName,
} from "./normalize";
import { assertTrustedCatalogUrl, normalizeCatalogDomain } from "./policy";
import { advanceCatalogProgress, catalogMetadataChanges } from "./state";
import {
  DEFAULT_CATALOG_LIMITS,
  type CatalogSourceCandidate,
  type NormalizedCatalogResult,
  type OrganizationContext,
  type SourceEvidence,
} from "./types";

const FRESH_SCAN_MS = 30 * 24 * 60 * 60 * 1_000;

export function catalogCrawlerUserAgent() {
  const configured = process.env.CATALOG_CRAWLER_USER_AGENT?.trim();
  if (configured) return configured;
  const contact =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ?? "contact@course-atlas.example";
  return `CourseAtlasCatalogBot/1.0 (+mailto:${contact})`;
}

export async function getOrganizationCatalogContext(
  organizationId: string,
): Promise<OrganizationContext> {
  const [organization] = await db
    .select({
      id: universities.id,
      rorId: universities.rorId,
      name: universities.name,
      canonicalName: universities.canonicalName,
      domains: universities.domains,
      primaryDomain: universities.primaryDomain,
      websiteUrl: universities.websiteUrl,
      status: universities.status,
    })
    .from(universities)
    .where(eq(universities.id, organizationId))
    .limit(1);
  if (!organization || organization.status !== "verified") {
    throw new Error("catalog discovery requires a verified organization");
  }

  const rorDomains = [...new Set([
    ...organization.domains,
    ...(organization.primaryDomain ? [organization.primaryDomain] : []),
  ])].flatMap((domain) => {
    try {
      return [normalizeCatalogDomain(domain)];
    } catch {
      return [];
    }
  });
  if (organization.websiteUrl) {
    try {
      const websiteDomain = normalizeCatalogDomain(
        new URL(organization.websiteUrl).hostname,
      );
      if (!rorDomains.includes(websiteDomain)) rorDomains.push(websiteDomain);
    } catch {
      // Invalid legacy website values do not expand the trusted boundary.
    }
  }

  for (const domain of rorDomains) {
    await db
      .insert(organizationCatalogDomains)
      .values({
        organizationId,
        domain,
        boundarySource: organization.rorId ? "ror" : "verified_website",
        approved: true,
        approvedAt: new Date(),
        evidenceUrl: organization.websiteUrl,
      })
      .onConflictDoUpdate({
        target: [
          organizationCatalogDomains.organizationId,
          organizationCatalogDomains.domain,
        ],
        set: { approved: true, updatedAt: new Date() },
      });
  }

  const approvedRows = await db
    .select({ domain: organizationCatalogDomains.domain })
    .from(organizationCatalogDomains)
    .where(
      and(
        eq(organizationCatalogDomains.organizationId, organizationId),
        eq(organizationCatalogDomains.approved, true),
      ),
    );
  const approvedDomains = [...new Set(approvedRows.map((row) => row.domain))];
  if (!approvedDomains.length) throw new Error("organization has no approved domains");
  return {
    organizationId,
    rorId: organization.rorId,
    canonicalName: organization.canonicalName ?? organization.name,
    verifiedDomains: rorDomains,
    approvedDomains,
    officialWebsiteUrl: organization.websiteUrl,
    locale: "en",
    crawlerUserAgent: catalogCrawlerUserAgent(),
    limits: DEFAULT_CATALOG_LIMITS,
  };
}

export async function persistDiscoveredCatalogSources(
  context: OrganizationContext,
  candidates: readonly CatalogSourceCandidate[],
) {
  const ids: string[] = [];
  for (const candidate of candidates.slice(0, context.limits.maxPages)) {
    const trusted = assertTrustedCatalogUrl(candidate.url, context.approvedDomains);
    const domain = normalizeCatalogDomain(trusted.hostname);
    const [inserted] = await db
      .insert(organizationCatalogSources)
      .values({
        organizationId: context.organizationId,
        sourceUrl: trusted.href,
        sourceType: candidate.sourceType,
        connectorId: candidate.connectorId,
        domain,
        domainApproved: true,
        connectorConfig: candidate.config,
      })
      .onConflictDoUpdate({
        target: [
          organizationCatalogSources.organizationId,
          organizationCatalogSources.sourceUrl,
        ],
        set: {
          sourceType: candidate.sourceType,
          connectorId: candidate.connectorId,
          domain,
          domainApproved: true,
          connectorConfig: candidate.config,
          updatedAt: new Date(),
        },
      })
      .returning({ id: organizationCatalogSources.id });
    if (inserted) ids.push(inserted.id);
  }
  return ids;
}

export async function prepareCatalogScan(scanId: string) {
  const [scan] = await db
    .select()
    .from(organizationCatalogScans)
    .where(eq(organizationCatalogScans.id, scanId))
    .limit(1);
  if (!scan) throw new Error("catalog scan not found");
  const context = await getOrganizationCatalogContext(scan.organizationId);
  const initialSources = await discoverInitialCatalogSources(context);
  await persistDiscoveredCatalogSources(context, initialSources);
  await db
    .update(organizationCatalogScans)
    .set({ status: "running", startedAt: scan.startedAt ?? new Date(), updatedAt: new Date() })
    .where(eq(organizationCatalogScans.id, scanId));
  return {
    organizationId: scan.organizationId,
    maxPages: context.limits.maxPages,
    nextSourceIndex: scan.checkpoint.processedSourceIds?.length ?? 0,
  };
}

export async function nextCatalogSource(scanId: string, index: number) {
  const [scan] = await db
    .select({ organizationId: organizationCatalogScans.organizationId })
    .from(organizationCatalogScans)
    .where(eq(organizationCatalogScans.id, scanId))
    .limit(1);
  if (!scan) throw new Error("catalog scan not found");
  const rows = await db
    .select({ id: organizationCatalogSources.id })
    .from(organizationCatalogSources)
    .where(
      and(
        eq(organizationCatalogSources.organizationId, scan.organizationId),
        eq(organizationCatalogSources.active, true),
        eq(organizationCatalogSources.domainApproved, true),
      ),
    )
    .orderBy(asc(organizationCatalogSources.createdAt), asc(organizationCatalogSources.id))
    .limit(1)
    .offset(index);
  return rows[0]?.id ?? null;
}

async function findCandidate(
  organizationId: string,
  candidate: NormalizedCatalogResult["courses"][number],
) {
  for (const identity of candidateIdentityKeys(organizationId, candidate)) {
    const condition =
      identity.priority === 1
        ? and(
            eq(organizationCourseCandidates.organizationId, organizationId),
            eq(
              organizationCourseCandidates.externalSourceId,
              candidate.externalSourceId!,
            ),
            candidate.academicYear
              ? eq(organizationCourseCandidates.academicYear, candidate.academicYear)
              : isNull(organizationCourseCandidates.academicYear),
          )
        : identity.priority === 2
          ? and(
              eq(organizationCourseCandidates.organizationId, organizationId),
              eq(
                organizationCourseCandidates.normalizedCourseCode,
                normalizeCourseCode(candidate.courseCode)!,
              ),
              candidate.academicYear
                ? eq(organizationCourseCandidates.academicYear, candidate.academicYear)
                : isNull(organizationCourseCandidates.academicYear),
            )
          : identity.priority === 3
            ? and(
                eq(organizationCourseCandidates.organizationId, organizationId),
                eq(
                  organizationCourseCandidates.officialUrl,
                  canonicalCatalogUrl(candidate.officialUrl),
                ),
                candidate.academicYear
                  ? eq(organizationCourseCandidates.academicYear, candidate.academicYear)
                  : isNull(organizationCourseCandidates.academicYear),
              )
            : and(
                eq(organizationCourseCandidates.organizationId, organizationId),
                eq(
                  organizationCourseCandidates.fallbackDedupKey,
                  fallbackCourseDedupKey(candidate),
                ),
              );
    const [existing] = await db
      .select()
      .from(organizationCourseCandidates)
      .where(condition)
      .limit(1);
    if (existing) return existing;
  }
  return null;
}

async function persistUnitCandidates(
  scanId: string,
  sourceId: string,
  organizationId: string,
  result: NormalizedCatalogResult,
) {
  const ids = new Map<string, string>();
  for (const unit of result.organizationalUnits) {
    const [existing] = await db
      .select({ id: organizationUnitCandidates.id })
      .from(organizationUnitCandidates)
      .where(
        and(
          eq(organizationUnitCandidates.organizationId, organizationId),
          unit.externalSourceId
            ? eq(organizationUnitCandidates.externalSourceId, unit.externalSourceId)
            : eq(organizationUnitCandidates.officialUrl, unit.officialUrl),
        ),
      )
      .limit(1);
    const [row] = existing
      ? await db
          .update(organizationUnitCandidates)
          .set({
            lastSeenScanId: scanId,
            parentExternalSourceId: unit.parentExternalSourceId,
            unitType: unit.unitType,
            canonicalSourceName: unit.canonicalSourceName,
            localizedNames: unit.localizedNames,
            officialUrl: unit.officialUrl,
            evidence: unit.evidence,
            confidence: unit.confidence.toString(),
            lastDiscoveredAt: new Date(),
          })
          .where(eq(organizationUnitCandidates.id, existing.id))
          .returning({ id: organizationUnitCandidates.id })
      : await db
          .insert(organizationUnitCandidates)
          .values({
            organizationId,
            sourceId,
            lastSeenScanId: scanId,
            externalSourceId: unit.externalSourceId,
            parentExternalSourceId: unit.parentExternalSourceId,
            unitType: unit.unitType,
            canonicalSourceName: unit.canonicalSourceName,
            localizedNames: unit.localizedNames,
            officialUrl: unit.officialUrl,
            evidence: unit.evidence,
            confidence: unit.confidence.toString(),
          })
          .returning({ id: organizationUnitCandidates.id });
    if (row && unit.externalSourceId) ids.set(unit.externalSourceId, row.id);
  }
  return ids;
}

async function persistProgrammeCandidates(
  scanId: string,
  sourceId: string,
  organizationId: string,
  unitIds: Map<string, string>,
  result: NormalizedCatalogResult,
) {
  const ids = new Map<string, string>();
  for (const programme of result.programmes) {
    const [existing] = await db
      .select({ id: organizationProgramCandidates.id })
      .from(organizationProgramCandidates)
      .where(
        and(
          eq(organizationProgramCandidates.organizationId, organizationId),
          programme.externalSourceId
            ? eq(
                organizationProgramCandidates.externalSourceId,
                programme.externalSourceId,
              )
            : eq(organizationProgramCandidates.officialUrl, programme.officialUrl),
        ),
      )
      .limit(1);
    const values = {
      lastSeenScanId: scanId,
      unitCandidateId: programme.unitExternalSourceId
        ? unitIds.get(programme.unitExternalSourceId) ?? null
        : null,
      canonicalSourceName: programme.canonicalSourceName,
      localDisplayName: programme.localDisplayName,
      degreeLevel: programme.degreeLevel,
      academicFieldKeys: programme.academicFieldKeys,
      languageCodes: programme.languageCodes,
      credits: programme.credits?.toString() ?? null,
      durationYears: programme.durationYears?.toString() ?? null,
      officialUrl: programme.officialUrl,
      evidence: programme.evidence,
      confidence: programme.confidence.toString(),
      lastDiscoveredAt: new Date(),
    };
    const [row] = existing
      ? await db
          .update(organizationProgramCandidates)
          .set(values)
          .where(eq(organizationProgramCandidates.id, existing.id))
          .returning({ id: organizationProgramCandidates.id })
      : await db
          .insert(organizationProgramCandidates)
          .values({
            ...values,
            organizationId,
            sourceId,
            externalSourceId: programme.externalSourceId,
          })
          .returning({ id: organizationProgramCandidates.id });
    if (row && programme.externalSourceId) ids.set(programme.externalSourceId, row.id);
  }
  return ids;
}

export async function persistCatalogResult(input: {
  scanId: string;
  sourceId: string;
  organizationId: string;
  source: SourceEvidence;
  result: NormalizedCatalogResult;
}) {
  const unitIds = await persistUnitCandidates(
    input.scanId,
    input.sourceId,
    input.organizationId,
    input.result,
  );
  const programmeIds = await persistProgrammeCandidates(
    input.scanId,
    input.sourceId,
    input.organizationId,
    unitIds,
    input.result,
  );
  let courseCount = 0;
  for (const candidate of input.result.courses) {
    const existing = await findCandidate(input.organizationId, candidate);
    const normalizedData = {
      ...candidate,
      normalizedCourseCode: normalizeCourseCode(candidate.courseCode),
      normalizedCourseName: normalizeCourseName(candidate.canonicalSourceName),
      fallbackDedupKey: fallbackCourseDedupKey(candidate),
    };
    const [previousSnapshot] = existing
      ? await db
          .select()
          .from(courseSourceSnapshots)
          .where(eq(courseSourceSnapshots.courseCandidateId, existing.id))
          .orderBy(desc(courseSourceSnapshots.fetchedAt))
          .limit(1)
      : [];
    const changedFields = catalogMetadataChanges(
      (previousSnapshot?.normalizedData as Record<string, unknown> | undefined) ?? null,
      normalizedData,
    );
    const values = {
      sourceId: input.sourceId,
      lastSeenScanId: input.scanId,
      programmeCandidateId: candidate.programmeExternalSourceId
        ? programmeIds.get(candidate.programmeExternalSourceId) ?? null
        : null,
      sourceUrl: input.source.sourceUrl,
      sourceType: input.source.sourceType,
      externalSourceId: candidate.externalSourceId,
      courseCode: candidate.courseCode,
      normalizedCourseCode: normalizeCourseCode(candidate.courseCode),
      canonicalSourceName: candidate.canonicalSourceName,
      localDisplayName: candidate.localDisplayName,
      normalizedCourseName: normalizeCourseName(candidate.canonicalSourceName),
      description: candidate.description,
      credits: candidate.credits?.toString() ?? null,
      languageCodes: candidate.languageCodes,
      department: candidate.department,
      degreeProgramme: candidate.degreeProgramme,
      academicYear: candidate.academicYear,
      semester: candidate.semester,
      professorName: candidate.professorName,
      campus: candidate.campus,
      officialUrl: canonicalCatalogUrl(candidate.officialUrl),
      fallbackDedupKey: fallbackCourseDedupKey(candidate),
      evidence: candidate.evidence,
      confidence: candidate.confidence.toString(),
      sourceUpdatedAt: candidate.sourceUpdatedAt
        ? new Date(candidate.sourceUpdatedAt)
        : null,
      lastDiscoveredAt: new Date(),
    };
    const [persisted] = existing
      ? await db
          .update(organizationCourseCandidates)
          .set(values)
          .where(eq(organizationCourseCandidates.id, existing.id))
          .returning({ id: organizationCourseCandidates.id })
      : await db
          .insert(organizationCourseCandidates)
          .values({ ...values, organizationId: input.organizationId })
          .returning({ id: organizationCourseCandidates.id });
    if (!persisted) continue;

    const [snapshot] = await db
      .insert(courseSourceSnapshots)
      .values({
        sourceId: input.sourceId,
        scanId: input.scanId,
        courseCandidateId: persisted.id,
        previousSnapshotId: previousSnapshot?.id ?? null,
        sourceUrl: input.source.sourceUrl,
        httpStatus: input.source.status,
        contentType: input.source.contentType,
        httpEtag: input.source.etag,
        httpLastModified: input.source.lastModified,
        contentChecksum: input.source.checksum,
        normalizedData,
        extractedEvidence: candidate.evidence.map((item) => ({
          field: item.field,
          value: item.value,
          selector: item.selector,
        })),
        changedFields,
      })
      .onConflictDoNothing()
      .returning({ id: courseSourceSnapshots.id });

    const existingCourseRows = await db
      .select({
        id: coursePages.id,
        organizationId: universities.id,
        courseCode: coursePages.courseCode,
        localName: coursePages.localName,
        programmeName: programs.name,
        academicYear: coursePages.academicYear,
      })
      .from(coursePages)
      .innerJoin(
        universityPrograms,
        eq(coursePages.universityProgramId, universityPrograms.id),
      )
      .innerJoin(universities, eq(universityPrograms.universityId, universities.id))
      .innerJoin(programs, eq(universityPrograms.programId, programs.id))
      .where(eq(universities.id, input.organizationId));
    const matches = matchCandidateToExistingCourses(
      input.organizationId,
      candidate,
      existingCourseRows,
    );
    for (const match of matches) {
      await db
        .insert(courseCandidateMatches)
        .values({
          courseCandidateId: persisted.id,
          coursePageId: match.coursePageId,
          score: match.score.toString(),
          reasons: match.reasons,
        })
        .onConflictDoUpdate({
          target: [
            courseCandidateMatches.courseCandidateId,
            courseCandidateMatches.coursePageId,
          ],
          set: { score: match.score.toString(), reasons: match.reasons },
        });
      if (snapshot && changedFields.length) {
        await db
          .insert(courseMetadataChangeReviews)
          .values({
            coursePageId: match.coursePageId,
            courseCandidateId: persisted.id,
            snapshotId: snapshot.id,
            changedFields,
          })
          .onConflictDoNothing();
      }
    }
    courseCount += 1;
  }
  return {
    units: input.result.organizationalUnits.length,
    programmes: input.result.programmes.length,
    courses: courseCount,
  };
}

export async function createCatalogScanRequest(input: {
  organizationId: string;
  requestedBy: string;
  force?: boolean;
}) {
  const [active] = await db
    .select()
    .from(organizationCatalogScans)
    .where(
      and(
        eq(organizationCatalogScans.organizationId, input.organizationId),
        inArray(organizationCatalogScans.status, ["queued", "running"]),
      ),
    )
    .orderBy(desc(organizationCatalogScans.requestedAt))
    .limit(1);
  if (active) return { scan: active, created: false, freshCache: false };

  const [completed] = await db
    .select()
    .from(organizationCatalogScans)
    .where(
      and(
        eq(organizationCatalogScans.organizationId, input.organizationId),
        eq(organizationCatalogScans.status, "completed"),
      ),
    )
    .orderBy(desc(organizationCatalogScans.finishedAt))
    .limit(1);
  const isFresh = Boolean(
    completed?.finishedAt && Date.now() - completed.finishedAt.getTime() < FRESH_SCAN_MS,
  );
  if (isFresh && !input.force) {
    return { scan: completed!, created: false, freshCache: true };
  }

  const scanKey = `${input.organizationId}:${new Date().toISOString()}`;
  const [created] = await db
    .insert(organizationCatalogScans)
    .values({
      organizationId: input.organizationId,
      requestedBy: input.requestedBy,
      scanKey,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return { scan: created, created: true, freshCache: false };
  const [winner] = await db
    .select()
    .from(organizationCatalogScans)
    .where(
      and(
        eq(organizationCatalogScans.organizationId, input.organizationId),
        inArray(organizationCatalogScans.status, ["queued", "running"]),
      ),
    )
    .orderBy(desc(organizationCatalogScans.requestedAt))
    .limit(1);
  if (!winner) throw new Error("catalog scan request lost its deduplication race");
  return { scan: winner, created: false, freshCache: false };
}

export async function getCatalogOverview(organizationId: string) {
  const [latestScan, counts, candidates] = await Promise.all([
    db
      .select()
      .from(organizationCatalogScans)
      .where(eq(organizationCatalogScans.organizationId, organizationId))
      .orderBy(desc(organizationCatalogScans.requestedAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        status: organizationCourseCandidates.status,
        count: sql<number>`count(*)::int`,
      })
      .from(organizationCourseCandidates)
      .where(eq(organizationCourseCandidates.organizationId, organizationId))
      .groupBy(organizationCourseCandidates.status),
    db
      .select({
        id: organizationCourseCandidates.id,
        name: organizationCourseCandidates.localDisplayName,
        canonicalName: organizationCourseCandidates.canonicalSourceName,
        code: organizationCourseCandidates.courseCode,
        academicYear: organizationCourseCandidates.academicYear,
        programme: organizationCourseCandidates.degreeProgramme,
        credits: organizationCourseCandidates.credits,
        officialUrl: organizationCourseCandidates.officialUrl,
        confidence: organizationCourseCandidates.confidence,
        status: organizationCourseCandidates.status,
        verificationMethod: organizationCourseCandidates.verificationMethod,
        evidence: organizationCourseCandidates.evidence,
        discoveredAt: organizationCourseCandidates.discoveredAt,
        communitySlug: sql<string | null>`(
          select ${coursePages.slug}
          from ${courseCandidateMatches}
          inner join ${coursePages}
            on ${coursePages.id} = ${courseCandidateMatches.coursePageId}
          where ${courseCandidateMatches.courseCandidateId} = ${organizationCourseCandidates.id}
            and ${courseCandidateMatches.status} in ('suggested', 'confirmed')
          order by ${courseCandidateMatches.score} desc
          limit 1
        )`,
      })
      .from(organizationCourseCandidates)
      .where(
        and(
          eq(organizationCourseCandidates.organizationId, organizationId),
          or(
            eq(organizationCourseCandidates.status, "confirmed"),
            eq(organizationCourseCandidates.status, "candidate"),
            eq(organizationCourseCandidates.status, "outdated"),
            eq(organizationCourseCandidates.status, "merged"),
          ),
        ),
      )
      .orderBy(
        desc(organizationCourseCandidates.status),
        desc(organizationCourseCandidates.confidence),
      )
      .limit(24),
  ]);
  return {
    latestScan,
    counts: Object.fromEntries(counts.map((row) => [row.status, row.count])) as Record<
      string,
      number
    >,
    candidates,
  };
}

export async function getCatalogSourceExecution(
  scanId: string,
  sourceId: string,
) {
  const [row] = await db
    .select({
      scanId: organizationCatalogScans.id,
      organizationId: organizationCatalogScans.organizationId,
      scanStatus: organizationCatalogScans.status,
      sourceId: organizationCatalogSources.id,
      sourceUrl: organizationCatalogSources.sourceUrl,
      sourceType: organizationCatalogSources.sourceType,
      connectorId: organizationCatalogSources.connectorId,
      connectorConfig: organizationCatalogSources.connectorConfig,
      httpEtag: organizationCatalogSources.httpEtag,
      httpLastModified: organizationCatalogSources.httpLastModified,
      contentChecksum: organizationCatalogSources.contentChecksum,
      active: organizationCatalogSources.active,
      domainApproved: organizationCatalogSources.domainApproved,
    })
    .from(organizationCatalogScans)
    .innerJoin(
      organizationCatalogSources,
      and(
        eq(
          organizationCatalogSources.organizationId,
          organizationCatalogScans.organizationId,
        ),
        eq(organizationCatalogSources.id, sourceId),
      ),
    )
    .where(eq(organizationCatalogScans.id, scanId))
    .limit(1);
  if (!row || !row.active || !row.domainApproved) {
    throw new Error("catalog source is unavailable or outside the approved boundary");
  }
  if (row.scanStatus !== "queued" && row.scanStatus !== "running") {
    throw new Error("catalog scan is not active");
  }
  return row;
}

export async function attachCatalogWorkflowRun(scanId: string, runId: string) {
  await db
    .update(organizationCatalogScans)
    .set({ workflowRunId: runId, updatedAt: new Date() })
    .where(eq(organizationCatalogScans.id, scanId));
}

export async function recordCatalogRobotsResult(
  sourceId: string,
  result: {
    status: "allowed" | "disallowed" | "unavailable" | "error";
  },
) {
  await db
    .update(organizationCatalogSources)
    .set({
      robotsStatus: result.status,
      robotsCheckedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(organizationCatalogSources.id, sourceId));
}

type CatalogSourceProgress = {
  units: number;
  programmes: number;
  courses: number;
  warnings?: string[];
};

async function recordCatalogProgress(
  scanId: string,
  sourceId: string,
  progress: CatalogSourceProgress,
) {
  const [scan] = await db
    .select({
      checkpoint: organizationCatalogScans.checkpoint,
      pagesInspected: organizationCatalogScans.pagesInspected,
      unitsFound: organizationCatalogScans.unitsFound,
      programmesFound: organizationCatalogScans.programmesFound,
      coursesFound: organizationCatalogScans.coursesFound,
      warnings: organizationCatalogScans.warnings,
    })
    .from(organizationCatalogScans)
    .where(eq(organizationCatalogScans.id, scanId))
    .limit(1);
  if (!scan) throw new Error("catalog scan not found");
  const advanced = advanceCatalogProgress(scan, sourceId, progress);
  if (!advanced.applied) return false;
  await db
    .update(organizationCatalogScans)
    .set({
      currentSourceId: sourceId,
      checkpoint: advanced.state.checkpoint,
      pagesInspected: advanced.state.pagesInspected,
      unitsFound: advanced.state.unitsFound,
      programmesFound: advanced.state.programmesFound,
      coursesFound: advanced.state.coursesFound,
      warnings: advanced.state.warnings,
      updatedAt: new Date(),
    })
    .where(eq(organizationCatalogScans.id, scanId));
  return true;
}

export async function recordCatalogSourceSuccess(input: {
  scanId: string;
  sourceId: string;
  evidence?: SourceEvidence;
  notModified?: boolean;
  progress: CatalogSourceProgress;
}) {
  const now = new Date();
  await db
    .update(organizationCatalogSources)
    .set({
      lastSuccessfulScanAt: now,
      lastFailure: null,
      ...(input.evidence
        ? {
            httpEtag: input.evidence.etag,
            httpLastModified: input.evidence.lastModified,
            contentChecksum: input.evidence.checksum,
          }
        : {}),
      updatedAt: now,
    })
    .where(eq(organizationCatalogSources.id, input.sourceId));
  return recordCatalogProgress(input.scanId, input.sourceId, input.progress);
}

export async function recordCatalogSourceFailure(input: {
  scanId: string;
  sourceId: string;
  message: string;
}) {
  const message = input.message.slice(0, 1_000);
  const now = new Date();
  await db
    .update(organizationCatalogSources)
    .set({ lastFailureAt: now, lastFailure: message, updatedAt: now })
    .where(eq(organizationCatalogSources.id, input.sourceId));
  return recordCatalogProgress(input.scanId, input.sourceId, {
    units: 0,
    programmes: 0,
    courses: 0,
    warnings: [message],
  });
}

export async function finishCatalogScan(scanId: string) {
  const [scan] = await db
    .select({
      pagesInspected: organizationCatalogScans.pagesInspected,
      warnings: organizationCatalogScans.warnings,
    })
    .from(organizationCatalogScans)
    .where(eq(organizationCatalogScans.id, scanId))
    .limit(1);
  if (!scan) throw new Error("catalog scan not found");
  const status =
    scan.pagesInspected === 0
      ? "failed"
      : scan.warnings.length
        ? "partial"
        : "completed";
  const [finished] = await db
    .update(organizationCatalogScans)
    .set({
      status,
      finishedAt: new Date(),
      currentSourceId: null,
      failureSummary:
        status === "failed"
          ? scan.warnings[0] ?? "No approved catalog source could be inspected."
          : null,
      updatedAt: new Date(),
    })
    .where(eq(organizationCatalogScans.id, scanId))
    .returning();
  return finished;
}

export async function failCatalogScan(scanId: string, message: string) {
  const [failed] = await db
    .update(organizationCatalogScans)
    .set({
      status: "failed",
      finishedAt: new Date(),
      currentSourceId: null,
      failureSummary: message.slice(0, 2_000),
      updatedAt: new Date(),
    })
    .where(eq(organizationCatalogScans.id, scanId))
    .returning();
  return failed;
}
