import { and, desc, eq, or } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { courseDuplicateKey } from "@/lib/courses/core";
import {
  courseCandidateCorrections,
  courseCandidateMatches,
  courseMembers,
  courseMetadataChangeReviews,
  coursePages,
  officialCourseOfferings,
  organizationCatalogDomains,
  organizationCatalogScans,
  organizationCatalogSources,
  organizationCourseCandidates,
  universities,
  universityPrograms,
} from "@/lib/db/schema";

import {
  getOrganizationCatalogContext,
  persistDiscoveredCatalogSources,
} from "./repository";
import { assertTrustedCatalogUrl, normalizeCatalogDomain } from "./policy";
import type { CatalogSourceCandidate } from "./types";

async function materializeOfficialOffering(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  candidate: typeof organizationCourseCandidates.$inferSelect,
) {
  const existingRows = await tx
    .select({ id: officialCourseOfferings.id })
    .from(officialCourseOfferings)
    .where(
      or(
        eq(officialCourseOfferings.courseCandidateId, candidate.id),
        and(
          eq(officialCourseOfferings.organizationId, candidate.organizationId),
          eq(officialCourseOfferings.officialUrl, candidate.officialUrl),
          candidate.academicYear
            ? eq(officialCourseOfferings.academicYear, candidate.academicYear)
            : eq(officialCourseOfferings.courseCandidateId, candidate.id),
        ),
      ),
    )
    .limit(1);
  const values = {
    courseCandidateId: candidate.id,
    organizationId: candidate.organizationId,
    externalSourceId: candidate.externalSourceId,
    courseCode: candidate.courseCode,
    canonicalSourceName: candidate.canonicalSourceName,
    localDisplayName: candidate.localDisplayName,
    description: candidate.description,
    credits: candidate.credits,
    languageCodes: candidate.languageCodes,
    academicYear: candidate.academicYear,
    semester: candidate.semester,
    professorName: candidate.professorName,
    campus: candidate.campus,
    officialUrl: candidate.officialUrl,
    sourceType: candidate.sourceType,
    confidence: candidate.confidence,
    verificationStatus: "verified" as const,
    offeringStatus: "active" as const,
    sourceUpdatedAt: candidate.sourceUpdatedAt,
    updatedAt: new Date(),
  };
  const existing = existingRows[0];
  if (existing) {
    const [updated] = await tx
      .update(officialCourseOfferings)
      .set(values)
      .where(eq(officialCourseOfferings.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await tx
    .insert(officialCourseOfferings)
    .values(values)
    .returning();
  return created;
}

export async function confirmCatalogCandidate(input: {
  candidateId: string;
  reviewerId: string;
  method: "student" | "admin";
}) {
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select()
      .from(organizationCourseCandidates)
      .where(eq(organizationCourseCandidates.id, input.candidateId))
      .limit(1);
    if (!candidate || candidate.status === "rejected") {
      throw new Error("catalog candidate is unavailable");
    }
    const offering = await materializeOfficialOffering(tx, candidate);
    await tx
      .update(organizationCourseCandidates)
      .set({
        status: "confirmed",
        reviewedBy: input.reviewerId,
        reviewedAt: new Date(),
        verificationMethod: input.method,
      })
      .where(eq(organizationCourseCandidates.id, candidate.id));
    return { candidateId: candidate.id, officialOfferingId: offering.id };
  });
}

export async function markCatalogCandidateOutdated(input: {
  candidateId: string;
  reviewerId: string;
}) {
  const [updated] = await db
    .update(organizationCourseCandidates)
    .set({
      status: "outdated",
      reviewedBy: input.reviewerId,
      reviewedAt: new Date(),
      verificationMethod: "student_report",
    })
    .where(eq(organizationCourseCandidates.id, input.candidateId))
    .returning({ id: organizationCourseCandidates.id });
  if (!updated) throw new Error("catalog candidate is unavailable");
  return updated;
}

export async function rejectCatalogCandidate(input: {
  candidateId: string;
  reviewerId: string;
}) {
  const [updated] = await db
    .update(organizationCourseCandidates)
    .set({
      status: "rejected",
      reviewedBy: input.reviewerId,
      reviewedAt: new Date(),
      verificationMethod: "admin",
    })
    .where(eq(organizationCourseCandidates.id, input.candidateId))
    .returning({ id: organizationCourseCandidates.id });
  if (!updated) throw new Error("catalog candidate is unavailable");
  return updated;
}

export async function proposeCatalogCorrection(input: {
  candidateId: string;
  studentId: string;
  note: string;
}) {
  const note = input.note.trim();
  if (note.length < 4 || note.length > 1_000) {
    throw new Error("correction note must be between 4 and 1000 characters");
  }
  const [created] = await db
    .insert(courseCandidateCorrections)
    .values({
      courseCandidateId: input.candidateId,
      proposedBy: input.studentId,
      note,
    })
    .returning({ id: courseCandidateCorrections.id });
  return created;
}

export async function mergeCatalogCandidateWithCourse(input: {
  candidateId: string;
  coursePageId: string;
  reviewerId: string;
}) {
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select()
      .from(organizationCourseCandidates)
      .where(eq(organizationCourseCandidates.id, input.candidateId))
      .limit(1);
    const [course] = await tx
      .select({
        id: coursePages.id,
        officialOfferingId: coursePages.officialOfferingId,
        organizationId: universities.id,
      })
      .from(coursePages)
      .innerJoin(
        universityPrograms,
        eq(coursePages.universityProgramId, universityPrograms.id),
      )
      .innerJoin(universities, eq(universityPrograms.universityId, universities.id))
      .where(eq(coursePages.id, input.coursePageId))
      .limit(1);
    if (!candidate || !course || candidate.organizationId !== course.organizationId) {
      throw new Error("candidate and course must belong to the same organization");
    }
    const offering = await materializeOfficialOffering(tx, candidate);
    if (
      course.officialOfferingId &&
      course.officialOfferingId !== offering.id
    ) {
      throw new Error("course is already linked to another official offering");
    }
    await tx
      .insert(courseCandidateMatches)
      .values({
        courseCandidateId: candidate.id,
        coursePageId: course.id,
        score: "1",
        reasons: ["confirmed by reviewer"],
        status: "confirmed",
        reviewedBy: input.reviewerId,
        reviewedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          courseCandidateMatches.courseCandidateId,
          courseCandidateMatches.coursePageId,
        ],
        set: {
          status: "confirmed",
          reviewedBy: input.reviewerId,
          reviewedAt: new Date(),
        },
      });
    await tx
      .update(coursePages)
      .set({ officialOfferingId: offering.id, updatedAt: new Date() })
      .where(eq(coursePages.id, course.id));
    await tx
      .update(organizationCourseCandidates)
      .set({
        status: "merged",
        reviewedBy: input.reviewerId,
        reviewedAt: new Date(),
        verificationMethod: "admin_match",
      })
      .where(eq(organizationCourseCandidates.id, candidate.id));
    return { coursePageId: course.id, officialOfferingId: offering.id };
  });
}

export async function reviewCandidateCorrection(input: {
  correctionId: string;
  reviewerId: string;
  accepted: boolean;
}) {
  const [updated] = await db
    .update(courseCandidateCorrections)
    .set({
      status: input.accepted ? "accepted" : "rejected",
      reviewedBy: input.reviewerId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(courseCandidateCorrections.id, input.correctionId))
    .returning({ id: courseCandidateCorrections.id });
  if (!updated) throw new Error("correction is unavailable");
  return updated;
}

export async function approveCatalogDomain(input: {
  organizationId: string;
  domain: string;
  evidenceUrl: string;
  reviewerId: string;
}) {
  const context = await getOrganizationCatalogContext(input.organizationId);
  assertTrustedCatalogUrl(input.evidenceUrl, context.verifiedDomains);
  const domain = normalizeCatalogDomain(input.domain);
  const [row] = await db
    .insert(organizationCatalogDomains)
    .values({
      organizationId: input.organizationId,
      domain,
      boundarySource: "admin_official_link",
      approved: true,
      approvedBy: input.reviewerId,
      approvedAt: new Date(),
      evidenceUrl: input.evidenceUrl,
    })
    .onConflictDoUpdate({
      target: [
        organizationCatalogDomains.organizationId,
        organizationCatalogDomains.domain,
      ],
      set: {
        approved: true,
        approvedBy: input.reviewerId,
        approvedAt: new Date(),
        evidenceUrl: input.evidenceUrl,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function addApprovedCatalogSource(input: {
  organizationId: string;
  source: CatalogSourceCandidate;
}) {
  const context = await getOrganizationCatalogContext(input.organizationId);
  const ids = await persistDiscoveredCatalogSources(context, [input.source]);
  return ids[0] ?? null;
}

export async function setCatalogConnectorActive(input: {
  organizationId: string;
  connectorId: string;
  active: boolean;
}) {
  return db
    .update(organizationCatalogSources)
    .set({ active: input.active, updatedAt: new Date() })
    .where(
      and(
        eq(organizationCatalogSources.organizationId, input.organizationId),
        eq(organizationCatalogSources.connectorId, input.connectorId),
      ),
    )
    .returning({ id: organizationCatalogSources.id });
}

export async function getAdminCatalogData() {
  const [organizations, domains, sources, scans, candidates, corrections, matches] = await Promise.all([
    db
      .select({ id: universities.id, name: universities.name })
      .from(universities)
      .where(eq(universities.status, "verified"))
      .orderBy(universities.name)
      .limit(500),
    db
      .select({
        id: organizationCatalogDomains.id,
        organizationId: organizationCatalogDomains.organizationId,
        organizationName: universities.name,
        domain: organizationCatalogDomains.domain,
        boundarySource: organizationCatalogDomains.boundarySource,
        approved: organizationCatalogDomains.approved,
        evidenceUrl: organizationCatalogDomains.evidenceUrl,
      })
      .from(organizationCatalogDomains)
      .innerJoin(
        universities,
        eq(organizationCatalogDomains.organizationId, universities.id),
      )
      .orderBy(universities.name, organizationCatalogDomains.domain)
      .limit(100),
    db
      .select({
        id: organizationCatalogSources.id,
        organizationId: organizationCatalogSources.organizationId,
        organizationName: universities.name,
        sourceUrl: organizationCatalogSources.sourceUrl,
        sourceType: organizationCatalogSources.sourceType,
        connectorId: organizationCatalogSources.connectorId,
        robotsStatus: organizationCatalogSources.robotsStatus,
        active: organizationCatalogSources.active,
        lastSuccess: organizationCatalogSources.lastSuccessfulScanAt,
        lastFailure: organizationCatalogSources.lastFailure,
      })
      .from(organizationCatalogSources)
      .innerJoin(
        universities,
        eq(organizationCatalogSources.organizationId, universities.id),
      )
      .orderBy(universities.name, organizationCatalogSources.sourceUrl)
      .limit(150),
    db
      .select({
        id: organizationCatalogScans.id,
        organizationId: organizationCatalogScans.organizationId,
        organizationName: universities.name,
        status: organizationCatalogScans.status,
        requestedAt: organizationCatalogScans.requestedAt,
        finishedAt: organizationCatalogScans.finishedAt,
        pages: organizationCatalogScans.pagesInspected,
        courses: organizationCatalogScans.coursesFound,
        warnings: organizationCatalogScans.warnings,
        failure: organizationCatalogScans.failureSummary,
      })
      .from(organizationCatalogScans)
      .innerJoin(
        universities,
        eq(organizationCatalogScans.organizationId, universities.id),
      )
      .orderBy(desc(organizationCatalogScans.requestedAt))
      .limit(50),
    db
      .select({
        id: organizationCourseCandidates.id,
        organizationName: universities.name,
        name: organizationCourseCandidates.canonicalSourceName,
        code: organizationCourseCandidates.courseCode,
        academicYear: organizationCourseCandidates.academicYear,
        status: organizationCourseCandidates.status,
        confidence: organizationCourseCandidates.confidence,
        officialUrl: organizationCourseCandidates.officialUrl,
        evidence: organizationCourseCandidates.evidence,
      })
      .from(organizationCourseCandidates)
      .innerJoin(
        universities,
        eq(organizationCourseCandidates.organizationId, universities.id),
      )
      .orderBy(
        desc(organizationCourseCandidates.lastDiscoveredAt),
        organizationCourseCandidates.canonicalSourceName,
      )
      .limit(100),
    db
      .select({
        id: courseCandidateCorrections.id,
        candidateName: organizationCourseCandidates.canonicalSourceName,
        note: courseCandidateCorrections.note,
        status: courseCandidateCorrections.status,
        createdAt: courseCandidateCorrections.createdAt,
      })
      .from(courseCandidateCorrections)
      .innerJoin(
        organizationCourseCandidates,
        eq(
          courseCandidateCorrections.courseCandidateId,
          organizationCourseCandidates.id,
        ),
      )
      .where(eq(courseCandidateCorrections.status, "pending"))
      .orderBy(desc(courseCandidateCorrections.createdAt))
      .limit(50),
    db
      .select({
        candidateId: courseCandidateMatches.courseCandidateId,
        coursePageId: courseCandidateMatches.coursePageId,
        courseName: coursePages.localName,
        courseSlug: coursePages.slug,
        score: courseCandidateMatches.score,
        reasons: courseCandidateMatches.reasons,
      })
      .from(courseCandidateMatches)
      .innerJoin(coursePages, eq(courseCandidateMatches.coursePageId, coursePages.id))
      .where(eq(courseCandidateMatches.status, "suggested"))
      .orderBy(desc(courseCandidateMatches.score))
      .limit(100),
  ]);
  return { organizations, domains, sources, scans, candidates, corrections, matches };
}

export async function getPendingCourseMetadataReviews(
  coursePageId: string,
  studentId: string,
) {
  const [membership] = await db
    .select({ role: courseMembers.role })
    .from(courseMembers)
    .where(
      and(
        eq(courseMembers.coursePageId, coursePageId),
        eq(courseMembers.studentId, studentId),
      ),
    )
    .limit(1);
  if (membership?.role !== "owner") return [];
  return db
    .select({
      id: courseMetadataChangeReviews.id,
      candidateName: organizationCourseCandidates.canonicalSourceName,
      sourceUrl: organizationCourseCandidates.officialUrl,
      changedFields: courseMetadataChangeReviews.changedFields,
      createdAt: courseMetadataChangeReviews.createdAt,
    })
    .from(courseMetadataChangeReviews)
    .innerJoin(
      organizationCourseCandidates,
      eq(
        courseMetadataChangeReviews.courseCandidateId,
        organizationCourseCandidates.id,
      ),
    )
    .where(
      and(
        eq(courseMetadataChangeReviews.coursePageId, coursePageId),
        eq(courseMetadataChangeReviews.status, "pending"),
      ),
    )
    .orderBy(desc(courseMetadataChangeReviews.createdAt));
}

export async function getCatalogCandidateForImport(candidateId: string) {
  const [row] = await db
    .select({
      candidateId: organizationCourseCandidates.id,
      organizationId: organizationCourseCandidates.organizationId,
      status: organizationCourseCandidates.status,
      officialOfferingId: officialCourseOfferings.id,
      name: organizationCourseCandidates.localDisplayName,
      canonicalName: organizationCourseCandidates.canonicalSourceName,
      courseCode: organizationCourseCandidates.courseCode,
      description: organizationCourseCandidates.description,
      credits: organizationCourseCandidates.credits,
      degreeProgramme: organizationCourseCandidates.degreeProgramme,
      academicYear: organizationCourseCandidates.academicYear,
      semester: organizationCourseCandidates.semester,
      professorName: organizationCourseCandidates.professorName,
      officialUrl: organizationCourseCandidates.officialUrl,
    })
    .from(organizationCourseCandidates)
    .innerJoin(
      officialCourseOfferings,
      eq(
        officialCourseOfferings.courseCandidateId,
        organizationCourseCandidates.id,
      ),
    )
    .where(
      and(
        eq(organizationCourseCandidates.id, candidateId),
        eq(organizationCourseCandidates.status, "confirmed"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function reviewOfficialMetadataChange(input: {
  reviewId: string;
  reviewerId: string;
  accepted: boolean;
}) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        reviewId: courseMetadataChangeReviews.id,
        reviewStatus: courseMetadataChangeReviews.status,
        course: coursePages,
        candidate: organizationCourseCandidates,
        memberRole: courseMembers.role,
      })
      .from(courseMetadataChangeReviews)
      .innerJoin(
        coursePages,
        eq(courseMetadataChangeReviews.coursePageId, coursePages.id),
      )
      .innerJoin(
        organizationCourseCandidates,
        eq(
          courseMetadataChangeReviews.courseCandidateId,
          organizationCourseCandidates.id,
        ),
      )
      .leftJoin(
        courseMembers,
        and(
          eq(courseMembers.coursePageId, coursePages.id),
          eq(courseMembers.studentId, input.reviewerId),
        ),
      )
      .where(eq(courseMetadataChangeReviews.id, input.reviewId))
      .limit(1);
    if (!row || row.reviewStatus !== "pending" || row.memberRole !== "owner") {
      throw new Error("official metadata review is unavailable");
    }

    if (input.accepted) {
      const offering = await materializeOfficialOffering(tx, row.candidate);
      const semesterMatch = row.candidate.semester?.match(/\b(1[0-2]|[1-9])\b/);
      const semester = semesterMatch ? Number(semesterMatch[1]) : row.course.semester;
      const metadata = {
        localName:
          row.candidate.localDisplayName ?? row.candidate.canonicalSourceName,
        courseCode: row.candidate.courseCode,
        professorName: row.candidate.professorName,
        academicYear: row.candidate.academicYear ?? row.course.academicYear,
        semester,
        description: row.candidate.description ?? row.course.description,
      };
      await tx
        .update(coursePages)
        .set({
          ...metadata,
          officialOfferingId: offering.id,
          duplicateKey: courseDuplicateKey(metadata),
          updatedAt: new Date(),
        })
        .where(eq(coursePages.id, row.course.id));
      await tx
        .update(organizationCourseCandidates)
        .set({
          status: "merged",
          reviewedBy: input.reviewerId,
          reviewedAt: new Date(),
          verificationMethod: "course_owner",
        })
        .where(eq(organizationCourseCandidates.id, row.candidate.id));
    }

    const [review] = await tx
      .update(courseMetadataChangeReviews)
      .set({
        status: input.accepted ? "accepted" : "rejected",
        reviewedBy: input.reviewerId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(courseMetadataChangeReviews.id, row.reviewId))
      .returning();
    return review;
  });
}
