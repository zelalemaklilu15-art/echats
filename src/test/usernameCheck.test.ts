import { describe, it, expect, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import { checkUsername, normalizeUsername } from "@/lib/usernameCheck";

describe("username check", () => {
  it("reports a free name as available", async () => {
    rpc.mockResolvedValueOnce({ data: "available", error: null });
    expect(await checkUsername("NewName")).toBe("available");
  });
  it("reports an existing name as taken", async () => {
    rpc.mockResolvedValueOnce({ data: "taken", error: null });
    expect(await checkUsername("zelalem")).toBe("taken");
  });
  it("reports bad format as invalid, not taken", async () => {
    expect(await checkUsername("ab")).toBe("invalid");
    expect(await checkUsername("my.name")).toBe("invalid");
  });
  it("a failed check throws instead of saying taken", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied" } });
    await expect(checkUsername("goodname")).rejects.toThrow();
  });
  it("normalizes spaces, caps and @", () => {
    expect(normalizeUsername("@My Name")).toBe("myname");
  });
});
