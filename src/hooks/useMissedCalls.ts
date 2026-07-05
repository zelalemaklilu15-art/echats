// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

function getSeenKey(userId: string): string {
  return `echat_last_seen_calls_at_${userId}`;
}

function getLastSeenAt(userId: string): string | null {
  return localStorage.getItem(getSeenKey(userId));
}

export function useMissedCalls() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [version, setVersion] = useState(0);

  const markAsSeen = useCallback(() => {
    if (!user?.id) return;
    localStorage.setItem(getSeenKey(user.id), new Date().toISOString());
    setCount(0);
    setVersion(v => v + 1);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const fetchMissed = async () => {
      const lastSeen = getLastSeenAt(user.id);
      let query = supabase
        .from("call_logs")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("status", "missed");

      if (lastSeen) {
        query = query.gt("created_at", lastSeen);
      }

      const { count: missedCount } = await query;
      setCount(missedCount || 0);
    };

    const initialFetch = window.setTimeout(() => {
      fetchMissed();
    }, 2500);

    const channel = supabase
      .channel(`missed-calls-badge-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_logs",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          fetchMissed();
        }
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialFetch);
      supabase.removeChannel(channel);
    };
  }, [user?.id, version]);

  return { missedCount: count, markCallsAsSeen: markAsSeen };
}
