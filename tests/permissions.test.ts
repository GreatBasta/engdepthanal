import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessAttachment,
  canEditCourse,
  canManageMembers,
  canModerateCourse,
  canPostToCourse,
  canViewCourse,
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
  assert.equal(canViewCourse(context("private", "viewer")), true);
  assert.equal(canViewCourse(context("public", "owner", true)), false);
});

test("course role capabilities remain distinct", () => {
  const owner = context("private", "owner");
  const editor = context("private", "editor");
  const contributor = context("private", "contributor");
  const viewer = context("private", "viewer");

  assert.equal(canManageMembers(owner), true);
  assert.equal(canManageMembers(editor), false);
  assert.equal(canEditCourse(editor), true);
  assert.equal(canModerateCourse(editor), true);
  assert.equal(canPostToCourse(contributor), true);
  assert.equal(canEditCourse(contributor), false);
  assert.equal(canPostToCourse(viewer), false);
});

test("private attachment metadata still requires membership", () => {
  assert.equal(canAccessAttachment(context("public", null), "public"), true);
  assert.equal(canAccessAttachment(context("public", null), "course"), false);
  assert.equal(
    canAccessAttachment(context("private", "viewer"), "course"),
    true,
  );
  assert.equal(
    canAccessAttachment(context("private", null), "public"),
    false,
  );
});

