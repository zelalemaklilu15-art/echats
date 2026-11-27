import { supabase } from "@/integrations/supabase/client";
import { getDeviceId, isValidPinFormat, normalizeEthiopianPhone } from "@/lib/walletSecurity";

export const WITHDRAWAL_MIN_ETB = 50;
export const WITHDRAWAL_MAX_ETB = 5000; // Existing server limit; larger withdrawals are not enabled.
export const WITHDRAWAL_FEE_ETB = 0;
export type WithdrawalProvider = "telebirr" | "ebirr";
export interface Withdrawal {
  id: string; provider: WithdrawalProvider; phone: string; amount: number;
  status: "pending" | "sent" | "rejected"; created_at: string; payout_ref: string | null;
}
export function validWithdrawalAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount >= WITHDRAWAL_MIN_ETB && amount <= WITHDRAWAL_MAX_ETB
    && Math.abs(amount * 100 - Math.round(amount * 100)) < 0.0000001;
}
export function withdrawalPayload(provider: WithdrawalProvider, phone: string, amount: number): string {
  return JSON.stringify([provider, normalizeEthiopianPhone(phone), amount]);
}
export async function requestWithdrawal(owner: string, provider: WithdrawalProvider, phone: string, amount: number, pin: string, key: string) {
  const normalized = normalizeEthiopianPhone(phone);
  if (!normalized || !validWithdrawalAmount(amount) || !isValidPinFormat(pin) || !["telebirr", "ebirr"].includes(provider)) {
    return { success: false, error: "Check the amount, mobile number and PIN." };
  }
  const device = await getDeviceId();
  const { data: { session } } = await supabase.auth.getSession();
  if (!owner || session?.user.id !== owner) return { success: false, error: "Account changed. Please retry." };
  const { data, error } = await (supabase.rpc as Function)("wallet_request_withdrawal", {
    p_amount: amount, p_provider: provider, p_phone: normalized, p_pin: pin, p_device: device, p_key: key,
  });
  if (error) return { success: false, error: "Could not confirm the request. Retry with the same details." };
  return data as { success: boolean; error?: string; withdrawal_id?: string; duplicate?: boolean };
}

export async function listWithdrawals(owner: string): Promise<Withdrawal[]> {
  const { data, error } = await supabase.from("mm_withdrawals" as never)
    .select("id,provider,phone,amount,status,created_at,payout_ref").eq("user_id", owner)
    .order("created_at", { ascending: false }).limit(10);
  if (error) throw error;
  return (data ?? []) as unknown as Withdrawal[];
}