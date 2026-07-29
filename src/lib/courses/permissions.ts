import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { courseMembers, coursePages } from "@/lib/db/schema";

export type CourseVisibility = typeof coursePages.$inferSelect.visibility;
export type CourseMemberRole = typeof courseMembers.$inferSelect.role;
export type CourseAttendance = typeof courseMembers.$inferSelect.attendance;

export interface CoursePermissionContext {
  coursePageId: string;
  visibility: CourseVisibility;
  archived: boolean;
  studentId: string | null;
  membership: {
    role: CourseMemberRole;
    attendance: CourseAttendance;
  } | null;
}

const EDIT_ROLES = new Set<CourseMemberRole>(["owner", "editor"]);
const POST_ROLES = new Set<CourseMemberRole>([
  "owner",
  "editor",
  "contributor",
]);

export function canViewCourse(context: CoursePermissionContext): boolean {
  if (context.archived) return false;
  if (context.visibility === "public" || context.visibility === "unlisted") {
    return true;
  }
  return context.membership !== null;
}

export function canEditCourse(context: CoursePermissionContext): boolean {
  return (
    canViewCourse(context) &&
    context.membership !== null &&
    EDIT_ROLES.has(context.membership.role)
  );
}

export function canManageMembers(context: CoursePermissionContext): boolean {
  return (
    canViewCourse(context) &&
    context.membership?.role === "owner"
  );
}

export function canPostToCourse(context: CoursePermissionContext): boolean {
  return (
    canViewCourse(context) &&
    context.membership !== null &&
    POST_ROLES.has(context.membership.role)
  );
}

export function canModerateCourse(context: CoursePermissionContext): boolean {
  return canEditCourse(context);
}

export function canAccessAttachment(
  context: CoursePermissionContext,
  access: "public" | "course",
): boolean {
  if (!canViewCourse(context)) return false;
  return access === "public" || context.membership !== null;
}

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

