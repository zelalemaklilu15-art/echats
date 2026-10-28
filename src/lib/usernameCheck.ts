import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UsernameStatus = "available" | "taken" | "invalid";

export const USERNAME_RULE = "Use 3–30 characters: a–z, 0–9 and _ only";

/** Lowercase, strip spaces and a leading @. */
export function normalizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, "").replace(/^@+/, "");
}

export function isValidUsernameFormat(name: string): boolean {
  return /^[a-z0-9_]{3,30}$/.test(name);
}

export function usernameMessage(status: UsernameStatus): string {
  if (status === "taken") return "Username already taken";
  if (status === "invalid") return USERNAME_RULE;
  return "Username is available";
}

/** Ask the server. Throws when the check itself fails (never reports a false "taken"). */
export async function checkUsername(raw: string): Promise<UsernameStatus> {
  const name = normalizeUsername(raw);
  if (!isValidUsernameFormat(name)) return "invalid";
  const { data, error } = await supabase.rpc("check_username", { p_username: name });
  if (error) {
    console.error("Error checking username:", error);
    throw new Error("Couldn't check the username. Please try again.");
  }
  return data === "taken" ? "taken" : data === "available" ? "available" : "invalid";
}

/** True when a signup/profile error is the unique-username conflict. */
export function isUsernameConflictError(err: unknown): boolean {
  const m = String((err as any)?.message || "").toLowerCase();
  return m.includes("profiles_username_key") || m.includes("database error saving new user") || ((err as any)?.code === "23505");
}

/** Debounced live check while typing. `skip` = current own username. */
export function useUsernameCheck(raw: string, skip?: string | null) {
  const [status, setStatus] = useState<UsernameStatus | "checking" | "error" | null>(null);
  useEffect(() => {
    const name = normalizeUsername(raw);
    if (!name) { setStatus(null); return; }
    if (skip && name === skip) { setStatus("available"); return; }
    if (!isValidUsernameFormat(name)) { setStatus("invalid"); return; }
    setStatus("checking");
    let alive = true;
    const t = setTimeout(() => {
      checkUsername(name).then((s) => alive && setStatus(s)).catch(() => alive && setStatus("error"));
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [raw, skip]);
  return status;
}
