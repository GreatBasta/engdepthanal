import { NextResponse } from "next/server";
import { z } from "zod";

import { currentStudentId } from "@/auth";
import {
  getCourseCurriculumTopic,
  type CurriculumView,
} from "@/lib/courses/curriculum";
import {
  canEditCurriculum,
  canViewCourse,
  loadCoursePermissionContext,
} from "@/lib/courses/permissions";

const paramsSchema = z.object({
  courseId: z.string().uuid(),
  topicStableId: z.string().uuid(),
});

const querySchema = z.object({
  mode: z.enum(["read", "edit"]).default("read"),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string; topicStableId: string }> },
) {
  const [parsedParams, parsedQuery, studentId] = await Promise.all([
    params.then((value) => paramsSchema.safeParse(value)),
    Promise.resolve(
      querySchema.safeParse({
        mode: new URL(request.url).searchParams.get("mode") ?? undefined,
      }),
    ),
    currentStudentId(),
  ]);
  if (!parsedParams.success || !parsedQuery.success) {
    return NextResponse.json(
      { error: "Invalid curriculum request." },
      { status: 400 },
    );
  }

  const context = await loadCoursePermissionContext(
    parsedParams.data.courseId,
    studentId,
  );
  if (!context || !canViewCourse(context)) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const view: CurriculumView =
    parsedQuery.data.mode === "edit" ? "draft" : "published";
  if (view === "draft" && !canEditCurriculum(context)) {
    return NextResponse.json(
      { error: "Curriculum editing is not allowed." },
      { status: 403 },
    );
  }

  const topic = await getCourseCurriculumTopic(
    parsedParams.data.courseId,
    view,
    parsedParams.data.topicStableId,
    studentId,
  );
  if (!topic) {
    return NextResponse.json({ error: "Topic not found." }, { status: 404 });
  }

  return NextResponse.json(topic, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
