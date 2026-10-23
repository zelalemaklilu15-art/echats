import { supabase } from "@/integrations/supabase/client";

export type TwoStepResult = { ok: boolean; error?: string; enabled?: boolean; verified?: boolean; email?: string; remaining?: number };

export async function callEmailTwoStep(body: Record<string, unknown>): Promise<TwoStepResult> {
  const { data, error } = await supabase.functions.invoke("email-2fa", { body });
  if (error) return { ok: false, error: "NETWORK" };
  return data as TwoStepResult;
}

export function twoStepMessage(error?: string, remaining?: number): string {
  switch (error) {
    case "WAIT": return "Please wait a minute before requesting another code.";
    case "LOCKED": return "Too many wrong codes. Try again in 10 minutes.";
    case "WRONG_CODE": return remaining != null ? `Wrong or expired code. ${remaining} tries left.` : "Wrong or expired code.";
    case "SEND_FAILED": return "Could not send the email code. Try again.";
    default: return "Something went wrong. Try again.";
  }
}
