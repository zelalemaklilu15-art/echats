import { supabase } from "@/integrations/supabase/client";

export type VerificationBadge = "official" | "press" | "business" | "government" | "premium";

export interface VerifiedAccount {
  userId: string;
  badge: VerificationBadge;
  verifiedBy: string;
  verifiedAt: string;
  description?: string;
}

const BADGE_CONFIG: Record<VerificationBadge, { label: string; color: string; icon: string }> = {
  official:   { label: "Official",   color: "text-blue-500",   icon: "✓" },
  press:      { label: "Press",      color: "text-green-500",  icon: "📰" },
  business:   { label: "Business",   color: "text-purple-500", icon: "💼" },
  government: { label: "Government", color: "text-red-500",    icon: "🏛️" },
  premium:    { label: "Premium",    color: "text-yellow-500", icon: "⭐" },
};

export function getBadgeConfig(badge: VerificationBadge) {
  return BADGE_CONFIG[badge];
}

// In-memory cache hydrated from the server. Verification badges are now stored
// in the `user_verifications` table and can only be written by the backend
// (service role). Client cannot self-grant badges.
const cache = new Map<string, VerifiedAccount | null>();
const inflight = new Map<string, Promise<void>>();

async function loadOne(userId: string): Promise<void> {
  if (inflight.has(userId)) return inflight.get(userId)!;
  const p = (async () => {
    const { data } = await supabase
      .from("user_verifications")
      .select("user_id, badge, verified_by, description, created_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      cache.set(userId, {
        userId: data.user_id,
        badge: data.badge as VerificationBadge,
        verifiedBy: data.verified_by ?? "system",
        verifiedAt: data.created_at ?? new Date().toISOString(),
        description: data.description ?? undefined,
      });
    } else {
      cache.set(userId, null);
    }
  })();
  inflight.set(userId, p);
  try { await p; } finally { inflight.delete(userId); }
}

export async function preloadVerifications(userIds: string[]): Promise<void> {
  const missing = userIds.filter((id) => id && !cache.has(id));
  if (!missing.length) return;
  const { data } = await supabase
    .from("user_verifications")
    .select("user_id, badge, verified_by, description, created_at")
    .in("user_id", missing);
  const seen = new Set<string>();
  (data ?? []).forEach((r: any) => {
    seen.add(r.user_id);
    cache.set(r.user_id, {
      userId: r.user_id,
      badge: r.badge,
      verifiedBy: r.verified_by ?? "system",
      verifiedAt: r.created_at ?? new Date().toISOString(),
      description: r.description ?? undefined,
    });
  });
  missing.forEach((id) => { if (!seen.has(id)) cache.set(id, null); });
}

/** Synchronous read from cache. Returns null if not yet preloaded. */
export function getVerification(userId: string): VerifiedAccount | null {
  if (!cache.has(userId)) {
    // Kick off a lazy load; UI will refresh on next render cycle.
    void loadOne(userId);
    return null;
  }
  return cache.get(userId) ?? null;
}

export async function getVerificationAsync(userId: string): Promise<VerifiedAccount | null> {
  if (!cache.has(userId)) await loadOne(userId);
  return cache.get(userId) ?? null;
}

export function isPremiumUser(userId: string): boolean {
  return getVerification(userId)?.badge === "premium";
}

// Client-side write helpers are intentionally disabled. Badges are managed
// server-side only (service role). Any attempt from the client will throw.
export function addVerification(): void {
  throw new Error("Verification badges are managed by the server and cannot be granted from the client.");
}
export function removeVerification(): void {
  throw new Error("Verification badges are managed by the server and cannot be revoked from the client.");
}
export function setPremiumStatus(): void {
  throw new Error("Premium status can only be granted server-side after payment confirmation.");
}
