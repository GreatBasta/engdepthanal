import { notFound } from "next/navigation";
import { and, desc, eq, isNotNull } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { getCourseBySlugForViewer } from "@/lib/courses/data";
import { db } from "@/lib/db/client";
import { courseAttachments } from "@/lib/db/schema";

import { updateCourseSettingsAction } from "../actions";
import {
  moderateCourseContentAction,
  permanentlyDeleteCourseAttachmentAction,
} from "../community-actions";

export default async function GeneralCourseSettings({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [{ slug }, studentId] = await Promise.all([params, currentStudentId()]);
  const detail = await getCourseBySlugForViewer(slug, studentId);
  if (!detail?.permissions.canEdit) notFound();
  const deletedAttachments = await db
    .select({
      id: courseAttachments.id,
      fileName: courseAttachments.fileName,
      sizeBytes: courseAttachments.sizeBytes,
      deletedAt: courseAttachments.deletedAt,
    })
    .from(courseAttachments)
    .where(
      and(
        eq(courseAttachments.coursePageId, detail.course.id),
        isNotNull(courseAttachments.deletedAt),
      ),
    )
    .orderBy(desc(courseAttachments.deletedAt));
  const input =
    "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3";

  return (
    <div className="max-w-2xl space-y-6">
      <form
        action={updateCourseSettingsAction}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="coursePageId" value={detail.course.id} />
        <input type="hidden" name="courseSlug" value={slug} />
        <label className="block text-sm font-semibold">
          Local course name
          <input
            name="localName"
            required
            defaultValue={detail.course.localName}
            className={input}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Code
            <input
              name="courseCode"
              defaultValue={detail.course.courseCode ?? ""}
              className={input}
            />
          </label>
          <label className="block text-sm font-semibold">
            Professor
            <input
              name="professorName"
              defaultValue={detail.course.professorName ?? ""}
              className={input}
            />
          </label>
          <label className="block text-sm font-semibold">
            Academic year
            <input
              name="academicYear"
              required
              defaultValue={detail.course.academicYear}
              className={input}
            />
          </label>
          <label className="block text-sm font-semibold">
            Cohort year
            <input
              name="cohortYear"
              type="number"
              min={2000}
              max={2100}
              defaultValue={detail.course.cohortYear ?? ""}
              className={input}
            />
          </label>
          <label className="block text-sm font-semibold">
            Semester
            <input
              name="semester"
              type="number"
              min={1}
              max={12}
              defaultValue={detail.course.semester ?? ""}
              className={input}
            />
          </label>
        </div>
        <label className="block text-sm font-semibold">
          Description
          <textarea
            name="description"
            rows={5}
            defaultValue={detail.course.description ?? ""}
            className={`${input} py-3`}
          />
        </label>
        <input
          type="hidden"
          name="visibility"
          value={detail.course.visibility}
        />
        <button className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
          Save settings
        </button>
      </form>

      {deletedAttachments.length ? (
        <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Hidden attachments</h2>
          <p className="mt-1 text-sm text-slate-600">
            Moderated files remain recoverable until an editor permanently
            removes both the private Blob object and its database metadata.
          </p>
          <ul className="mt-4 space-y-3">
            {deletedAttachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex flex-col gap-3 rounded-xl bg-rose-50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="break-all text-sm font-semibold">
                    {attachment.fileName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {Math.ceil(attachment.sizeBytes / 1024)} KB · hidden{" "}
                    {attachment.deletedAt?.toLocaleDateString("en")}
                  </p>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <form action={moderateCourseContentAction}>
                    <input
                      type="hidden"
                      name="coursePageId"
                      value={detail.course.id}
                    />
                    <input type="hidden" name="courseSlug" value={slug} />
                    <input
                      type="hidden"
                      name="targetType"
                      value="attachment"
                    />
                    <input
                      type="hidden"
                      name="targetId"
                      value={attachment.id}
                    />
                    <input
                      type="hidden"
                      name="reason"
                      value="Restored from course settings"
                    />
                    <button
                      type="submit"
                      name="action"
                      value="restore"
                      className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold"
                    >
                      Restore
                    </button>
                  </form>
                  <details className="rounded-xl border border-rose-300 bg-white">
                    <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-rose-800">
                      Delete permanently
                    </summary>
                    <form
                      action={permanentlyDeleteCourseAttachmentAction}
                      className="w-64 border-t border-rose-200 p-3"
                    >
                      <input
                        type="hidden"
                        name="coursePageId"
                        value={detail.course.id}
                      />
                      <input type="hidden" name="courseSlug" value={slug} />
                      <input
                        type="hidden"
                        name="attachmentId"
                        value={attachment.id}
                      />
                      <p className="text-xs text-slate-600">
                        This removes the private Blob object and cannot be
                        undone.
                      </p>
                      <button
                        type="submit"
                        name="confirmation"
                        value="delete"
                        className="mt-3 min-h-11 w-full rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white"
                      >
                        Confirm permanent deletion
                      </button>
                    </form>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
