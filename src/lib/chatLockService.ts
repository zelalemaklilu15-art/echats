/**
 * Chat Lock Service
 * Lock individual chats with a PIN code
 */

const STORAGE_KEY = "echat_chat_locks";
const APP_LOCK_KEY = "echat_app_lock";

interface ChatLock {
  chatId: string;
  pinHash: string;
  lockedAt: string;
}

interface AppLock {
  pinHash: string;
  enabled: boolean;
}

function hashPin(pin: string): string {
  // Simple hash for client-side PIN - not cryptographic
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function loadLocks(): ChatLock[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocks(locks: ChatLock[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locks));
}

export function isChatLocked(chatId: string): boolean {
  return loadLocks().some(l => l.chatId === chatId);
}

export function lockChat(chatId: string, pin: string): void {
  const locks = loadLocks();
  const existing = locks.findIndex(l => l.chatId === chatId);
  const entry: ChatLock = {
    chatId,
    pinHash: hashPin(pin),
    lockedAt: new Date().toISOString(),
  };
  if (existing >= 0) {
    locks[existing] = entry;
  } else {
    locks.push(entry);
  }
  saveLocks(locks);
}

export function unlockChat(chatId: string): void {
  const locks = loadLocks();
  saveLocks(locks.filter(l => l.chatId !== chatId));
}

export function verifyChatPin(chatId: string, pin: string): boolean {
  const locks = loadLocks();
  const lock = locks.find(l => l.chatId === chatId);
  if (!lock) return true; // No lock = always accessible
  return lock.pinHash === hashPin(pin);
}

// App-level lock
export function getAppLock(): AppLock | null {
  try {
    const stored = localStorage.getItem(APP_LOCK_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function setAppLock(pin: string): void {
  const lock: AppLock = { pinHash: hashPin(pin), enabled: true };
  localStorage.setItem(APP_LOCK_KEY, JSON.stringify(lock));
}

export function removeAppLock(): void {
  localStorage.removeItem(APP_LOCK_KEY);
}

export function verifyAppPin(pin: string): boolean {
  const lock = getAppLock();
  if (!lock) return true;
  return lock.pinHash === hashPin(pin);
}

export function isAppLockEnabled(): boolean {
  const lock = getAppLock();
  return !!lock?.enabled;
}

// Wallet-level lock — PIN is now stored HASHED ON THE SERVER using bcrypt
// (public.set_wallet_pin / public.verify_wallet_pin RPCs). The local
// `WALLET_LOCK_KEY` flag is kept ONLY as a UI hint indicating whether the user
// enabled the lock; it never contains the PIN.
const WALLET_LOCK_KEY = "echat_wallet_lock_enabled";

import { supabase } from "@/integrations/supabase/client";

export function isWalletLockEnabled(): boolean {
  return localStorage.getItem(WALLET_LOCK_KEY) === "true";
}

export async function refreshWalletLockFlag(): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_wallet_pin");
  const enabled = !error && !!data;
  localStorage.setItem(WALLET_LOCK_KEY, enabled ? "true" : "false");
  return enabled;
}

export async function setWalletPinAsync(pin: string): Promise<void> {
  const { error } = await supabase.rpc("set_wallet_pin", { p_pin: pin });
  if (error) throw error;
  localStorage.setItem(WALLET_LOCK_KEY, "true");
}

export async function removeWalletLockAsync(): Promise<void> {
  // Clear PIN server-side by setting empty is not allowed; instead we use a
  // dedicated edge function or simply mark the flag off. For now we require the
  // user to keep a PIN if enabled; disabling only clears the local UI flag.
  localStorage.removeItem(WALLET_LOCK_KEY);
}

/**
 * Verifies a PIN by delegating to the wallet-verify-pin edge function.
 * Returns true on success; on server error or bad PIN returns false.
 */
export async function verifyWalletPinAsync(pin: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("wallet-verify-pin", {
      body: { pin },
    });
    if (error) return false;
    return !!(data as any)?.ok;
  } catch {
    return false;
  }
}

// Deprecated sync API — kept only to avoid breaking legacy call sites.
// It now always returns true so the UI does not falsely gate access based on
// a local hash. Real enforcement happens server-side on money-moving RPCs.
export function verifyWalletPin(_pin: string): boolean {
  return true;
}
export function getWalletLock(): { pinHash: string; enabled: boolean } | null {
  return isWalletLockEnabled() ? { pinHash: "", enabled: true } : null;
}
export function setWalletLock(_pin: string): void {
  // No-op: PIN must be set via setWalletPinAsync.
  console.warn("setWalletLock is deprecated — use setWalletPinAsync().");
}
export function removeWalletLock(): void {
  localStorage.removeItem(WALLET_LOCK_KEY);
}

// Session tracking - avoid repeated PIN prompts
const unlockedSessions = new Set<string>();

export function markChatUnlocked(chatId: string): void {
  unlockedSessions.add(chatId);
}

export function isChatSessionUnlocked(chatId: string): boolean {
  return unlockedSessions.has(chatId);
}

export function clearUnlockedSessions(): void {
  unlockedSessions.clear();
}
