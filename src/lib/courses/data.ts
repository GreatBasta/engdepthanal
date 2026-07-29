import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  courseCurriculumVersions,
  courseMembers,
  coursePages,
  coursePageTemplates,
  curriculumTemplates,
  programs,
  students,
  universities,
  universityPrograms,
} from "@/lib/db/schema";

import {
  canEditCourse,
  canManageMembers,
  canModerateCourse,
  canPostToCourse,
  canViewCourse,
  loadCoursePermissionContext,
} from "./permissions";

export async function getCourseBySlugForViewer(
  slug: string,
  studentId: string | null,
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
    })
    .from(coursePages)
    .innerJoin(
      universityPrograms,
      eq(coursePages.universityProgramId, universityPrograms.id),
    )
    .innerJoin(universities, eq(universityPrograms.universityId, universities.id))
    .innerJoin(programs, eq(universityPrograms.programId, programs.id))
    .innerJoin(students, eq(coursePages.createdBy, students.id))
    .where(and(eq(coursePages.slug, slug), isNull(coursePages.archivedAt)))
    .limit(1);
  if (!course) return null;

  const context = await loadCoursePermissionContext(course.id, studentId);
  if (!context || !canViewCourse(context)) return null;

  const [templates, memberRows, versions] = await Promise.all([
    db
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
      .orderBy(asc(coursePageTemplates.position)),
    db
      .select({
        studentId: courseMembers.studentId,
        role: courseMembers.role,
        attendance: courseMembers.attendance,
        name: students.displayName,
      })
      .from(courseMembers)
      .innerJoin(students, eq(courseMembers.studentId, students.id))
      .where(eq(courseMembers.coursePageId, course.id))
      .orderBy(asc(courseMembers.joinedAt)),
    db
      .select({
        id: courseCurriculumVersions.id,
        version: courseCurriculumVersions.version,
        status: courseCurriculumVersions.status,
        updatedAt: courseCurriculumVersions.updatedAt,
        publishedAt: courseCurriculumVersions.publishedAt,
      })
      .from(courseCurriculumVersions)
      .where(eq(courseCurriculumVersions.coursePageId, course.id))
      .orderBy(asc(courseCurriculumVersions.version)),
  ]);

  return {
    course,
    templates,
    members: memberRows,
    versions,
    permissions: {
      canEdit: canEditCourse(context),
      canManageMembers: canManageMembers(context),
      canPost: canPostToCourse(context),
      canModerate: canModerateCourse(context),
      role: context.membership?.role ?? null,
      attendance: context.membership?.attendance ?? null,
    },
  };
}

