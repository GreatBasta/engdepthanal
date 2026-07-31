import { and, eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import {
  courseMembers,
  coursePages,
  courseResources,
  courseSubtopicProgress,
  students,
} from "@/lib/db/schema";

export async function GET() {
  const studentId = await currentStudentId();
  if (!studentId) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const [profile, memberships, progress, resources] = await Promise.all([
    db
      .select({
        id: students.id,
        email: students.email,
        displayName: students.displayName,
        createdAt: students.createdAt,
      })
      .from(students)
      .where(eq(students.id, studentId)),
    db
      .select({
        courseSlug: coursePages.slug,
        courseName: coursePages.localName,
        role: courseMembers.role,
        attendance: courseMembers.attendance,
        joinedAt: courseMembers.joinedAt,
      })
      .from(courseMembers)
      .innerJoin(coursePages, eq(courseMembers.coursePageId, coursePages.id))
      .where(eq(courseMembers.studentId, studentId)),
    db
      .select()
      .from(courseSubtopicProgress)
      .where(eq(courseSubtopicProgress.studentId, studentId)),
    db
      .select({
        id: courseResources.id,
        coursePageId: courseResources.coursePageId,
        type: courseResources.type,
        title: courseResources.title,
        body: courseResources.body,
        linkUrl: courseResources.linkUrl,
        createdAt: courseResources.createdAt,
      })
      .from(courseResources)
      .where(
        and(
          eq(courseResources.authorId, studentId),
          eq(courseResources.permissionConfirmed, true),
        ),
      ),
  ]);

  return new Response(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        profile: profile[0] ?? null,
        memberships,
        privateProgress: progress,
        contributions: resources,
      },
      null,
      2,
    ),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": 'attachment; filename="course-atlas-export.json"',
        "cache-control": "private, no-store",
      },
    },
  );
}
