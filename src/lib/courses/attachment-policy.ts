export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

const ACCEPTED_FILES = new Map<string, ReadonlySet<string>>([
  ["application/pdf", new Set(["pdf"])],
  ["image/jpeg", new Set(["jpg", "jpeg"])],
  ["image/png", new Set(["png"])],
  ["image/webp", new Set(["webp"])],
  ["text/plain", new Set(["txt"])],
  ["text/markdown", new Set(["md", "markdown"])],
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
    return "Use PDF, TXT, Markdown, JPEG, PNG, or WebP files.";
  }
  return null;
}

export function validateAttachmentBytes(
  input: Uint8Array,
  mimeType: string,
): string | null {
  const startsWith = (signature: number[]) =>
    signature.every((byte, index) => input[index] === byte);
  const valid =
    mimeType === "application/pdf"
      ? startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])
      : mimeType === "image/jpeg"
        ? startsWith([0xff, 0xd8, 0xff])
        : mimeType === "image/png"
          ? startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
          : mimeType === "image/webp"
            ? startsWith([0x52, 0x49, 0x46, 0x46]) &&
              input[8] === 0x57 &&
              input[9] === 0x45 &&
              input[10] === 0x42 &&
              input[11] === 0x50
            : mimeType === "text/plain" || mimeType === "text/markdown"
              ? !input.subarray(0, 8_192).includes(0)
              : false;
  return valid ? null : "The file contents do not match the declared type.";
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
