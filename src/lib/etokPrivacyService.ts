// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export type VideoPrivacy = "everyone" | "friends" | "only_me";
export type InteractionPermission = "everyone" | "friends" | "no_one";

export interface EtokPrivacySettings {
  userId: string;
  privateAccount: boolean;
  isBusinessAccount: boolean;
  defaultVideoPrivacy: VideoPrivacy;
  allowComments: InteractionPermission;
  commentKeywords: string[];
  filterSpam: boolean;
  duetPermission: InteractionPermission;
  stitchPermission: InteractionPermission;
  allowDownload: boolean;
  screenTimeLimitMinutes: number;
  screenTimeReminderEnabled: boolean;
  screenTimeReminderIntervalMinutes: number;
  familyPairingLinked: boolean;
  familyPairingEmail: string;
}

export interface BlockedUser {
  blockerId: string;
  blockedId: string;
  blockedAt: string;
}

const SCREEN_TIME_KEY = "etok_screen_time"; // Per-device only — not synced

function defaultSettings(userId: string): EtokPrivacySettings {
  return {
    userId,
    privateAccount: false,
    isBusinessAccount: false,
    defaultVideoPrivacy: "everyone",
    allowComments: "everyone",
    commentKeywords: [],
    filterSpam: true,
    duetPermission: "everyone",
    stitchPermission: "everyone",
    allowDownload: true,
    screenTimeLimitMinutes: 0,
    screenTimeReminderEnabled: false,
    screenTimeReminderIntervalMinutes: 30,
    familyPairingLinked: false,
    familyPairingEmail: "",
  };
}

function fromRow(r: any): EtokPrivacySettings {
  return {
    userId: r.user_id,
    privateAccount: r.private_account,
    isBusinessAccount: r.is_business_account,
    defaultVideoPrivacy: r.default_video_privacy,
    allowComments: r.allow_comments,
    commentKeywords: r.comment_keywords ?? [],
    filterSpam: r.filter_spam,
    duetPermission: r.duet_permission,
    stitchPermission: r.stitch_permission,
    allowDownload: r.allow_download,
    screenTimeLimitMinutes: r.screen_time_limit_minutes,
    screenTimeReminderEnabled: r.screen_time_reminder_enabled,
    screenTimeReminderIntervalMinutes: r.screen_time_reminder_interval,
    familyPairingLinked: r.family_pairing_linked,
    familyPairingEmail: r.family_pairing_email ?? "",
  };
}

export async function getPrivacySettingsAsync(userId: string): Promise<EtokPrivacySettings> {
  const { data } = await supabase.from("etok_privacy_settings").select("*").eq("user_id", userId).maybeSingle();
  return data ? fromRow(data) : defaultSettings(userId);
}

export async function savePrivacySettingsAsync(s: EtokPrivacySettings): Promise<void> {
  const { error } = await supabase.from("etok_privacy_settings").upsert({
    user_id: s.userId,
    private_account: s.privateAccount,
    is_business_account: s.isBusinessAccount,
    default_video_privacy: s.defaultVideoPrivacy,
    allow_comments: s.allowComments,
    comment_keywords: s.commentKeywords,
    filter_spam: s.filterSpam,
    duet_permission: s.duetPermission,
    stitch_permission: s.stitchPermission,
    allow_download: s.allowDownload,
    screen_time_limit_minutes: s.screenTimeLimitMinutes,
    screen_time_reminder_enabled: s.screenTimeReminderEnabled,
    screen_time_reminder_interval: s.screenTimeReminderIntervalMinutes,
    family_pairing_linked: s.familyPairingLinked,
    family_pairing_email: s.familyPairingEmail,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function getBlockedUsersAsync(blockerId: string): Promise<BlockedUser[]> {
  const { data } = await supabase.from("etok_blocked_users").select("*").eq("blocker_id", blockerId);
  return (data ?? []).map(b => ({ blockerId: b.blocker_id, blockedId: b.blocked_id, blockedAt: b.blocked_at }));
}

export async function blockUserAsync(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from("etok_blocked_users").upsert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
}

export async function unblockUserAsync(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from("etok_blocked_users").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId);
  if (error) throw error;
}

export async function isBlockedAsync(blockerId: string, blockedId: string): Promise<boolean> {
  const { count } = await supabase.from("etok_blocked_users").select("*", { count: "exact", head: true })
    .eq("blocker_id", blockerId).eq("blocked_id", blockedId);
  return (count ?? 0) > 0;
}

export async function reportContentAsync(
  reporterId: string,
  contentType: "video" | "user" | "comment" | "live",
  contentId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.from("etok_reports").insert({
    reporter_id: reporterId, content_type: contentType, content_id: contentId, reason,
  });
  if (error) throw error;
}

/* Screen-time stays device-local (UI-only feature) */
export function getScreenTimeToday(): number {
  const today = new Date().toISOString().slice(0, 10);
  try { return (JSON.parse(localStorage.getItem(SCREEN_TIME_KEY) || "{}"))[today] ?? 0; } catch { return 0; }
}
export function addScreenTime(minutes: number): void {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const data = JSON.parse(localStorage.getItem(SCREEN_TIME_KEY) || "{}");
    data[today] = (data[today] ?? 0) + minutes;
    localStorage.setItem(SCREEN_TIME_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

export const SCREEN_TIME_OPTIONS = [
  { label: "No limit", value: 0 },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "4 hours", value: 240 },
];

export const REPORT_REASONS = [
  "Spam or misleading",
  "Nudity or sexual content",
  "Hate speech or discrimination",
  "Violence or dangerous acts",
  "Harassment or bullying",
  "Misinformation",
  "Intellectual property violation",
  "Other",
];

/* Sync compat shims */
export function getPrivacySettings(userId: string): EtokPrivacySettings { return defaultSettings(userId); }
export function savePrivacySettings(_s: EtokPrivacySettings): void {}
export function getBlockedUsers(_id: string): BlockedUser[] { return []; }
export function blockUser(_a: string, _b: string): void {}
export function unblockUser(_a: string, _b: string): void {}
export function isBlocked(_a: string, _b: string): boolean { return false; }
export function reportContent(_a: string, _b: any, _c: string, _d: string): void {}
export function isScreenTimeLimitReached(_id: string): boolean { return false; }
