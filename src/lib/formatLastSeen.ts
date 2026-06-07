// Stale threshold — if a user's last heartbeat is older than this, treat as offline
// even when the DB still has is_online=true (browser/tab may have crashed).
const STALE_MS = 75_000; // 75s (heartbeat is 25s)

export function formatLastSeen(lastSeen: string | null | undefined, isOnline: boolean): string {
  const effectiveOnline = isUserOnline(lastSeen, isOnline);
  if (effectiveOnline) return "Online";
  if (!lastSeen) return "";

  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "Last seen just now";
  if (diffMin < 60) return `Last seen ${diffMin}m ago`;
  if (diffHours < 24) return `Last seen ${diffHours}h ago`;
  if (diffDays === 1) return "Last seen yesterday";
  if (diffDays < 7) return `Last seen ${diffDays}d ago`;
  return `Last seen ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

/**
 * Returns true only if the user is flagged online AND has a recent heartbeat.
 * Prevents "ghost online" status after browser crash / lost connection.
 */
export function isUserOnline(lastSeen: string | null | undefined, isOnline: boolean): boolean {
  if (!isOnline) return false;
  if (!lastSeen) return false;
  const age = Date.now() - new Date(lastSeen).getTime();
  return age < STALE_MS;
}
