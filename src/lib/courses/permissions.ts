import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { courseMembers, coursePages } from "@/lib/db/schema";

import {
  canAccessAttachment,
  canContribute,
  canEditCourse,
  canEditCurriculum,
  canDeleteCourse,
  canManageCoownershipRequests,
  canManageCourseSettings,
  canManageMembers,
  canModerateCourse,
  canPostToCourse,
  canViewCourse,
  effectiveCourseRole,
  isCourseCoowner,
  isCourseOwner,
  isCourseVisitor,
  type CoursePermissionContext,
} from "./permission-rules";

export {
  canAccessAttachment,
  canContribute,
  canEditCourse,
  canEditCurriculum,
  canDeleteCourse,
  canManageCoownershipRequests,
  canManageCourseSettings,
  canManageMembers,
  canModerateCourse,
  canPostToCourse,
  canViewCourse,
  effectiveCourseRole,
  isCourseCoowner,
  isCourseOwner,
  isCourseVisitor,
  type CourseAttendance,
  type CourseMemberRole,
  type EffectiveCourseRole,
  type CoursePermissionContext,
  type CourseVisibility,
} from "./permission-rules";

export async function loadCoursePermissionContext(
  coursePageId: string,
  studentId: string | null,
): Promise<CoursePermissionContext | null> {
  const [course] = await db
    .select({
      id: coursePages.id,
      visibility: coursePages.visibility,
      archivedAt: coursePages.archivedAt,
      role: courseMembers.role,
      attendance: courseMembers.attendance,
    })
    .from(coursePages)
    .leftJoin(
      courseMembers,
      studentId
        ? and(
            eq(courseMembers.coursePageId, coursePages.id),
            eq(courseMembers.studentId, studentId),
          )
        : sql`false`,
    )
    .where(eq(coursePages.id, coursePageId))
    .limit(1);
  if (!course) return null;

  return {
    coursePageId: course.id,
    visibility: course.visibility,
    archived: course.archivedAt !== null,
    studentId,
    membership: course.role
      ? {
          role: course.role,
          attendance: course.attendance ?? "not_attended",
        }
      : null,
  };
}
