// @ts-nocheck
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyStatus } from "@/lib/availabilityService";

const HEARTBEAT_MS = 25_000; // every 25s

async function setPresence(userId: string, online: boolean) {
  try {
    await supabase
      .from("profiles")
      .update({
        is_online: online,
        last_seen: new Date().toISOString(),
      })
      .eq("id", userId);
  } catch (e) {
    console.warn("[presence] update failed", e);
  }
}

/**
 * Keeps the current user's online status and last_seen fresh in real time.
 * - Heartbeat every 25s while the tab is visible
 * - Marks offline on tab hidden / page hide / browser offline
 * - Marks online on tab visible / browser online
 * - Respects "invisible" status from availabilityService
 */
export function usePresence(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const wantOnline = () => getMyStatus() !== "invisible";

    let heartbeat: number | undefined;

    const goOnline = () => {
      if (!wantOnline()) {
        setPresence(userId, false);
        return;
      }
      setPresence(userId, true);
      if (heartbeat) window.clearInterval(heartbeat);
      heartbeat = window.setInterval(() => {
        if (document.visibilityState === "visible" && navigator.onLine) {
          setPresence(userId, wantOnline());
        }
      }, HEARTBEAT_MS);
    };

    const goOffline = () => {
      if (heartbeat) {
        window.clearInterval(heartbeat);
        heartbeat = undefined;
      }
      setPresence(userId, false);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") goOnline();
      else goOffline();
    };

    const onOnline = () => goOnline();
    const onOffline = () => goOffline();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Initial
    if (document.visibilityState === "visible" && navigator.onLine) {
      goOnline();
    } else {
      goOffline();
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (heartbeat) window.clearInterval(heartbeat);
    };
  }, [userId]);
}
