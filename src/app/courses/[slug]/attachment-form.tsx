"use client";

import { useActionState } from "react";

import {
  uploadCourseAttachmentAction,
  type AttachmentState,
} from "./community-actions";

const initialState: AttachmentState = { error: null, message: null };

export function AttachmentForm({
  coursePageId,
  courseSlug,
  parentType,
  parentId,
}: {
  coursePageId: string;
  courseSlug: string;
  parentType: "post" | "reply";
  parentId: string;
}) {
  const [state, action, pending] = useActionState(
    uploadCourseAttachmentAction,
    initialState,
  );

  return (
    <form
      action={action}
      className="mt-3 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700"
    >
      <input type="hidden" name="coursePageId" value={coursePageId} />
      <input type="hidden" name="courseSlug" value={courseSlug} />
      <input type="hidden" name="parentType" value={parentType} />
      <input type="hidden" name="parentId" value={parentId} />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
        <input
          type="file"
          name="file"
          required
          accept=".pdf,.docx,.txt,.md,.markdown,.jpg,.jpeg,.png,.webp"
          aria-label="Attachment file"
          className="min-w-0 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-xs file:font-medium dark:file:bg-zinc-800"
        />
        <select
          name="access"
          defaultValue="course"
          aria-label="Attachment access"
          className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="course">Members only</option>
          <option value="public">Course viewers</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {pending ? "Uploading…" : "Attach"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        PDF, DOCX, text, Markdown, or image · 4 MB maximum.
      </p>
      {state.error ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p aria-live="polite" className="mt-2 text-xs text-emerald-600">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

