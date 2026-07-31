"use client";

import { useActionState, useRef, useState } from "react";

import {
  uploadCourseAttachmentAction,
  type AttachmentState,
} from "./community-actions";

const initialState: AttachmentState = { error: null, message: null };
const MAX_IMAGE_EDGE = 1_920;
const COMPRESSION_THRESHOLD = 750 * 1_024;

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < COMPRESSION_THRESHOLD) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);

    const outputType =
      file.type === "image/png" ? "image/webp" : file.type;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, 0.82),
    );
    if (!blob || blob.size >= file.size) return file;

    const extension =
      outputType === "image/webp"
        ? "webp"
        : outputType === "image/jpeg"
          ? "jpg"
          : "png";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "attachment";
    return new File([blob], `${baseName}.${extension}`, {
      type: outputType,
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}

export function AttachmentForm({
  coursePageId,
  courseSlug,
  parentType,
  parentId,
}: {
  coursePageId: string;
  courseSlug: string;
  parentType:
    | "post"
    | "reply"
    | "exam_experience"
    | "exam_question"
    | "course_resource";
  parentId: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [preparationMessage, setPreparationMessage] = useState<string | null>(
    null,
  );
  const [state, action, pending] = useActionState(
    uploadCourseAttachmentAction,
    initialState,
  );

  async function prepareSelectedImage(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const original = event.currentTarget.files?.[0];
    setPreparationMessage(null);
    if (!original?.type.startsWith("image/")) return;

    setPreparing(true);
    try {
      const compressed = await compressImage(original);
      if (
        compressed !== original &&
        fileInput.current?.files?.[0] === original
      ) {
        const transfer = new DataTransfer();
        transfer.items.add(compressed);
        fileInput.current.files = transfer.files;
        const savedPercent = Math.max(
          1,
          Math.round((1 - compressed.size / original.size) * 100),
        );
        setPreparationMessage(
          `Image optimized on this device (${savedPercent}% smaller).`,
        );
      }
    } catch {
      // Unsupported image decoders fall back to the original validated file.
      setPreparationMessage("The original image will be uploaded.");
    } finally {
      setPreparing(false);
    }
  }

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
          ref={fileInput}
          type="file"
          name="file"
          required
          accept=".pdf,.txt,.md,.markdown,.jpg,.jpeg,.png,.webp"
          aria-label="Attachment file"
          onChange={prepareSelectedImage}
          disabled={pending || preparing}
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
          disabled={pending || preparing}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {preparing ? "Optimizing…" : pending ? "Uploading…" : "Attach"}
        </button>
      </div>
      {preparing || pending ? (
        <progress
          aria-label={preparing ? "Optimizing image" : "Uploading attachment"}
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full accent-indigo-600"
        />
      ) : null}
      <p className="mt-2 text-[11px] text-zinc-500">
        PDF, text, Markdown, or image · 4 MB maximum.
      </p>
      {preparationMessage ? (
        <p aria-live="polite" className="mt-2 text-xs text-indigo-700">
          {preparationMessage}
        </p>
      ) : null}
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
