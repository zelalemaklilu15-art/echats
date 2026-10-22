import { supabase } from "@/integrations/supabase/client";
import { isNative } from "@/lib/native";

/** Transfers above this amount (ETB) also need a fresh email code. */
export const HIGH_RISK_TRANSFER_ETB = 5000;
export const AIRTIME_MIN_ETB = 5;
export const AIRTIME_MAX_ETB = 1000;

export const isValidPinFormat = (pin: string) => /^(\d{4}|\d{6})$/.test(pin);
export const needsStepUpForTransfer = (amount: number) => amount > HIGH_RISK_TRANSFER_ETB;

export function normalizeEthiopianPhone(raw: string): string | null {
  const v = raw.replace(/[\s-]/g, "");
  if (/^\+?251[79]\d{8}$/.test(v)) return "0" + v.slice(-9);
  if (/^0[79]\d{8}$/.test(v)) return v;
  return null;
}

const DEVICE_KEY = "echat_device_id";

/** Stable per-device ID: native hardware ID on Android/iOS, stored random ID on web. */
export async function getDeviceId(): Promise<string> {
  if (isNative()) {
    try {
      const { Device } = await import("@capacitor/device");
      const { identifier } = await Device.getId();
      if (identifier) return `native-${identifier}`;
    } catch (e) { console.warn("device id", e); }
  }
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch { return ""; }
}

export async function checkWalletDevice(): Promise<"trusted" | "step_up_required"> {
  const id = await getDeviceId();
  const { data, error } = await supabase.rpc("check_wallet_device", { p_device_id: id });
  if (error) throw error;
  if (data !== 'trusted' && data !== 'step_up_required') throw new Error('Could not verify this device');
  return data;
}

/** Sends a one-time code to the signed-in user's email (step-up only). */
export async function sendStepUpCode(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("No email on this account");
  const { error } = await supabase.auth.signInWithOtp({ email: user.email, options: { shouldCreateUser: false } });
  if (error) throw error;
  return user.email;
}

export async function verifyStepUpCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
  if (error) throw error;
}

export function newIdempotencyKey(prefix = "tx"): string {
  return `${prefix}-${crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

export async function buyAirtime(phone: string, amount: number, pin: string, key: string) {
  const { data, error } = await supabase.rpc("airtime_topup", {
    p_phone: phone, p_amount: amount, p_pin: pin, p_idempotency_key: key, p_device: await getDeviceId(),
  });
  if (error) return { success: false, error: "Top-up failed. Please try again." };
  const row = (Array.isArray(data) ? data[0] : data) as { success: boolean; error: string | null; balance: number | null; topup_id: string | null };
  return { success: !!row?.success, error: row?.error ?? undefined, balance: row?.balance ?? undefined, topupId: row?.topup_id ?? undefined };
}
