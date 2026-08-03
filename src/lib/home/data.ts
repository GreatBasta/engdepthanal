import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { effectiveCourseRole } from "@/lib/courses/permissions";
import { db } from "@/lib/db/client";
import {
  courseCoownershipRequests,
  courseMembers,
  coursePages,
  courseResources,
  examExperiences,
  programs,
  students,
  universities,
  universityPrograms,
} from "@/lib/db/schema";

export async function getAuthenticatedHomeData(
  studentId: string,
  organizationId: string,
) {
  const [memberRows, recentCourses, recentResources, recentExamActivity, pendingRequests] =
    await Promise.all([
      db
        .select({
          slug: coursePages.slug,
          name: coursePages.localName,
          academicYear: coursePages.academicYear,
          updatedAt: coursePages.updatedAt,
          role: courseMembers.role,
          organizationId: universities.id,
          organizationName: universities.displayName,
          organizationFallbackName: universities.name,
          programName: programs.name,
        })
        .from(courseMembers)
        .innerJoin(coursePages, eq(courseMembers.coursePageId, coursePages.id))
        .innerJoin(
          universityPrograms,
          eq(coursePages.universityProgramId, universityPrograms.id),
        )
        .innerJoin(
          universities,
          eq(universityPrograms.universityId, universities.id),
        )
        .innerJoin(programs, eq(universityPrograms.programId, programs.id))
        .where(
          and(
            eq(courseMembers.studentId, studentId),
            isNull(coursePages.archivedAt),
          ),
        )
        .orderBy(desc(coursePages.updatedAt))
        .limit(12),
      db
        .select({
          slug: coursePages.slug,
          name: coursePages.localName,
          academicYear: coursePages.academicYear,
          updatedAt: coursePages.updatedAt,
          programName: programs.name,
        })
        .from(coursePages)
        .innerJoin(
          universityPrograms,
          eq(coursePages.universityProgramId, universityPrograms.id),
        )
        .innerJoin(programs, eq(universityPrograms.programId, programs.id))
        .where(
          and(
            eq(universityPrograms.universityId, organizationId),
            eq(coursePages.visibility, "public"),
            isNull(coursePages.archivedAt),
          ),
        )
        .orderBy(desc(coursePages.updatedAt))
        .limit(6),
      db
        .select({
          id: courseResources.id,
          title: courseResources.title,
          type: courseResources.type,
          createdAt: courseResources.createdAt,
          courseSlug: coursePages.slug,
          courseName: coursePages.localName,
        })
        .from(courseResources)
        .innerJoin(
          coursePages,
          eq(courseResources.coursePageId, coursePages.id),
        )
        .innerJoin(
          universityPrograms,
          eq(coursePages.universityProgramId, universityPrograms.id),
        )
        .where(
          and(
            eq(universityPrograms.universityId, organizationId),
            eq(coursePages.visibility, "public"),
            isNull(coursePages.archivedAt),
            isNull(courseResources.hiddenAt),
            isNull(courseResources.deletedAt),
          ),
        )
        .orderBy(desc(courseResources.createdAt))
        .limit(5),
      db
        .select({
          id: examExperiences.id,
          title: examExperiences.title,
          createdAt: examExperiences.createdAt,
          courseSlug: coursePages.slug,
          courseName: coursePages.localName,
        })
        .from(examExperiences)
        .innerJoin(
          coursePages,
          eq(examExperiences.coursePageId, coursePages.id),
        )
        .innerJoin(
          universityPrograms,
          eq(coursePages.universityProgramId, universityPrograms.id),
        )
        .where(
          and(
            eq(universityPrograms.universityId, organizationId),
            eq(coursePages.visibility, "public"),
            isNull(coursePages.archivedAt),
            isNull(examExperiences.hiddenAt),
          ),
        )
        .orderBy(desc(examExperiences.createdAt))
        .limit(5),
      db
        .select({
          id: courseCoownershipRequests.id,
          requestedAt: courseCoownershipRequests.requestedAt,
          requesterName: students.displayName,
          courseSlug: coursePages.slug,
          courseName: coursePages.localName,
        })
        .from(courseCoownershipRequests)
        .innerJoin(
          coursePages,
          eq(courseCoownershipRequests.coursePageId, coursePages.id),
        )
        .innerJoin(
          courseMembers,
          and(
            eq(courseMembers.coursePageId, coursePages.id),
            eq(courseMembers.studentId, studentId),
            eq(courseMembers.role, "owner"),
          ),
        )
        .innerJoin(
          students,
          eq(courseCoownershipRequests.requesterId, students.id),
        )
        .where(eq(courseCoownershipRequests.status, "pending"))
        .orderBy(desc(courseCoownershipRequests.requestedAt))
        .limit(8),
    ]);

  const memberCourses = memberRows.map((course) => ({
    ...course,
    organizationName:
      course.organizationName ?? course.organizationFallbackName,
    role: effectiveCourseRole(course.role),
  }));

  return {
    owned: memberCourses.filter((course) => course.role === "owner").slice(0, 4),
    coowned: memberCourses
      .filter((course) => course.role === "coowner")
      .slice(0, 4),
    visiting: memberCourses
      .filter((course) => course.role === "visitor")
      .slice(0, 4),
    recentCourses,
    recentResources,
    recentExamActivity,
    pendingRequests,
  };
}
