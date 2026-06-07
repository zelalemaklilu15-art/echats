// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { formatLastSeen, isUserOnline } from "@/lib/formatLastSeen";

// ---------- Mocks for usePresence ----------
const eqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ update: updateMock }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: any[]) => fromMock(...a) },
}));

let myStatus = "online";
vi.mock("@/lib/availabilityService", () => ({
  getMyStatus: () => myStatus,
}));

import { usePresence } from "@/hooks/usePresence";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}
function setOnline(v: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => v });
  window.dispatchEvent(new Event(v ? "online" : "offline"));
}

describe("formatLastSeen / isUserOnline", () => {
  it("treats fresh heartbeat as online", () => {
    const fresh = new Date(Date.now() - 10_000).toISOString();
    expect(isUserOnline(fresh, true)).toBe(true);
    expect(formatLastSeen(fresh, true)).toBe("Online");
  });

  it("treats stale heartbeat as offline even if is_online=true", () => {
    const stale = new Date(Date.now() - 5 * 60_000).toISOString(); // 5 min
    expect(isUserOnline(stale, true)).toBe(false);
    expect(formatLastSeen(stale, true)).toMatch(/Last seen \d+m ago/);
  });

  it("never says online when is_online=false", () => {
    const fresh = new Date(Date.now() - 5_000).toISOString();
    expect(isUserOnline(fresh, false)).toBe(false);
  });

  it("formats minutes / hours / days", () => {
    const min = new Date(Date.now() - 3 * 60_000).toISOString();
    const hour = new Date(Date.now() - 2 * 3600_000).toISOString();
    const day = new Date(Date.now() - 2 * 86400_000).toISOString();
    expect(formatLastSeen(min, false)).toBe("Last seen 3m ago");
    expect(formatLastSeen(hour, false)).toBe("Last seen 2h ago");
    expect(formatLastSeen(day, false)).toBe("Last seen 2d ago");
  });

  it("returns empty when no last_seen and offline", () => {
    expect(formatLastSeen(null, false)).toBe("");
  });
});

describe("usePresence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockClear();
    myStatus = "online";
    setVisibility("visible");
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks online on mount with last_seen", async () => {
    renderHook(() => usePresence("user-1"));
    await Promise.resolve();
    expect(fromMock).toHaveBeenCalledWith("profiles");
    const payload = updateMock.mock.calls[0][0];
    expect(payload.is_online).toBe(true);
    expect(typeof payload.last_seen).toBe("string");
    expect(eqMock).toHaveBeenCalledWith("id", "user-1");
  });

  it("heartbeats every 25s while visible", async () => {
    renderHook(() => usePresence("user-1"));
    await Promise.resolve();
    const initial = updateMock.mock.calls.length;
    act(() => { vi.advanceTimersByTime(26_000); });
    await Promise.resolve();
    expect(updateMock.mock.calls.length).toBeGreaterThan(initial);
  });

  it("marks offline when tab becomes hidden", async () => {
    renderHook(() => usePresence("user-1"));
    await Promise.resolve();
    updateMock.mockClear();
    act(() => { setVisibility("hidden"); });
    await Promise.resolve();
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ is_online: false }),
    );
  });

  it("marks offline when network goes offline", async () => {
    renderHook(() => usePresence("user-1"));
    await Promise.resolve();
    updateMock.mockClear();
    act(() => { setOnline(false); });
    await Promise.resolve();
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ is_online: false }),
    );
  });

  it("respects invisible availability status", async () => {
    myStatus = "invisible";
    renderHook(() => usePresence("user-1"));
    await Promise.resolve();
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ is_online: false }),
    );
  });

  it("marks offline on unmount", async () => {
    const { unmount } = renderHook(() => usePresence("user-1"));
    await Promise.resolve();
    updateMock.mockClear();
    unmount();
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ is_online: false }),
    );
  });

  it("does nothing without a userId", () => {
    renderHook(() => usePresence(undefined));
    expect(fromMock).not.toHaveBeenCalled();
  });
});
