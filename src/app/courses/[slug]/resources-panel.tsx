import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  courseResources,
  courseAttachments,
  students,
} from "@/lib/db/schema";

import { AttachmentForm } from "./attachment-form";
import { createResourceAction } from "./resource-actions";

export async function ResourcesPanel({
  coursePageId,
  courseSlug,
  canPost,
  page = 1,
}: {
  coursePageId: string;
  courseSlug: string;
  canPost: boolean;
  page?: number;
}) {
  const safePage = Math.max(1, Math.floor(page));
  const [resources, attachments] = await Promise.all([
    db.select({
      id: courseResources.id,
      type: courseResources.type,
      context: courseResources.context,
      title: courseResources.title,
      body: courseResources.body,
      linkUrl: courseResources.linkUrl,
      createdAt: courseResources.createdAt,
      author: students.displayName,
    })
    .from(courseResources)
    .innerJoin(students, eq(courseResources.authorId, students.id))
    .where(
      and(
        eq(courseResources.coursePageId, coursePageId),
        isNull(courseResources.hiddenAt),
        isNull(courseResources.deletedAt),
      ),
    )
    .orderBy(desc(courseResources.createdAt))
    .limit(20)
    .offset((safePage - 1) * 20),
    db
      .select({
        id: courseAttachments.id,
        parentId: courseAttachments.parentId,
        fileName: courseAttachments.fileName,
        mimeType: courseAttachments.mimeType,
        sizeBytes: courseAttachments.sizeBytes,
      })
      .from(courseAttachments)
      .where(
        and(
          eq(courseAttachments.coursePageId, coursePageId),
          eq(courseAttachments.parentType, "course_resource"),
          isNull(courseAttachments.deletedAt),
        ),
      ),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Resources</h2>
            <p className="mt-1 text-sm text-slate-600">
              Notes and permitted materials attached to this course, its topics, or the exam.
            </p>
          </div>
          <span className="text-xs text-slate-500">Newest first</span>
        </div>
        {resources.length ? (
          <ul className="mt-5 space-y-3">
            {resources.map((resource) => (
              <li key={resource.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold capitalize text-indigo-700">
                    {resource.type.replaceAll("_", " ")}
                  </span>
                  <span className="capitalize text-slate-500">{resource.context}</span>
                  <span className="text-slate-400">· {resource.author}</span>
                </div>
                {resource.title ? <h3 className="mt-3 font-bold">{resource.title}</h3> : null}
                {resource.body ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{resource.body}</p>
                ) : null}
                {resource.linkUrl ? (
                  <Link
                    href={resource.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-3 inline-flex min-h-11 items-center break-all text-sm font-semibold text-indigo-700 underline"
                  >
                    Open link
                  </Link>
                ) : null}
                {attachments
                  .filter((attachment) => attachment.parentId === resource.id)
                  .map((attachment) => (
                    <a
                      key={attachment.id}
                      href={`/api/courses/${coursePageId}/attachments/${attachment.id}`}
                      className="mt-3 flex min-h-11 items-center rounded-xl bg-slate-100 px-3 text-sm font-semibold text-indigo-700"
                    >
                      {attachment.fileName} · {Math.ceil(attachment.sizeBytes / 1024)} KB
                    </a>
                  ))}
                {canPost ? (
                  <AttachmentForm
                    coursePageId={coursePageId}
                    courseSlug={courseSlug}
                    parentType="course_resource"
                    parentId={resource.id}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
            No contextual resources yet.
          </div>
        )}
        <nav aria-label="Resource pages" className="mt-5 flex gap-3">
          {safePage > 1 ? (
            <Link href={`/courses/${courseSlug}?tab=resources&page=${safePage - 1}`} className="min-h-11 px-3 py-2 font-semibold text-indigo-700">
              Previous
            </Link>
          ) : null}
          {resources.length === 20 ? (
            <Link href={`/courses/${courseSlug}?tab=resources&page=${safePage + 1}`} className="min-h-11 px-3 py-2 font-semibold text-indigo-700">
              Next
            </Link>
          ) : null}
        </nav>
      </section>

      <aside>
        {canPost ? (
          <form action={createResourceAction} className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold">Add a resource</h2>
            <input type="hidden" name="coursePageId" value={coursePageId} />
            <input type="hidden" name="courseSlug" value={courseSlug} />
            <label className="mt-4 block text-sm font-semibold">
              Context
              <select name="context" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3">
                <option value="course">Course</option>
                <option value="exam">Exam</option>
              </select>
            </label>
            <label className="mt-3 block text-sm font-semibold">
              Type
              <select name="type" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3">
                <option value="text_note">Text note</option>
                <option value="study_tip">Study tip</option>
                <option value="correction">Correction</option>
                <option value="link">Link</option>
                <option value="permitted_material">Permitted material</option>
              </select>
            </label>
            <label className="mt-3 block text-sm font-semibold">
              Title
              <input name="title" maxLength={180} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" />
            </label>
            <label className="mt-3 block text-sm font-semibold">
              Note
              <textarea name="body" rows={5} maxLength={10_000} className="mt-1 w-full rounded-xl border border-slate-300 p-3" />
            </label>
            <label className="mt-3 block text-sm font-semibold">
              Link
              <input name="linkUrl" type="url" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" />
            </label>
            <label className="mt-4 flex gap-3 text-xs leading-5 text-slate-600">
              <input type="checkbox" name="permissionConfirmed" value="yes" className="mt-1" />
              I confirm I am allowed to share this material.
            </label>
            <button className="mt-4 min-h-11 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
              Publish resource
            </button>
          </form>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Join this course to contribute resources.
          </div>
        )}
      </aside>
    </div>
  );
}
