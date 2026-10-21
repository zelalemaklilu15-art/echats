// Fetches and caches ephemeral ICE servers (STUN + TURN) from the edge function.
// Auto-refreshes when TTL is near expiry.
import { supabase } from "@/integrations/supabase/client";

const FALLBACK: RTCIceServer[] = [
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.l.google.com:19302" },
];

interface CachedIce {
  iceServers: RTCIceServer[];
  expiresAt: number; // epoch ms
}

let cache: CachedIce | null = null;
let inflight: Promise<RTCIceServer[]> | null = null;

export async function getEtokIceServers(): Promise<RTCIceServer[]> {
  // Return cached if still fresh (>2 min remaining)
  if (cache && cache.expiresAt - Date.now() > 120_000) {
    return cache.iceServers;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const request = supabase.functions.invoke<{
        iceServers: RTCIceServer[];
        ttl: number;
        source: string;
      }>("etok-turn-credentials", { body: {} });

      // Never let a slow edge function stall call setup.
      const result = await Promise.race([
        request,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 9000)),
      ]);

      if (!result) {
        console.warn("[ICE] credentials timed out, using fallback");
        return FALLBACK;
      }

      const { data, error } = result;
      if (error || !data?.iceServers?.length) {
        console.warn("[ICE] using fallback:", error);
        return FALLBACK;
      }

      const hasTurn = data.iceServers.some((s) =>
        (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => String(u).startsWith("turn")),
      );
      if (!hasTurn) {
        // STUN-only usually fails between two mobile networks; don't cache it so
        // the next call retries for a relay server.
        console.warn("[ICE] no TURN relay returned (source:", data.source, ")");
        return data.iceServers;
      }
      cache = {
        iceServers: data.iceServers,
        expiresAt: Date.now() + (data.ttl ?? 3600) * 1000,
      };
      return cache.iceServers;
    } catch (e) {
      console.warn("[ICE] fetch failed, using fallback:", e);
      return FALLBACK;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
