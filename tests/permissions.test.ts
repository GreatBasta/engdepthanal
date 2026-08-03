import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessAttachment,
  canContribute,
  canDeleteCourse,
  canEditCourse,
  canManageCoownershipRequests,
  canManageCourseSettings,
  canManageMembers,
  canModerateCourse,
  canPostToCourse,
  canViewCourse,
  isCourseCoowner,
  isCourseOwner,
  isCourseVisitor,
  type CourseMemberRole,
  type CoursePermissionContext,
} from "../src/lib/courses/permission-rules";

function context(
  visibility: CoursePermissionContext["visibility"],
  role: CourseMemberRole | null,
  archived = false,
): CoursePermissionContext {
  return {
    coursePageId: "course",
    visibility,
    archived,
    studentId: role ? "student" : null,
    membership: role ? { role, attendance: "attended" } : null,
  };
}

test("public and unlisted courses are viewable but private courses do not leak", () => {
  assert.equal(canViewCourse(context("public", null)), true);
  assert.equal(canViewCourse(context("unlisted", null)), true);
  assert.equal(canViewCourse(context("private", null)), false);
  assert.equal(canViewCourse(context("private", "visitor")), true);
  assert.equal(canViewCourse(context("public", "owner", true)), false);
});

test("course role capabilities remain distinct", () => {
  const owner = context("private", "owner");
  const coowner = context("private", "coowner");
  const visitor = context("private", "visitor");

  assert.equal(canManageMembers(owner), true);
  assert.equal(canManageMembers(coowner), false);
  assert.equal(canEditCourse(coowner), true);
  assert.equal(canManageCourseSettings(coowner), false);
  assert.equal(canManageCoownershipRequests(coowner), false);
  assert.equal(canModerateCourse(coowner), false);
  assert.equal(canPostToCourse(visitor), true);
  assert.equal(canContribute(visitor), true);
  assert.equal(canEditCourse(visitor), false);
  assert.equal(isCourseOwner(owner), true);
  assert.equal(isCourseCoowner(coowner), true);
  assert.equal(isCourseVisitor(visitor), true);
  assert.equal(canManageCoownershipRequests(owner), true);
  assert.equal(canDeleteCourse(owner), false);
  assert.equal(canDeleteCourse(context("private", "owner", true)), true);
  assert.equal(canDeleteCourse(context("private", "coowner", true)), false);

  // Deprecated values retain safe semantics until a verified DB migration.
  assert.equal(canEditCourse(context("private", "editor")), true);
  assert.equal(canContribute(context("private", "viewer")), true);
});

test("private attachment metadata still requires membership", () => {
  assert.equal(canAccessAttachment(context("public", null), "public"), true);
  assert.equal(canAccessAttachment(context("public", null), "course"), false);
  assert.equal(
    canAccessAttachment(context("private", "visitor"), "course"),
    true,
  );
  assert.equal(
    canAccessAttachment(context("private", null), "public"),
    false,
  );
});
