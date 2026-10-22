import { supabase } from '@/integrations/supabase/client';
export interface Channel {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  isPublic: boolean;
  subscriberCount: number;
  avatarColor: string;
  pinnedMessageId?: string;
  link?: string;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  type: 'text' | 'image' | 'announcement';
  views: number;
  edited: boolean;
  reactions: Record<string, string[]>;
  forwarded?: boolean;
  forwardedFrom?: string;
}

const CHANNELS_KEY = 'echat_channels';
const channelMessagesKey = (id: string) => `echat_channel_messages_${id}`;
const channelSubscribersKey = (id: string) => `echat_channel_subscribers_${id}`;

const AVATAR_COLORS = [
  'hsl(210, 80%, 55%)',
  'hsl(145, 65%, 42%)',
  'hsl(340, 75%, 55%)',
  'hsl(260, 70%, 58%)',
  'hsl(25, 85%, 55%)',
  'hsl(185, 70%, 42%)',
  'hsl(45, 85%, 50%)',
  'hsl(0, 70%, 55%)',
];

function randomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}


// ---------------------------------------------------------------------------
// Channels are stored on the server. This module keeps a local cache so the
// existing synchronous API keeps working; every write is sent to the server
// and `syncChannels()` / `syncChannelMessages()` refresh the cache.
// Listen for CHANNELS_SYNC_EVENT (or use useChannelSync) to re-render.
// ---------------------------------------------------------------------------

export const CHANNELS_SYNC_EVENT = 'echat:channels-sync';
const MIGRATED_KEY = 'echat_channels_migrated_v1';
const emit = () => window.dispatchEvent(new Event(CHANNELS_SYNC_EVENT));
const db = supabase as any;
const bg = (p: PromiseLike<{ error: any }>, what: string) =>
  Promise.resolve(p).then(({ error }) => { if (error) console.error(`[channels] ${what} failed:`, error.message); });

const rowToChannel = (r: any): Channel => ({
  id: r.id, name: r.name, description: r.description, createdBy: r.created_by, createdAt: r.created_at,
  isPublic: r.is_public, subscriberCount: r.subscriber_count, avatarColor: r.avatar_color,
  pinnedMessageId: r.pinned_message_id ?? undefined, link: r.link ?? undefined,
});
const channelToRow = (c: Channel) => ({
  id: c.id, name: c.name, description: c.description || '', created_by: c.createdBy, is_public: c.isPublic,
  avatar_color: c.avatarColor, pinned_message_id: c.pinnedMessageId ?? null, link: c.link ?? null,
});
const rowToMessage = (r: any): ChannelMessage => ({
  id: r.id, channelId: r.channel_id, content: r.content, senderId: r.sender_id, senderName: r.sender_name,
  createdAt: r.created_at, type: r.type, views: r.views, edited: r.edited, reactions: r.reactions || {},
});
const messageToRow = (m: ChannelMessage) => ({
  id: m.id, channel_id: m.channelId, sender_id: m.senderId, sender_name: '',
  content: m.content || '', type: m.type || 'text', created_at: m.createdAt,
});

/** One-time upload of channels that were only saved on this phone. */
async function migrateLocal(uid: string) {
  if (localStorage.getItem(MIGRATED_KEY) === uid) return;
  const mine = readJson<Channel[]>(CHANNELS_KEY, []).filter(c => c.createdBy === uid);
  for (const c of mine) {
    const { error } = await db.from('channels').upsert(channelToRow(c), { onConflict: 'id', ignoreDuplicates: true });
    if (error) { console.error('[channels] migrate failed', error.message); return; }
    const msgs = readJson<ChannelMessage[]>(channelMessagesKey(c.id), []).filter(m => m.senderId === uid);
    if (msgs.length) await db.from('channel_posts').upsert(msgs.map(messageToRow), { onConflict: 'id', ignoreDuplicates: true });
  }
  localStorage.setItem(MIGRATED_KEY, uid);
}

let syncing: Promise<void> | null = null;
/** Pull channels (public + mine + subscribed) and my subscriptions from the server. */
export function syncChannels(): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await migrateLocal(user.id);
    const [{ data: chans, error }, { data: subs }] = await Promise.all([
      db.from('channels').select('*').order('created_at', { ascending: true }).limit(500),
      db.from('channel_subscribers').select('channel_id').eq('user_id', user.id),
    ]);
    if (error) { console.error('[channels] sync failed', error.message); return; }
    writeJson(CHANNELS_KEY, (chans ?? []).map(rowToChannel));
    const subscribed = new Set((subs ?? []).map((s: any) => s.channel_id));
    for (const c of chans ?? []) writeJson(channelSubscribersKey(c.id), subscribed.has(c.id) ? [user.id] : []);
    emit();
  })().finally(() => { syncing = null; });
  return syncing;
}

/** Pull the posts of one channel from the server. */
export async function syncChannelMessages(channelId: string): Promise<void> {
  const { data, error } = await db.rpc('get_channel_posts_safe', { p_channel_id: channelId });
  if (error) { console.error('[channels] posts sync failed', error.message); return; }
  // Persistent posts contain content only, never viewer-specific personal identity.
  writeJson(channelMessagesKey(channelId), (data ?? []).map((r: any) => ({ ...rowToMessage(r), senderName: 'Hidden profile' })));
  emit();
}

export function recordChannelViews(channelId: string): void {
  bg(db.rpc('record_channel_views', { p_channel_id: channelId }), 'views');
}

export function getChannels(): Channel[] {
  return readJson<Channel[]>(CHANNELS_KEY, []);
}

export function createChannel(name: string, description: string, userId: string): Channel {
  const channels = getChannels();
  const channel: Channel = {
    id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name, description, createdBy: userId, createdAt: new Date().toISOString(),
    isPublic: true, subscriberCount: 0, avatarColor: randomAvatarColor(),
    pinnedMessageId: undefined, link: undefined,
  };
  channels.push(channel);
  writeJson(CHANNELS_KEY, channels);
  bg(db.from('channels').insert(channelToRow(channel)), 'create');
  return channel;
}

export function getChannel(id: string): Channel | undefined {
  return getChannels().find(c => c.id === id);
}

export function deleteChannel(id: string): void {
  writeJson(CHANNELS_KEY, getChannels().filter(c => c.id !== id));
  localStorage.removeItem(channelMessagesKey(id));
  localStorage.removeItem(channelSubscribersKey(id));
  bg(db.from('channels').delete().eq('id', id), 'delete');
}

export function updateChannel(id: string, updates: Partial<Channel>): Channel | undefined {
  const channels = getChannels();
  const idx = channels.findIndex(c => c.id === id);
  if (idx === -1) return undefined;
  channels[idx] = { ...channels[idx], ...updates, id };
  writeJson(CHANNELS_KEY, channels);
  const { id: _i, createdBy: _c, ...row } = channelToRow(channels[idx]) as any;
  bg(db.from('channels').update(row).eq('id', id), 'update');
  return channels[idx];
}

function getSubscribers(channelId: string): string[] {
  return readJson<string[]>(channelSubscribersKey(channelId), []);
}

function bumpCount(channelId: string, delta: number) {
  const channels = getChannels();
  const idx = channels.findIndex(c => c.id === channelId);
  if (idx !== -1) {
    channels[idx].subscriberCount = Math.max(0, (channels[idx].subscriberCount || 0) + delta);
    writeJson(CHANNELS_KEY, channels);
  }
}

export function subscribeToChannel(channelId: string, userId: string): void {
  if (getSubscribers(channelId).includes(userId)) return;
  writeJson(channelSubscribersKey(channelId), [...getSubscribers(channelId), userId]);
  bumpCount(channelId, 1);
  bg(db.from('channel_subscribers').insert({ channel_id: channelId, user_id: userId }), 'subscribe');
}

export function unsubscribeFromChannel(channelId: string, userId: string): void {
  if (!getSubscribers(channelId).includes(userId)) return;
  writeJson(channelSubscribersKey(channelId), getSubscribers(channelId).filter(s => s !== userId));
  bumpCount(channelId, -1);
  bg(db.from('channel_subscribers').delete().eq('channel_id', channelId).eq('user_id', userId), 'unsubscribe');
}

export function isSubscribed(channelId: string, userId: string): boolean {
  return getSubscribers(channelId).includes(userId);
}

export function getSubscriberCount(channelId: string): number {
  return getChannel(channelId)?.subscriberCount ?? 0;
}

export function getChannelMessages(channelId: string): ChannelMessage[] {
  return readJson<ChannelMessage[]>(channelMessagesKey(channelId), []).map(m => ({ ...m, senderName: 'Hidden profile' }));
}

export function sendChannelMessage(
  channelId: string, content: string, senderId: string, senderName: string, type: string = 'text'
): ChannelMessage {
  const messages = getChannelMessages(channelId);
  const message: ChannelMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    channelId, content, senderId, senderName: 'Hidden profile', createdAt: new Date().toISOString(),
    type: type as ChannelMessage['type'], views: 0, edited: false, reactions: {},
  };
  messages.push(message);
  writeJson(channelMessagesKey(channelId), messages);
  bg(db.from('channel_posts').insert(messageToRow(message)), 'post');
  return message;
}

export function deleteChannelMessage(channelId: string, messageId: string): void {
  writeJson(channelMessagesKey(channelId), getChannelMessages(channelId).filter(m => m.id !== messageId));
  bg(db.from('channel_posts').delete().eq('id', messageId), 'delete post');
}

export function pinMessage(channelId: string, messageId: string): void {
  updateChannel(channelId, { pinnedMessageId: messageId });
}

export function unpinMessage(channelId: string): void {
  updateChannel(channelId, { pinnedMessageId: undefined });
}

function setReaction(channelId: string, messageId: string, emoji: string, userId: string, add: boolean) {
  const messages = getChannelMessages(channelId);
  const idx = messages.findIndex(m => m.id === messageId);
  if (idx === -1) return;
  const reactions = { ...(messages[idx].reactions || {}) };
  const list = (reactions[emoji] || []).filter(u => u !== userId);
  if (add) list.push(userId);
  if (list.length) reactions[emoji] = list; else delete reactions[emoji];
  messages[idx].reactions = reactions;
  writeJson(channelMessagesKey(channelId), messages);
  bg(db.rpc('toggle_channel_reaction', { p_post_id: messageId, p_emoji: emoji, p_add: add }), 'reaction');
}

export function addReaction(channelId: string, messageId: string, emoji: string, userId: string): void {
  setReaction(channelId, messageId, emoji, userId, true);
}

export function removeReaction(channelId: string, messageId: string, emoji: string, userId: string): void {
  setReaction(channelId, messageId, emoji, userId, false);
}

export function getMyChannels(userId: string): Channel[] {
  return getChannels().filter(c => c.createdBy === userId);
}

export function getSubscribedChannels(userId: string): Channel[] {
  return getChannels().filter(c => isSubscribed(c.id, userId) && c.createdBy !== userId);
}
