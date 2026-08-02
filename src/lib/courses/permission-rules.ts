export type CourseVisibility = "public" | "unlisted" | "private";
export type CourseMemberRole =
  | "owner"
  | "coowner"
  | "visitor"
  // Deprecated database values retained during the additive migration.
  | "editor"
  | "contributor"
  | "viewer";
export type EffectiveCourseRole = "owner" | "coowner" | "visitor";
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

/** Compatibility bridge while deprecated enum values remain in PostgreSQL. */
export function effectiveCourseRole(
  role: CourseMemberRole | null | undefined,
): EffectiveCourseRole | null {
  if (!role) return null;
  if (role === "owner") return "owner";
  if (role === "coowner" || role === "editor") return "coowner";
  return "visitor";
}

export function canViewCourse(context: CoursePermissionContext): boolean {
  if (context.archived) return false;
  if (context.visibility === "public" || context.visibility === "unlisted") {
    return true;
  }
  return context.membership !== null;
}

export function isCourseOwner(context: CoursePermissionContext): boolean {
  return (
    context.studentId !== null &&
    effectiveCourseRole(context.membership?.role) === "owner"
  );
}

export function isCourseCoowner(context: CoursePermissionContext): boolean {
  return (
    context.studentId !== null &&
    effectiveCourseRole(context.membership?.role) === "coowner"
  );
}

export function isCourseVisitor(context: CoursePermissionContext): boolean {
  return (
    context.studentId !== null &&
    effectiveCourseRole(context.membership?.role) === "visitor"
  );
}

export function canEditCurriculum(context: CoursePermissionContext): boolean {
  return (
    canViewCourse(context) &&
    (isCourseOwner(context) || isCourseCoowner(context))
  );
}

export function canContribute(context: CoursePermissionContext): boolean {
  return canViewCourse(context) && context.membership !== null;
}

export function canManageCoownershipRequests(
  context: CoursePermissionContext,
): boolean {
  return isCourseOwner(context);
}

export function canManageCourseSettings(
  context: CoursePermissionContext,
): boolean {
  return isCourseOwner(context);
}

export function canManageMembers(context: CoursePermissionContext): boolean {
  return isCourseOwner(context);
}

export function canModerateCourse(context: CoursePermissionContext): boolean {
  return isCourseOwner(context);
}

export function canDeleteCourse(context: CoursePermissionContext): boolean {
  return isCourseOwner(context) && context.archived;
}

export function canAccessAttachment(
  context: CoursePermissionContext,
  access: "public" | "course",
): boolean {
  if (!canViewCourse(context)) return false;
  return access === "public" || context.membership !== null;
}

// Compatibility names used by existing server code during the UI migration.
export const canEditCourse = canEditCurriculum;
export const canPostToCourse = canContribute;
