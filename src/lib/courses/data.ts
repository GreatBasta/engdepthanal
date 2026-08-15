import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  courseCurriculumVersions,
  courseMembers,
  coursePages,
  coursePageTemplates,
  curriculumTemplates,
  officialCourseOfferings,
  programs,
  students,
  universities,
  universityPrograms,
} from "@/lib/db/schema";

import {
  canContribute,
  canEditCourse,
  canManageCoownershipRequests,
  canManageCourseSettings,
  canManageMembers,
  canModerateCourse,
  canPostToCourse,
  canViewCourse,
  effectiveCourseRole,
  type CoursePermissionContext,
} from "./permissions";

export interface CourseDetailIncludes {
  templates?: boolean;
  members?: boolean;
  versions?: boolean;
}

export async function getCourseBySlugForViewer(
  slug: string,
  studentId: string | null,
  include: CourseDetailIncludes = {},
) {
  const [course] = await db
    .select({
      id: coursePages.id,
      slug: coursePages.slug,
      localName: coursePages.localName,
      courseCode: coursePages.courseCode,
      professorName: coursePages.professorName,
      academicYear: coursePages.academicYear,
      cohortYear: coursePages.cohortYear,
      semester: coursePages.semester,
      description: coursePages.description,
      visibility: coursePages.visibility,
      createdAt: coursePages.createdAt,
      updatedAt: coursePages.updatedAt,
      universityProgramId: coursePages.universityProgramId,
      universityName: universities.name,
      universityCity: universities.city,
      countryCode: universities.countryCode,
      programName: programs.name,
      creatorName: students.displayName,
      officialSourceUrl: officialCourseOfferings.officialUrl,
      officialSourceName: officialCourseOfferings.canonicalSourceName,
      officialCredits: officialCourseOfferings.credits,
      viewerRole: courseMembers.role,
      viewerAttendance: courseMembers.attendance,
    })
    .from(coursePages)
    .innerJoin(
      universityPrograms,
      eq(coursePages.universityProgramId, universityPrograms.id),
    )
    .innerJoin(universities, eq(universityPrograms.universityId, universities.id))
    .innerJoin(programs, eq(universityPrograms.programId, programs.id))
    .innerJoin(students, eq(coursePages.createdBy, students.id))
    .leftJoin(
      officialCourseOfferings,
      eq(coursePages.officialOfferingId, officialCourseOfferings.id),
    )
    .leftJoin(
      courseMembers,
      studentId
        ? and(
            eq(courseMembers.coursePageId, coursePages.id),
            eq(courseMembers.studentId, studentId),
          )
        : sql`false`,
    )
    .where(and(eq(coursePages.slug, slug), isNull(coursePages.archivedAt)))
    .limit(1);
  if (!course) return null;

  const context: CoursePermissionContext = {
    coursePageId: course.id,
    visibility: course.visibility,
    archived: false,
    studentId,
    membership: course.viewerRole
      ? {
          role: course.viewerRole,
          attendance: course.viewerAttendance ?? "not_attended",
        }
      : null,
  };
  if (!canViewCourse(context)) return null;

  const [templates, memberRows, versions] = await Promise.all([
    include.templates
      ? db
          .select({
            id: curriculumTemplates.id,
            key: curriculumTemplates.templateKey,
            version: curriculumTemplates.version,
            name: curriculumTemplates.name,
            position: coursePageTemplates.position,
          })
          .from(coursePageTemplates)
          .innerJoin(
            curriculumTemplates,
            eq(coursePageTemplates.templateId, curriculumTemplates.id),
          )
          .where(eq(coursePageTemplates.coursePageId, course.id))
          .orderBy(asc(coursePageTemplates.position))
      : Promise.resolve([]),
    include.members
      ? db
          .select({
            studentId: courseMembers.studentId,
            role: courseMembers.role,
            attendance: courseMembers.attendance,
            name: students.displayName,
          })
          .from(courseMembers)
          .innerJoin(students, eq(courseMembers.studentId, students.id))
          .where(eq(courseMembers.coursePageId, course.id))
          .orderBy(asc(courseMembers.joinedAt))
      : Promise.resolve([]),
    include.versions
      ? db
          .select({
            id: courseCurriculumVersions.id,
            version: courseCurriculumVersions.version,
            status: courseCurriculumVersions.status,
            updatedAt: courseCurriculumVersions.updatedAt,
            publishedAt: courseCurriculumVersions.publishedAt,
          })
          .from(courseCurriculumVersions)
          .where(eq(courseCurriculumVersions.coursePageId, course.id))
          .orderBy(asc(courseCurriculumVersions.version))
      : Promise.resolve([]),
  ]);

  return {
    course: {
      id: course.id,
      slug: course.slug,
      localName: course.localName,
      courseCode: course.courseCode,
      professorName: course.professorName,
      academicYear: course.academicYear,
      cohortYear: course.cohortYear,
      semester: course.semester,
      description: course.description,
      visibility: course.visibility,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      universityProgramId: course.universityProgramId,
      universityName: course.universityName,
      universityCity: course.universityCity,
      countryCode: course.countryCode,
      programName: course.programName,
      creatorName: course.creatorName,
      officialSourceUrl: course.officialSourceUrl,
      officialSourceName: course.officialSourceName,
      officialCredits: course.officialCredits,
    },
    templates,
    members: memberRows,
    versions,
    permissions: {
      canEdit: canEditCourse(context),
      canContribute: canContribute(context),
      canManageCourseSettings: canManageCourseSettings(context),
      canManageCoownershipRequests: canManageCoownershipRequests(context),
      canManageMembers: canManageMembers(context),
      canPost: canPostToCourse(context),
      canModerate: canModerateCourse(context),
      role: effectiveCourseRole(context.membership?.role),
      attendance: context.membership?.attendance ?? null,
    },
  };
}
