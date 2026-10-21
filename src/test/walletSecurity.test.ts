import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/native", () => ({ isNative: () => false }));
import { isValidPinFormat, needsStepUpForTransfer, normalizeEthiopianPhone, HIGH_RISK_TRANSFER_ETB } from "@/lib/walletSecurity";

describe("wallet security rules", () => {
  it("PIN must be exactly 4 or 6 digits", () => {
    expect(isValidPinFormat("1234")).toBe(true);
    expect(isValidPinFormat("123456")).toBe(true);
    expect(isValidPinFormat("12345")).toBe(false);
    expect(isValidPinFormat("12a4")).toBe(false);
  });
  it("email code only for transfers above 5000 ETB", () => {
    expect(HIGH_RISK_TRANSFER_ETB).toBe(5000);
    expect(needsStepUpForTransfer(5000)).toBe(false);
    expect(needsStepUpForTransfer(5000.01)).toBe(true);
  });
  it("normalizes Ethiopian mobile numbers", () => {
    expect(normalizeEthiopianPhone("+251911223344")).toBe("0911223344");
    expect(normalizeEthiopianPhone("0711223344")).toBe("0711223344");
    expect(normalizeEthiopianPhone("0511223344")).toBeNull();
  });
});
