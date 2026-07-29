"use server";

import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import { courseDuplicateKey } from "@/lib/courses/core";
import {
  canEditCourse,
  canManageMembers,
  loadCoursePermissionContext,
} from "@/lib/courses/permissions";
import { db } from "@/lib/db/client";
import {
  courseInvites,
  courseMembers,
  coursePages,
  students,
} from "@/lib/db/schema";

export interface InviteMemberState {
  error: string | null;
  message: string | null;
  inviteUrl: string | null;
}

const memberRole = z.enum(["owner", "editor", "contributor", "viewer"]);
const inviteRole = z.enum(["editor", "contributor", "viewer"]);
const attendance = z.enum(["attended", "not_attended"]);

const manageMemberSchema = z.object({
  coursePageId: z.string().uuid(),
  courseSlug: z.string().min(1).max(120),
  studentId: z.string().uuid(),
  role: memberRole,
  attendance,
});

const inviteSchema = z.object({
  coursePageId: z.string().uuid(),
  courseSlug: z.string().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(320),
  role: inviteRole,
  attendance,
});

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value : undefined),
    z.string().trim().max(max).optional(),
  );

const optionalInteger = (minimum: number, maximum: number) =>
  z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(minimum).max(maximum).optional(),
  );

const updateCourseSchema = z.object({
  coursePageId: z.string().uuid(),
  courseSlug: z.string().min(1).max(120),
  localName: z.string().trim().min(2).max(180),
  courseCode: optionalText(40),
  professorName: optionalText(120),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}(?:\s*[/–-]\s*\d{2,4})?$/, "Use a year such as 2026/27"),
  cohortYear: optionalInteger(2000, 2100),
  semester: optionalInteger(1, 12),
  description: optionalText(2_000),
  visibility: z.enum(["public", "unlisted", "private"]),
});

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function updateCourseSettingsAction(formData: FormData) {
  const parsed = updateCourseSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    localName: formData.get("localName"),
    courseCode: formData.get("courseCode"),
    professorName: formData.get("professorName"),
    academicYear: formData.get("academicYear"),
    cohortYear: formData.get("cohortYear"),
    semester: formData.get("semester"),
    description: formData.get("description"),
    visibility: formData.get("visibility"),
  });
  if (!parsed.success) return;

  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");
  const context = await loadCoursePermissionContext(
    parsed.data.coursePageId,
    studentId,
  );
  if (!context || !canEditCourse(context)) return;

  const { coursePageId, courseSlug, ...course } = parsed.data;
  await db
    .update(coursePages)
    .set({
      ...course,
      courseCode: course.courseCode ?? null,
      professorName: course.professorName ?? null,
      cohortYear: course.cohortYear ?? null,
      semester: course.semester ?? null,
      description: course.description ?? null,
      duplicateKey: courseDuplicateKey(course),
      updatedAt: new Date(),
    })
    .where(
      and(eq(coursePages.id, coursePageId), eq(coursePages.slug, courseSlug)),
    );
  revalidatePath(`/courses/${courseSlug}`);
  revalidatePath("/courses");
}

async function requireMemberManager(coursePageId: string) {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");
  const context = await loadCoursePermissionContext(coursePageId, studentId);
  if (!context || !canManageMembers(context)) {
    throw new Error("Course member management is not allowed");
  }
  return studentId;
}

export async function inviteMemberAction(
  _previous: InviteMemberState,
  formData: FormData,
): Promise<InviteMemberState> {
  const parsed = inviteSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    email: formData.get("email"),
    role: formData.get("role"),
    attendance: formData.get("attendance"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the invitation.",
      message: null,
      inviteUrl: null,
    };
  }

  let managerId: string;
  try {
    managerId = await requireMemberManager(parsed.data.coursePageId);
  } catch {
    return {
      error: "You do not have permission to invite course members.",
      message: null,
      inviteUrl: null,
    };
  }

  const [recent] = await db
    .select({ value: count() })
    .from(courseInvites)
    .where(
      and(
        eq(courseInvites.createdBy, managerId),
        gte(courseInvites.createdAt, new Date(Date.now() - 60 * 60 * 1_000)),
      ),
    );
  if (Number(recent?.value ?? 0) >= 20) {
    return {
      error: "Invitation limit reached. Try again in an hour.",
      message: null,
      inviteUrl: null,
    };
  }

  const [student] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.email, parsed.data.email))
    .limit(1);
  if (student) {
    const [membership] = await db
      .select({ role: courseMembers.role })
      .from(courseMembers)
      .where(
        and(
          eq(courseMembers.coursePageId, parsed.data.coursePageId),
          eq(courseMembers.studentId, student.id),
        ),
      )
      .limit(1);
    if (membership?.role === "owner") {
      return {
        error: "An owner cannot be changed through an invitation.",
        message: null,
        inviteUrl: null,
      };
    }
    await db
      .insert(courseMembers)
      .values({
        coursePageId: parsed.data.coursePageId,
        studentId: student.id,
        role: parsed.data.role,
        attendance: parsed.data.attendance,
      })
      .onConflictDoUpdate({
        target: [courseMembers.coursePageId, courseMembers.studentId],
        set: {
          role: parsed.data.role,
          attendance: parsed.data.attendance,
          updatedAt: new Date(),
        },
      });
    revalidatePath(`/courses/${parsed.data.courseSlug}`);
    return {
      error: null,
      message: "The existing account was added to the course.",
      inviteUrl: null,
    };
  }

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
  await db.insert(courseInvites).values({
    coursePageId: parsed.data.coursePageId,
    email: parsed.data.email,
    role: parsed.data.role,
    attendance: parsed.data.attendance,
    tokenHash: tokenHash(rawToken),
    status: "pending",
    createdBy: managerId,
    expiresAt,
  });

  return {
    error: null,
    message: "Share this one-time invitation link. It expires in 7 days.",
    inviteUrl: `/courses/invitations/${rawToken}`,
  };
}

export async function updateCourseMemberAction(formData: FormData) {
  const parsed = manageMemberSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
    studentId: formData.get("studentId"),
    role: formData.get("role"),
    attendance: formData.get("attendance"),
  });
  if (!parsed.success) return;

  await requireMemberManager(parsed.data.coursePageId);
  const [target] = await db
    .select({ role: courseMembers.role })
    .from(courseMembers)
    .where(
      and(
        eq(courseMembers.coursePageId, parsed.data.coursePageId),
        eq(courseMembers.studentId, parsed.data.studentId),
      ),
    )
    .limit(1);
  if (!target) return;

  if (target.role === "owner" && parsed.data.role !== "owner") {
    const [owners] = await db
      .select({ value: count() })
      .from(courseMembers)
      .where(
        and(
          eq(courseMembers.coursePageId, parsed.data.coursePageId),
          eq(courseMembers.role, "owner"),
        ),
      );
    if (Number(owners?.value ?? 0) <= 1) return;
  }

  await db
    .update(courseMembers)
    .set({
      role: parsed.data.role,
      attendance: parsed.data.attendance,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(courseMembers.coursePageId, parsed.data.coursePageId),
        eq(courseMembers.studentId, parsed.data.studentId),
      ),
    );
  revalidatePath(`/courses/${parsed.data.courseSlug}`);
}

const acceptInviteSchema = z.object({
  token: z.string().min(32).max(200),
});

export async function acceptCourseInviteAction(formData: FormData) {
  const studentId = await currentStudentId();
  const token = acceptInviteSchema.safeParse({
    token: formData.get("token"),
  });
  if (!token.success) redirect("/courses");
  if (!studentId) {
    redirect(`/login?next=/courses/invitations/${token.data.token}`);
  }

  const [student] = await db
    .select({ email: students.email })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  const [invite] = await db
    .select({
      id: courseInvites.id,
      coursePageId: courseInvites.coursePageId,
      email: courseInvites.email,
      role: courseInvites.role,
      attendance: courseInvites.attendance,
      slug: coursePages.slug,
    })
    .from(courseInvites)
    .innerJoin(coursePages, eq(courseInvites.coursePageId, coursePages.id))
    .where(
      and(
        eq(courseInvites.tokenHash, tokenHash(token.data.token)),
        eq(courseInvites.status, "pending"),
        gt(courseInvites.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!student || !invite || student.email.toLowerCase() !== invite.email) {
    redirect("/courses?invite=invalid");
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(courseMembers)
      .values({
        coursePageId: invite.coursePageId,
        studentId,
        role: invite.role,
        attendance: invite.attendance,
      })
      .onConflictDoNothing();
    await tx
      .update(courseInvites)
      .set({
        status: "accepted",
        acceptedBy: studentId,
        acceptedAt: new Date(),
      })
      .where(
        and(
          eq(courseInvites.id, invite.id),
          eq(courseInvites.status, "pending"),
        ),
      );
  });

  redirect(`/courses/${invite.slug}?tab=contributors`);
}
