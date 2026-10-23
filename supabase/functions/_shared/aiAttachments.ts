// Pure validation shared by the ai-chat function and tests (no Deno imports).
export const AI_ATTACH_MAX_FILES = 4;
export const AI_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const AI_DOC_MAX_BYTES = 20 * 1024 * 1024;
export const AI_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const AI_DOC_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export type AIAttachment = { path: string; name: string; mime: string; size?: number };

export function attachmentKind(mime: string): "image" | "doc" | null {
  if (AI_IMAGE_TYPES.includes(mime)) return "image";
  if (AI_DOC_TYPES.includes(mime)) return "doc";
  return null;
}

/** Returns an error message, or null when the file is acceptable. */
export function checkAttachmentFile(mime: string, size: number): string | null {
  const kind = attachmentKind(mime);
  if (!kind) return "Unsupported file type";
  const max = kind === "image" ? AI_IMAGE_MAX_BYTES : AI_DOC_MAX_BYTES;
  if (size <= 0) return "File is empty";
  if (size > max) return kind === "image" ? "Image is larger than 10MB" : "Document is larger than 20MB";
  return null;
}

/** Keeps only attachments stored under the caller's own folder. */
export function validateAttachments(raw: unknown, userId: string): AIAttachment[] | string {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return "Invalid attachments";
  if (raw.length > AI_ATTACH_MAX_FILES) return `Up to ${AI_ATTACH_MAX_FILES} files per message`;
  const out: AIAttachment[] = [];
  for (const a of raw) {
    if (!a || typeof a.path !== "string" || typeof a.mime !== "string") return "Invalid attachments";
    const path = a.path;
    if (!path.startsWith(`${userId}/`) || path.includes("..")) return "Attachment not allowed";
    if (!attachmentKind(a.mime)) return "Unsupported file type";
    out.push({ path, mime: a.mime, name: String(a.name || "file").slice(0, 200) });
  }
  return out;
}
