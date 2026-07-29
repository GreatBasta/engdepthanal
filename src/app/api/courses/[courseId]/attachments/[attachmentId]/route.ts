import { get } from "@vercel/blob";
import { and, eq, isNull } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import {
  canAccessAttachment,
  loadCoursePermissionContext,
} from "@/lib/courses/permissions";
import { db } from "@/lib/db/client";
import { courseAttachments } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ courseId: string; attachmentId: string }>;
  },
) {
  const { courseId, attachmentId } = await params;
  const studentId = await currentStudentId();
  const [attachment, context] = await Promise.all([
    db
      .select({
        blobUrl: courseAttachments.blobUrl,
        fileName: courseAttachments.fileName,
        mimeType: courseAttachments.mimeType,
        sizeBytes: courseAttachments.sizeBytes,
        access: courseAttachments.access,
      })
      .from(courseAttachments)
      .where(
        and(
          eq(courseAttachments.id, attachmentId),
          eq(courseAttachments.coursePageId, courseId),
          isNull(courseAttachments.deletedAt),
        ),
      )
      .limit(1)
      .then(([row]) => row ?? null),
    loadCoursePermissionContext(courseId, studentId),
  ]);

  // A 404 for both absence and denial prevents private attachment discovery.
  if (
    !attachment ||
    !context ||
    !canAccessAttachment(context, attachment.access)
  ) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const result = await get(attachment.blobUrl, { access: "private" });
  if (!result || result.statusCode !== 200) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const encodedName = encodeURIComponent(attachment.fileName).replace(
    /[!'()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return new Response(result.stream, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(attachment.sizeBytes),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
