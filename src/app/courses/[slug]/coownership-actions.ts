"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import {
  canManageCoownershipRequests,
  isCourseCoowner,
  isCourseVisitor,
  loadCoursePermissionContext,
} from "@/lib/courses/permissions";
import { db } from "@/lib/db/client";
import {
  courseCoownershipRequests,
  courseMembers,
} from "@/lib/db/schema";

const courseActionSchema = z.object({
  coursePageId: z.string().uuid(),
  courseSlug: z.string().trim().min(1).max(120),
});

function revalidateMembershipRoutes(courseSlug: string) {
  revalidatePath("/");
  revalidatePath("/my-courses");
  revalidatePath(`/courses/${courseSlug}`);
  revalidatePath(`/courses/${courseSlug}/settings/members`);
}

export async function requestCoownershipAction(formData: FormData) {
  const parsed = courseActionSchema
    .extend({
      message: z.preprocess(
        (value) =>
          typeof value === "string" && value.trim() ? value : undefined,
        z.string().trim().max(800).optional(),
      ),
    })
    .safeParse({
      coursePageId: formData.get("coursePageId"),
      courseSlug: formData.get("courseSlug"),
      message: formData.get("message"),
    });
  if (!parsed.success) return;
  const studentId = await currentStudentId();
  if (!studentId) redirect(`/login?next=/courses/${parsed.data.courseSlug}`);
  const context = await loadCoursePermissionContext(
    parsed.data.coursePageId,
    studentId,
  );
  if (!context || !isCourseVisitor(context)) {
    redirect(`/courses/${parsed.data.courseSlug}?request=not-allowed`);
  }

  const [inserted] = await db
    .insert(courseCoownershipRequests)
    .values({
      coursePageId: parsed.data.coursePageId,
      requesterId: studentId,
      message: parsed.data.message ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: courseCoownershipRequests.id });
  revalidateMembershipRoutes(parsed.data.courseSlug);
  redirect(
    `/courses/${parsed.data.courseSlug}?request=${inserted ? "pending" : "already-pending"}`,
  );
}

export async function cancelCoownershipRequestAction(formData: FormData) {
  const parsed = courseActionSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
  });
  if (!parsed.success) return;
  const studentId = await currentStudentId();
  if (!studentId) redirect(`/login?next=/courses/${parsed.data.courseSlug}`);
  await db
    .update(courseCoownershipRequests)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(courseCoownershipRequests.coursePageId, parsed.data.coursePageId),
        eq(courseCoownershipRequests.requesterId, studentId),
        eq(courseCoownershipRequests.status, "pending"),
      ),
    );
  revalidateMembershipRoutes(parsed.data.courseSlug);
  redirect(`/courses/${parsed.data.courseSlug}?request=cancelled`);
}

export async function reviewCoownershipRequestAction(formData: FormData) {
  const parsed = courseActionSchema
    .extend({
      requestId: z.string().uuid(),
      decision: z.enum(["accepted", "rejected"]),
    })
    .safeParse({
      coursePageId: formData.get("coursePageId"),
      courseSlug: formData.get("courseSlug"),
      requestId: formData.get("requestId"),
      decision: formData.get("decision"),
    });
  if (!parsed.success) return;
  const ownerId = await currentStudentId();
  if (!ownerId) redirect("/login");
  const context = await loadCoursePermissionContext(
    parsed.data.coursePageId,
    ownerId,
  );
  if (!context || !canManageCoownershipRequests(context)) {
    redirect(`/courses/${parsed.data.courseSlug}`);
  }

  let decided = false;
  try {
    decided = await db.transaction(async (tx) => {
      const [candidate] = await tx
        .select({ requesterId: courseCoownershipRequests.requesterId })
        .from(courseCoownershipRequests)
        .where(
          and(
            eq(courseCoownershipRequests.id, parsed.data.requestId),
            eq(
              courseCoownershipRequests.coursePageId,
              parsed.data.coursePageId,
            ),
            eq(courseCoownershipRequests.status, "pending"),
          ),
        )
        .limit(1);
      if (!candidate || candidate.requesterId === ownerId) return false;

      const [request] = await tx
        .update(courseCoownershipRequests)
        .set({
          status: parsed.data.decision,
          reviewerId: ownerId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(courseCoownershipRequests.id, parsed.data.requestId),
            eq(
              courseCoownershipRequests.coursePageId,
              parsed.data.coursePageId,
            ),
            eq(courseCoownershipRequests.status, "pending"),
          ),
        )
        .returning({ requesterId: courseCoownershipRequests.requesterId });
      if (!request) return false;
      if (parsed.data.decision === "accepted") {
        const [promoted] = await tx
          .update(courseMembers)
          .set({ role: "coowner", updatedAt: new Date() })
          .where(
            and(
              eq(courseMembers.coursePageId, parsed.data.coursePageId),
              eq(courseMembers.studentId, request.requesterId),
              inArray(courseMembers.role, ["visitor", "contributor", "viewer"]),
            ),
          )
          .returning({ studentId: courseMembers.studentId });
        if (!promoted) throw new Error("Requester is no longer a visitor");
      }
      return true;
    });
  } catch {
    decided = false;
  }

  revalidateMembershipRoutes(parsed.data.courseSlug);
  redirect(
    `/courses/${parsed.data.courseSlug}/settings/members?review=${decided ? parsed.data.decision : "failed"}`,
  );
}

export async function leaveCoownershipAction(formData: FormData) {
  const parsed = courseActionSchema.safeParse({
    coursePageId: formData.get("coursePageId"),
    courseSlug: formData.get("courseSlug"),
  });
  if (!parsed.success) return;
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");
  const context = await loadCoursePermissionContext(
    parsed.data.coursePageId,
    studentId,
  );
  if (!context || !isCourseCoowner(context)) {
    redirect(`/courses/${parsed.data.courseSlug}`);
  }
  await db
    .update(courseMembers)
    .set({ role: "visitor", updatedAt: new Date() })
    .where(
      and(
        eq(courseMembers.coursePageId, parsed.data.coursePageId),
        eq(courseMembers.studentId, studentId),
        inArray(courseMembers.role, ["coowner", "editor"]),
      ),
    );
  revalidateMembershipRoutes(parsed.data.courseSlug);
  redirect(`/courses/${parsed.data.courseSlug}?coownership=left`);
}
