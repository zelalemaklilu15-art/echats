import { supabase } from "@/integrations/supabase/client";

export interface GroupPermissions {
  groupId: string;
  canSendMessages: boolean;
  canSendMedia: boolean;
  canAddMembers: boolean;
  canPinMessages: boolean;
  canChangeInfo: boolean;
  slowModeSeconds: number;
}

export interface AdminAction {
  id: string;
  groupId: string;
  adminId: string;
  action: string;
  targetUserId: string;
  timestamp: string;
}

// Group presentation preferences (permissions/slow-mode) remain UI-only cached
// preferences — the backend does not currently enforce them.
const PERMISSIONS_KEY = "echat_group_permissions";
const ADMIN_LOG_KEY = "echat_admin_log";

function loadPermissions(): Record<string, GroupPermissions> {
  try { return JSON.parse(localStorage.getItem(PERMISSIONS_KEY) || "{}"); } catch { return {}; }
}
function savePermissions(data: Record<string, GroupPermissions>): void {
  localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(data));
}
function loadAdminLog(): AdminAction[] {
  try { return JSON.parse(localStorage.getItem(ADMIN_LOG_KEY) || "[]"); } catch { return []; }
}
function saveAdminLog(log: AdminAction[]): void {
  localStorage.setItem(ADMIN_LOG_KEY, JSON.stringify(log));
}

// ---------- SERVER-BACKED MUTE STATE ----------
// Mutes live in public.group_mutes and are enforced by a BEFORE INSERT trigger
// on public.group_messages. Only group admins can mute/unmute via the
// `mute_group_member` RPC. The client keeps an in-memory cache for UI badges.
const muteCache = new Map<string, Set<string>>(); // groupId -> muted userIds

export async function preloadGroupMutes(groupId: string): Promise<void> {
  const { data } = await supabase
    .from("group_mutes")
    .select("user_id, muted_until")
    .eq("group_id", groupId);
  const now = Date.now();
  const set = new Set<string>();
  (data ?? []).forEach((row: any) => {
    const until = row.muted_until ? new Date(row.muted_until).getTime() : Infinity;
    if (until > now) set.add(row.user_id);
  });
  muteCache.set(groupId, set);
}

export function isMemberMuted(groupId: string, userId: string): boolean {
  return muteCache.get(groupId)?.has(userId) ?? false;
}

export async function muteMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc("mute_group_member", {
    p_group_id: groupId, p_user_id: userId, p_mute: true, p_muted_until: null,
  });
  if (error) throw error;
  if (!muteCache.has(groupId)) muteCache.set(groupId, new Set());
  muteCache.get(groupId)!.add(userId);
}

export async function unmuteMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc("mute_group_member", {
    p_group_id: groupId, p_user_id: userId, p_mute: false, p_muted_until: null,
  });
  if (error) throw error;
  muteCache.get(groupId)?.delete(userId);
}

// ---------- UI preferences (unchanged) ----------
export function getGroupPermissions(groupId: string): GroupPermissions {
  const all = loadPermissions();
  if (all[groupId]) return all[groupId];
  return {
    groupId,
    canSendMessages: true, canSendMedia: true, canAddMembers: true,
    canPinMessages: true, canChangeInfo: true, slowModeSeconds: 0,
  };
}

export function setGroupPermissions(groupId: string, permissions: Partial<GroupPermissions>): void {
  const all = loadPermissions();
  const existing = all[groupId] || getGroupPermissions(groupId);
  all[groupId] = { ...existing, ...permissions, groupId };
  savePermissions(all);
}

export function logAdminAction(
  groupId: string, adminId: string, action: string, targetUserId: string
): void {
  const log = loadAdminLog();
  log.unshift({
    id: crypto.randomUUID(), groupId, adminId, action, targetUserId,
    timestamp: new Date().toISOString(),
  });
  saveAdminLog(log.slice(0, 500));
}

export function getAdminLog(groupId: string): AdminAction[] {
  return loadAdminLog().filter((a) => a.groupId === groupId);
}
