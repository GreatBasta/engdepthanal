import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { courseMembers, coursePages } from "@/lib/db/schema";

import {
  canAccessAttachment,
  canEditCourse,
  canManageMembers,
  canModerateCourse,
  canPostToCourse,
  canViewCourse,
  type CoursePermissionContext,
} from "./permission-rules";

export {
  canAccessAttachment,
  canEditCourse,
  canManageMembers,
  canModerateCourse,
  canPostToCourse,
  canViewCourse,
  type CourseAttendance,
  type CourseMemberRole,
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
    })
    .from(coursePages)
    .where(eq(coursePages.id, coursePageId))
    .limit(1);
  if (!course) return null;

  let membership: CoursePermissionContext["membership"] = null;
  if (studentId) {
    [membership] = await db
      .select({
        role: courseMembers.role,
        attendance: courseMembers.attendance,
      })
      .from(courseMembers)
      .where(
        and(
          eq(courseMembers.coursePageId, coursePageId),
          eq(courseMembers.studentId, studentId),
        ),
      )
      .limit(1);
    membership ??= null;
  }

  return {
    coursePageId: course.id,
    visibility: course.visibility,
    archived: course.archivedAt !== null,
    studentId,
    membership,
  };
}
