import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_ATTACHMENT_BYTES,
  safeAttachmentName,
  validateAttachmentMetadata,
} from "../src/lib/courses/attachment-policy";

test("accepts an allowed MIME and matching extension", () => {
  assert.equal(
    validateAttachmentMetadata({
      name: "exam-notes.pdf",
      type: "application/pdf",
      size: 1024,
    }),
    null,
  );
});

test("rejects MIME spoofing and oversized files", () => {
  assert.match(
    validateAttachmentMetadata({
      name: "malware.exe",
      type: "application/pdf",
      size: 1024,
    }) ?? "",
    /Use PDF/,
  );
  assert.match(
    validateAttachmentMetadata({
      name: "notes.pdf",
      type: "application/pdf",
      size: MAX_ATTACHMENT_BYTES + 1,
    }) ?? "",
    /4 MB/,
  );
});

test("removes path and markup characters from stored filenames", () => {
  const safe = safeAttachmentName("../../Exam <script>.pdf", "pdf");
  assert.equal(safe.includes("/"), false);
  assert.equal(safe.includes("<"), false);
  assert.equal(safe.endsWith(".pdf"), true);
});

