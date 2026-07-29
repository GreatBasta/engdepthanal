export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

const ACCEPTED_FILES = new Map<string, ReadonlySet<string>>([
  ["application/pdf", new Set(["pdf"])],
  ["image/jpeg", new Set(["jpg", "jpeg"])],
  ["image/png", new Set(["png"])],
  ["image/webp", new Set(["webp"])],
  ["text/plain", new Set(["txt"])],
  ["text/markdown", new Set(["md", "markdown"])],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    new Set(["docx"]),
  ],
]);

export function validateAttachmentMetadata(input: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (input.size <= 0 || input.size > MAX_ATTACHMENT_BYTES) {
    return "Attachments must be between 1 byte and 4 MB.";
  }
  const extension = input.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedExtensions = ACCEPTED_FILES.get(input.type);
  if (!allowedExtensions?.has(extension)) {
    return "Use PDF, DOCX, TXT, Markdown, JPEG, PNG, or WebP files.";
  }
  return null;
}

export function safeAttachmentName(name: string, fallbackExtension: string) {
  return (
    name
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}._ -]+/gu, "-")
      .replace(/\s+/g, "-")
      .slice(-180) || `attachment.${fallbackExtension}`
  );
}

