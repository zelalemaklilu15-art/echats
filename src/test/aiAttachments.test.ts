import { describe, it, expect } from "vitest";
import { validateAttachments, checkAttachmentFile } from "../../supabase/functions/_shared/aiAttachments";

const U = "11111111-1111-1111-1111-111111111111";

describe("AI attachments", () => {
  it("rejects files in another user's folder", () => {
    expect(validateAttachments([{ path: "22222222-x/a.png", mime: "image/png" }], U)).toBe("Attachment not allowed");
  });
  it("accepts own files", () => {
    const r = validateAttachments([{ path: `${U}/a.png`, mime: "image/png", name: "a.png" }], U);
    expect(Array.isArray(r) && r.length).toBe(1);
  });
  it("allows at most 4 files", () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ path: `${U}/${i}.png`, mime: "image/png" }));
    expect(typeof validateAttachments(five, U)).toBe("string");
  });
  it("limits images to 10MB and documents to 20MB", () => {
    expect(checkAttachmentFile("image/png", 10 * 1024 * 1024 + 1)).not.toBeNull();
    expect(checkAttachmentFile("application/pdf", 15 * 1024 * 1024)).toBeNull();
    expect(checkAttachmentFile("application/pdf", 20 * 1024 * 1024 + 1)).not.toBeNull();
  });
});
