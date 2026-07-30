import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_ATTACHMENT_BYTES,
  safeAttachmentName,
  validateAttachmentBytes,
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

test("checks file signatures instead of trusting browser MIME alone", () => {
  assert.equal(
    validateAttachmentBytes(
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]),
      "application/pdf",
    ),
    null,
  );
  assert.match(
    validateAttachmentBytes(
      new Uint8Array([0x4d, 0x5a, 0x90, 0x00]),
      "application/pdf",
    ) ?? "",
    /do not match/,
  );
});
