export type CourseVisibility = "public" | "unlisted" | "private";
export type CourseMemberRole = "owner" | "editor" | "contributor" | "viewer";
export type CourseAttendance = "attended" | "not_attended";

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
  return canViewCourse(context) && context.membership?.role === "owner";
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

