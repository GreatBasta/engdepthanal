import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  enrollments,
  programs,
  subjectEnrollments,
  universities,
  universityPrograms,
} from "@/lib/db/schema";
import type { OrganizationResult } from "@/lib/organizations/schema";

/**
 * The signed-in student's enrollment (uni × program × intake). One per
 * student today; returns the first if that ever changes. Null when the
 * student hasn't onboarded yet.
 */
export async function getStudentEnrollment(studentId: string) {
  const primary = await getPrimaryEnrollmentForStudent(studentId);
  if (!primary) return null;
  return {
    id: primary.id,
    studentId: primary.studentId,
    universityProgramId: primary.universityProgramId,
    intakeYear: primary.intakeYear,
    phase: primary.phase,
    isPrimary: primary.isPrimary,
    createdAt: primary.createdAt,
    updatedAt: primary.updatedAt,
  };
}

/** Authoritative study context for Home, discovery, creation and Profile. */
export async function getPrimaryEnrollmentForStudent(studentId: string) {
  const [enrollment] = await db
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      universityProgramId: enrollments.universityProgramId,
      organizationalUnitId: enrollments.organizationalUnitId,
      intakeYear: enrollments.intakeYear,
      academicContext: enrollments.academicContext,
      requestedProgrammeName: enrollments.requestedProgrammeName,
      phase: enrollments.phase,
      isPrimary: enrollments.isPrimary,
      createdAt: enrollments.createdAt,
      updatedAt: enrollments.updatedAt,
      organizationId: universities.id,
      organizationCanonicalName: universities.canonicalName,
      organizationName: universities.displayName,
      organizationFallbackName: universities.name,
      organizationAliases: universities.aliases,
      organizationAcronyms: universities.acronyms,
      organizationType: universities.organizationType,
      organizationCity: universities.city,
      organizationRegion: universities.region,
      organizationCountryCode: universities.countryCode,
      organizationCountryName: universities.countryName,
      organizationDomains: universities.domains,
      organizationWebsiteUrl: universities.websiteUrl,
      organizationRorId: universities.rorId,
      organizationExternalSource: universities.externalSource,
      organizationExternalUpdatedAt: universities.externalUpdatedAt,
      organizationVerificationStatus: universities.status,
      programId: programs.id,
      programSlug: programs.slug,
      programName: programs.name,
      localProgramName: universityPrograms.localName,
    })
    .from(enrollments)
    .innerJoin(
      universityPrograms,
      eq(enrollments.universityProgramId, universityPrograms.id),
    )
    .innerJoin(
      universities,
      eq(universityPrograms.universityId, universities.id),
    )
    .innerJoin(programs, eq(universityPrograms.programId, programs.id))
    .where(eq(enrollments.studentId, studentId))
    .orderBy(desc(enrollments.isPrimary), asc(enrollments.createdAt))
    .limit(1);
  return enrollment ?? null;
}

export function organizationResultFromPrimaryEnrollment(
  enrollment: NonNullable<
    Awaited<ReturnType<typeof getPrimaryEnrollmentForStudent>>
  >,
): OrganizationResult {
  const canonicalName =
    enrollment.organizationCanonicalName ??
    enrollment.organizationName ??
    enrollment.organizationFallbackName;
  return {
    localId: enrollment.organizationId,
    rorId: enrollment.organizationRorId,
    canonicalName,
    displayName: enrollment.organizationName ?? canonicalName,
    aliases: enrollment.organizationAliases,
    acronyms: enrollment.organizationAcronyms,
    organizationType: enrollment.organizationType ?? "education",
    city: enrollment.organizationCity,
    region: enrollment.organizationRegion,
    countryCode: enrollment.organizationCountryCode,
    countryName: enrollment.organizationCountryName,
    domains: enrollment.organizationDomains,
    websiteUrl: enrollment.organizationWebsiteUrl,
    source:
      enrollment.organizationExternalSource === "ror" &&
      enrollment.organizationRorId
        ? "ror"
        : "local",
    verified: enrollment.organizationVerificationStatus === "verified",
    externalUpdatedAt:
      enrollment.organizationExternalUpdatedAt
        ?.toISOString()
        .slice(0, 10) ?? null,
  };
}

export async function getPrimaryOrganizationForStudent(studentId: string) {
  const enrollment = await getPrimaryEnrollmentForStudent(studentId);
  if (!enrollment) return null;
  return {
    id: enrollment.organizationId,
    name:
      enrollment.organizationName ?? enrollment.organizationFallbackName,
    city: enrollment.organizationCity,
    region: enrollment.organizationRegion,
    countryCode: enrollment.organizationCountryCode,
    countryName: enrollment.organizationCountryName,
    domains: enrollment.organizationDomains,
    websiteUrl: enrollment.organizationWebsiteUrl,
    rorId: enrollment.organizationRorId,
  };
}

/**
 * The per-subject enrollment row, creating it (status `in_progress`) on
 * first access. This is what tracking and — once finished — the coverage
 * survey hang off. Idempotent under the (enrollment, subject) unique index.
 */
export async function getOrCreateSubjectEnrollment(
  enrollmentId: string,
  subjectId: string,
) {
  const existing = await findSubjectEnrollment(enrollmentId, subjectId);
  if (existing) return existing;

  await db
    .insert(subjectEnrollments)
    .values({ enrollmentId, subjectId, status: "in_progress" })
    .onConflictDoNothing();

  // Re-read rather than trust returning(): a concurrent insert may have won.
  const row = await findSubjectEnrollment(enrollmentId, subjectId);
  if (!row) throw new Error("failed to create subject enrollment");
  return row;
}

async function findSubjectEnrollment(enrollmentId: string, subjectId: string) {
  const [row] = await db
    .select()
    .from(subjectEnrollments)
    .where(
      and(
        eq(subjectEnrollments.enrollmentId, enrollmentId),
        eq(subjectEnrollments.subjectId, subjectId),
      ),
    )
    .limit(1);
  return row ?? null;
}
