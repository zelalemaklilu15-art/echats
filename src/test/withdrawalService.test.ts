import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, auth: { getSession: mocks.getSession } } }));
vi.mock("@/lib/native", () => ({ isNative: () => false }));
import { requestWithdrawal, validWithdrawalAmount, withdrawalPayload, WITHDRAWAL_FEE_ETB } from "@/lib/withdrawalService";
beforeEach(() => { vi.clearAllMocks(); mocks.getSession.mockResolvedValue({data:{session:{user:{id:"owner"}}}}); mocks.rpc.mockResolvedValue({data:{success:true,withdrawal_id:"receipt"},error:null}); });
describe("withdrawal client", () => {
  it("accepts minimum 50 ETB but not 49.99", () => { expect(validWithdrawalAmount(50)).toBe(true); expect(validWithdrawalAmount(49.99)).toBe(false); });
  it("has zero service fee", () => expect(WITHDRAWAL_FEE_ETB).toBe(0));
  it.each([5000.01, NaN, Infinity, 50.001])("rejects unsupported amount %s", amount => expect(validWithdrawalAmount(amount)).toBe(false));
  it("requires a formatted PIN without invoking payment", async () => { expect((await requestWithdrawal("owner","telebirr","0911223344",50,"","key-12345")).success).toBe(false); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it.each(["telebirr", "ebirr"] as const)("sends %s request with PIN and normalized phone to authorized RPC", async provider => {
    expect((await requestWithdrawal("owner",provider,"+251911223344",50,"1234","key-12345")).success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("wallet_request_withdrawal",expect.objectContaining({p_amount:50,p_provider:provider,p_phone:"0911223344",p_pin:"1234",p_key:"key-12345"}));
  });
  it("rejects account changes before invoking payment", async () => { mocks.getSession.mockResolvedValue({data:{session:{user:{id:"other"}}}}); expect((await requestWithdrawal("owner","telebirr","0911223344",50,"1234","key-12345")).success).toBe(false); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it("uses different payload identities for changed destination or amount", () => { const key=withdrawalPayload("telebirr","0911223344",50); expect(withdrawalPayload("telebirr","+251911223344",50)).toBe(key); expect(withdrawalPayload("ebirr","0911223344",50)).not.toBe(key); expect(withdrawalPayload("telebirr","0911223344",60)).not.toBe(key); expect(withdrawalPayload("telebirr","0911223355",50)).not.toBe(key); });
});