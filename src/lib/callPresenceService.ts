// Supabase Realtime Presence for call availability.
// A single global channel keeps track of which users currently have the app open,
// so an outgoing call can fail fast with "User is offline" instead of ringing forever.
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

const CHANNEL_NAME = 'presence:calls';

let channel: RealtimeChannel | null = null;
let joinedUserId: string | null = null;
let onlineIds = new Set<string>();
let readyPromise: Promise<void> | null = null;
const listeners = new Set<(ids: string[]) => void>();

function emit() {
  const ids = Array.from(onlineIds);
  listeners.forEach((fn) => fn(ids));
}

function syncFromState() {
  if (!channel) return;
  const state = channel.presenceState<{ user_id: string }>();
  const next = new Set<string>();
  Object.values(state).forEach((entries) => {
    entries.forEach((e: any) => {
      if (e?.user_id) next.add(e.user_id);
    });
  });
  onlineIds = next;
  emit();
}

/** Joins the shared presence channel and starts tracking the current user. */
export function joinCallPresence(userId: string): Promise<void> {
  if (joinedUserId === userId && readyPromise) return readyPromise;
  leaveCallPresence();

  joinedUserId = userId;
  channel = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: userId } },
  });

  readyPromise = new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    setTimeout(done, 6000);

    channel!
      .on('presence', { event: 'sync' }, syncFromState)
      .on('presence', { event: 'join' }, syncFromState)
      .on('presence', { event: 'leave' }, syncFromState)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel!.track({ user_id: userId, online_at: new Date().toISOString() });
          } catch (e) {
            console.warn('[CallPresence] track failed', e);
          }
          syncFromState();
          done();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          done();
        }
      });
  });

  return readyPromise;
}

export function leaveCallPresence() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  joinedUserId = null;
  readyPromise = null;
  onlineIds = new Set();
  emit();
}

/** True when the peer currently has an active realtime presence entry. */
export function isPeerAvailable(peerId: string): boolean {
  return onlineIds.has(peerId);
}

export function getOnlineUserIds(): string[] {
  return Array.from(onlineIds);
}

/** Whether presence data has been established at all (channel connected). */
export function isPresenceReady(): boolean {
  return !!channel && !!joinedUserId;
}

export function subscribeToCallPresence(fn: (ids: string[]) => void): () => void {
  listeners.add(fn);
  fn(Array.from(onlineIds));
  return () => listeners.delete(fn);
}
