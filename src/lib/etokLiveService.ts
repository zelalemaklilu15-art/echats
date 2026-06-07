// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

/* ═══════════════════════════════════════════
   Types & constants
   ═══════════════════════════════════════════ */

export interface LiveGiftItem {
  id: string;
  emoji: string;
  name: string;
  coins: number;
  animationColor: string;
}

export interface EtokLiveStream {
  id: string;
  hostId: string;
  title: string;
  category: string;
  viewerCount: number;
  giftTotal: number;
  startedAt: string;
  thumbnailColor: string;
  thumbnailEmoji: string;
  isLive: boolean;
}

export interface LiveComment {
  id: string;
  streamId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  isGift?: boolean;
  giftEmoji?: string;
  createdAt: string;
}

export interface ScheduledLive {
  id: string;
  hostId: string;
  title: string;
  scheduledAt: string;
  category: string;
  thumbnailEmoji: string;
  reminderCount?: number;
  hasReminder?: boolean;
}

export const LIVE_GIFTS: LiveGiftItem[] = [
  { id: "lg1", emoji: "🌹", name: "Rose", coins: 1, animationColor: "#ff4444" },
  { id: "lg2", emoji: "🍭", name: "Lollipop", coins: 5, animationColor: "#ff88cc" },
  { id: "lg3", emoji: "🍩", name: "Doughnut", coins: 10, animationColor: "#ffaa00" },
  { id: "lg4", emoji: "🍦", name: "Ice Cream", coins: 30, animationColor: "#aaddff" },
  { id: "lg5", emoji: "💎", name: "Diamond", coins: 100, animationColor: "#88ddff" },
  { id: "lg6", emoji: "👑", name: "Crown", coins: 500, animationColor: "#ffd700" },
  { id: "lg7", emoji: "🚀", name: "Rocket", coins: 200, animationColor: "#ff6622" },
  { id: "lg8", emoji: "🦁", name: "Lion", coins: 50, animationColor: "#ffbb44" },
  { id: "lg9", emoji: "🌈", name: "Rainbow", coins: 150, animationColor: "#ff88ff" },
  { id: "lg10", emoji: "⚡", name: "Thunder", coins: 80, animationColor: "#ffff44" },
  { id: "lg11", emoji: "🏆", name: "Trophy", coins: 1000, animationColor: "#ffd700" },
  { id: "lg12", emoji: "🎆", name: "Fireworks", coins: 300, animationColor: "#ff4488" },
];

export const CATEGORIES = ["Music", "Gaming", "Food", "Education", "Comedy", "Dance", "Travel", "Fitness", "Art", "Fashion"];

const BG_COLORS = [
  "from-violet-900 to-purple-900",
  "from-rose-900 to-pink-900",
  "from-blue-900 to-indigo-900",
  "from-emerald-900 to-teal-900",
  "from-orange-900 to-red-900",
  "from-cyan-900 to-blue-900",
];

/* ═══════════════════════════════════════════
   Mappers
   ═══════════════════════════════════════════ */

function mapStream(row: any): EtokLiveStream {
  return {
    id: row.id,
    hostId: row.host_id,
    title: row.title,
    category: row.category,
    viewerCount: row.viewer_count ?? 0,
    giftTotal: row.gift_total ?? 0,
    startedAt: row.started_at,
    thumbnailColor: row.thumbnail_color ?? BG_COLORS[0],
    thumbnailEmoji: row.thumbnail_emoji ?? "📡",
    isLive: row.is_live ?? false,
  };
}

function mapComment(row: any): LiveComment {
  return {
    id: row.id,
    streamId: row.stream_id,
    authorId: row.author_id,
    authorName: row.profiles?.username ?? row.profiles?.name ?? "user",
    authorAvatar: row.profiles?.avatar_url ?? "👤",
    text: row.text,
    isGift: row.is_gift,
    giftEmoji: row.gift_emoji,
    createdAt: row.created_at,
  };
}

function mapScheduled(row: any): ScheduledLive {
  return {
    id: row.id,
    hostId: row.host_id,
    title: row.title,
    scheduledAt: row.scheduled_at,
    category: row.category,
    thumbnailEmoji: row.thumbnail_emoji ?? "📅",
  };
}

/* ═══════════════════════════════════════════
   Streams
   ═══════════════════════════════════════════ */

export async function fetchActiveLives(): Promise<EtokLiveStream[]> {
  const { data, error } = await supabase
    .from("etok_live_streams")
    .select("*")
    .eq("is_live", true)
    .order("viewer_count", { ascending: false })
    .limit(50);
  if (error) { console.error("[EtokLive] fetch lives:", error); return []; }
  return (data ?? []).map(mapStream);
}

export async function fetchLiveById(id: string): Promise<EtokLiveStream | null> {
  const { data } = await supabase.from("etok_live_streams").select("*").eq("id", id).maybeSingle();
  return data ? mapStream(data) : null;
}

export async function startLiveAsync(hostId: string, title: string, category: string): Promise<EtokLiveStream | null> {
  const { data, error } = await supabase
    .from("etok_live_streams")
    .insert({
      host_id: hostId,
      title,
      category,
      thumbnail_color: BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)],
      thumbnail_emoji: "📡",
      viewer_count: 1,
    })
    .select("*")
    .single();
  if (error) { console.error("[EtokLive] start:", error); return null; }
  return mapStream(data);
}

export async function endLiveAsync(streamId: string): Promise<void> {
  await supabase.from("etok_live_streams")
    .update({ is_live: false, ended_at: new Date().toISOString() })
    .eq("id", streamId);
}

export async function joinLiveAsync(streamId: string, userId: string): Promise<void> {
  await supabase.from("etok_live_viewers").upsert({ stream_id: streamId, user_id: userId });
  // refresh viewer count from actual viewers
  const { count } = await supabase.from("etok_live_viewers")
    .select("*", { count: "exact", head: true })
    .eq("stream_id", streamId);
  await supabase.from("etok_live_streams").update({ viewer_count: count ?? 1 }).eq("id", streamId);
}

export async function leaveLiveAsync(streamId: string, userId: string): Promise<void> {
  await supabase.from("etok_live_viewers")
    .delete()
    .eq("stream_id", streamId)
    .eq("user_id", userId);
  const { count } = await supabase.from("etok_live_viewers")
    .select("*", { count: "exact", head: true })
    .eq("stream_id", streamId);
  await supabase.from("etok_live_streams").update({ viewer_count: Math.max(0, count ?? 0) }).eq("id", streamId);
}

/* ═══════════════════════════════════════════
   Comments
   ═══════════════════════════════════════════ */

export async function fetchLiveComments(streamId: string): Promise<LiveComment[]> {
  const { data, error } = await supabase
    .from("etok_live_comments")
    .select("*, profiles!etok_live_comments_author_id_fkey(username, name, avatar_url)")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    // Fallback without profile join if FK not configured
    const { data: bare } = await supabase
      .from("etok_live_comments")
      .select("*")
      .eq("stream_id", streamId)
      .order("created_at", { ascending: false })
      .limit(100);
    return (bare ?? []).reverse().map(mapComment);
  }
  return (data ?? []).reverse().map(mapComment);
}

export async function addLiveCommentAsync(
  streamId: string,
  authorId: string,
  text: string,
  isGift?: boolean,
  giftEmoji?: string
): Promise<void> {
  await supabase.from("etok_live_comments").insert({
    stream_id: streamId,
    author_id: authorId,
    text,
    is_gift: isGift ?? false,
    gift_emoji: giftEmoji ?? null,
  });
}

/* ═══════════════════════════════════════════
   Coins & Gifts
   ═══════════════════════════════════════════ */

export async function getCoinsBalanceAsync(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_or_create_etok_coins" as any);
  if (error) {
    console.error("[EtokLive] coins:", error);
    return 0;
  }
  return Number(data ?? 0);
}

export async function addCoinsAsync(userId: string, amount: number): Promise<number> {
  return getCoinsBalanceAsync(userId);
}

export async function deductCoinsAsync(userId: string, amount: number): Promise<boolean> {
  const balance = await getCoinsBalanceAsync(userId);
  return balance >= amount;
}

export async function sendLiveGiftAsync(
  streamId: string,
  giftId: string,
  senderId: string,
  recipientId: string
): Promise<boolean> {
  const gift = LIVE_GIFTS.find(g => g.id === giftId);
  if (!gift) return false;
  const { data, error } = await supabase.rpc("send_etok_live_gift" as any, {
    p_stream_id: streamId,
    p_gift_id: giftId,
    p_recipient_id: recipientId,
    p_gift_emoji: gift.emoji,
    p_gift_name: gift.name,
    p_coins: gift.coins,
  });
  if (error) {
    console.error("[EtokLive] send gift:", error);
    return false;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return !!row?.success;
}

/* ═══════════════════════════════════════════
   Scheduled lives
   ═══════════════════════════════════════════ */

export async function fetchScheduledLives(currentUserId?: string): Promise<ScheduledLive[]> {
  const { data } = await supabase
    .from("etok_scheduled_lives")
    .select("*")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(20);
  const list = (data ?? []).map(mapScheduled);
  if (!currentUserId || list.length === 0) return list;
  const { data: rems } = await supabase
    .from("etok_scheduled_reminders")
    .select("scheduled_id")
    .eq("user_id", currentUserId);
  const remSet = new Set((rems ?? []).map(r => r.scheduled_id));
  return list.map(s => ({ ...s, hasReminder: remSet.has(s.id) }));
}

export async function scheduleLiveAsync(hostId: string, title: string, scheduledAt: string, category: string): Promise<ScheduledLive | null> {
  const { data, error } = await supabase
    .from("etok_scheduled_lives")
    .insert({ host_id: hostId, title, scheduled_at: scheduledAt, category, thumbnail_emoji: "📅" })
    .select("*")
    .single();
  if (error) { console.error(error); return null; }
  return mapScheduled(data);
}

export async function toggleReminderAsync(scheduledId: string, userId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from("etok_scheduled_reminders")
    .select("scheduled_id")
    .eq("scheduled_id", scheduledId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    await supabase.from("etok_scheduled_reminders").delete().eq("scheduled_id", scheduledId).eq("user_id", userId);
    return false;
  }
  await supabase.from("etok_scheduled_reminders").insert({ scheduled_id: scheduledId, user_id: userId });
  return true;
}

/* ═══════════════════════════════════════════
   WebRTC signaling
   ═══════════════════════════════════════════ */

export async function sendWebRTCSignal(
  streamId: string,
  fromUserId: string,
  toUserId: string,
  signalType: "offer" | "answer" | "ice" | "request",
  payload: any
): Promise<void> {
  await supabase.from("etok_webrtc_signals").insert({
    stream_id: streamId,
    from_user_id: fromUserId,
    to_user_id: toUserId,
    signal_type: signalType,
    payload,
  });
}

export function subscribeToWebRTCSignals(
  userId: string,
  handler: (signal: { id: string; streamId: string; fromUserId: string; signalType: string; payload: any }) => void
) {
  const channel = supabase
    .channel(`rtc-${userId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "etok_webrtc_signals",
      filter: `to_user_id=eq.${userId}`,
    }, async (payload: any) => {
      const row = payload.new;
      handler({
        id: row.id,
        streamId: row.stream_id,
        fromUserId: row.from_user_id,
        signalType: row.signal_type,
        payload: row.payload,
      });
      // Cleanup processed signal
      await supabase.from("etok_webrtc_signals").delete().eq("id", row.id);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/* ═══════════════════════════════════════════
   Realtime channel helpers
   ═══════════════════════════════════════════ */

export function subscribeLiveComments(streamId: string, onNew: (c: LiveComment) => void) {
  const channel = supabase
    .channel(`live-comments-${streamId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "etok_live_comments",
      filter: `stream_id=eq.${streamId}`,
    }, async (payload: any) => {
      const row = payload.new;
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, name, avatar_url")
        .eq("id", row.author_id)
        .maybeSingle();
      onNew(mapComment({ ...row, profiles: profile }));
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function subscribeStreamUpdates(streamId: string, onUpdate: (s: EtokLiveStream) => void) {
  const channel = supabase
    .channel(`live-stream-${streamId}`)
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "etok_live_streams",
      filter: `id=eq.${streamId}`,
    }, (payload: any) => onUpdate(mapStream(payload.new)))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

