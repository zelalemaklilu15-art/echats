import { supabase } from '@/integrations/supabase/client';
import { PROFILE_ACCESS_EVENT } from '@/lib/profileAccess';
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
  commentsEnabled: boolean;
  commentsCount: number;
}

export interface ChannelComment {
  id: string;
  postId: string;
  channelId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}


// Authorized content and identities never survive account/access changes on disk.
const channels = new Map<string, Channel>();
const posts = new Map<string, ChannelMessage[]>();
const comments = new Map<string, ChannelComment[]>();

const subscriptions = new Set<string>();
export const CHANNELS_SYNC_EVENT = 'echat:channels-sync';
const emit = () => window.dispatchEvent(new Event(CHANNELS_SYNC_EVENT));
let identityViewer: string | null = null;
let accessGeneration = 0;
const invalidate = () => { accessGeneration += 1; channels.clear(); posts.clear(); comments.clear(); subscriptions.clear(); emit(); };
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') return;
  const next = session?.user.id ?? null;
  if (next === identityViewer) return;
  identityViewer = next; invalidate();
});
window.addEventListener(PROFILE_ACCESS_EVENT, invalidate);
const db = supabase as any;
async function check(result: { error: any; data?: any }, requireRow = false) {
  if (result.error) throw result.error;
  if (requireRow && !result.data?.length) throw new Error('Action was not authorized or item is unavailable');
}
async function viewer() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in again');
  if (!identityViewer) identityViewer = user.id;
  if (user.id !== identityViewer) throw new Error('Account changed');
  return { id: user.id, generation: accessGeneration };
}

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
  commentsEnabled: r.comments_enabled !== false, commentsCount: r.comments_count ?? 0,
});
const rowToComment = (r: any): ChannelComment => ({
  id: r.id, postId: r.post_id, channelId: r.channel_id, authorId: r.author_id,
  authorName: r.author_name ?? 'Hidden profile', text: r.body ?? '', createdAt: r.created_at,
});

const messageToRow = (m: ChannelMessage) => ({
  id: m.id, channel_id: m.channelId, sender_id: m.senderId, sender_name: '',
  content: m.content || '', type: m.type || 'text', created_at: m.createdAt,
});

let syncing: { generation: number; promise: Promise<void> } | null = null;
export function syncChannels(): Promise<void> {
  const started = accessGeneration;
  if (syncing?.generation === started) return syncing.promise;
  const promise = (async () => {
    const owner = await viewer();
    const [rows, subs] = await Promise.all([
      db.from('channels').select('*').order('created_at', { ascending: true }).limit(500),
      db.from('channel_subscribers').select('channel_id').eq('user_id', owner.id),
    ]);
    await check(rows); await check(subs);
    if (owner.generation !== accessGeneration) return;
    channels.clear(); subscriptions.clear();
    for (const row of rows.data ?? []) channels.set(row.id, rowToChannel(row));
    for (const row of subs.data ?? []) subscriptions.add(row.channel_id);
    for (const key of posts.keys()) if (!channels.has(key)) posts.delete(key);
    emit();
  })().finally(() => { if (syncing?.generation === started) syncing = null; });
  syncing = { generation: started, promise }; return promise;
}
export async function syncChannelMessages(channelId: string, older = false): Promise<void> {
  const owner = await viewer();
  const current = posts.get(channelId) ?? [];
  const first = older ? current[0] : null;
  const { data, error } = await db.rpc('get_channel_posts_page', { p_channel_id: channelId, p_before: first?.createdAt ?? null, p_before_id: first?.id ?? null });
  await check({ data, error });
  if (owner.generation !== accessGeneration) return;
  const incoming = (data ?? []).map(rowToMessage).reverse();
  const merged = new Map<string, ChannelMessage>();
  // Preserve older loaded pages, replace the newest server page atomically.
  for (const item of current) if (older || (incoming[0] && item.createdAt < incoming[0].createdAt)) merged.set(item.id,item);
  for (const item of incoming) merged.set(item.id,item);
  posts.set(channelId, [...merged.values()].sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)));
  emit();
}
export function recordChannelViews(channelId: string): void { void Promise.resolve(db.rpc('record_channel_views', { p_channel_id: channelId })).catch(() => {}); }
export function getChannels(): Channel[] { return [...channels.values()]; }
export function getChannel(id: string): Channel | undefined { return channels.get(id); }
export async function createChannel(name: string, description: string, userId: string): Promise<Channel> {
  const owner = await viewer();
  if (owner.id !== userId) throw new Error('Account changed');
  const channel: Channel = { id: `ch_${crypto.randomUUID()}`, name, description, createdBy: userId, createdAt: new Date().toISOString(), isPublic: true, subscriberCount: 0, avatarColor: 'hsl(var(--primary))' };
  await check(await db.from('channels').insert(channelToRow(channel)).select('id'), true);
  if (owner.generation !== accessGeneration) throw new Error('Account changed');
  await syncChannels(); return getChannel(channel.id) ?? channel;
}
export async function deleteChannel(id: string): Promise<void> {
  await viewer(); await check(await db.from('channels').delete().eq('id',id).select('id'),true); await syncChannels(); posts.delete(id);
}
export async function updateChannel(id: string, updates: Partial<Channel>): Promise<Channel | undefined> {
  await viewer(); const channel = getChannel(id); if (!channel) throw new Error('Channel unavailable');
  const changed = { ...channel,...updates };
  const { id: _id, created_by: _owner, ...row } = channelToRow(changed);
  await check(await db.from('channels').update(row).eq('id',id).select('id'),true); await syncChannels(); return getChannel(id);
}
export async function subscribeToChannel(channelId: string, userId: string): Promise<void> {
  const owner = await viewer(); if (owner.id !== userId) throw new Error('Account changed');
  await check(await db.from('channel_subscribers').upsert({ channel_id: channelId,user_id: userId }, { onConflict: 'channel_id,user_id',ignoreDuplicates: true })); await syncChannels();
}
export async function unsubscribeFromChannel(channelId: string, userId: string): Promise<void> {
  const owner = await viewer(); if (owner.id !== userId) throw new Error('Account changed');
  await check(await db.from('channel_subscribers').delete().eq('channel_id',channelId).eq('user_id',userId)); await syncChannels();
}
export function isSubscribed(channelId: string,userId: string): boolean { return userId === identityViewer && subscriptions.has(channelId); }
export function getSubscriberCount(id: string): number { return getChannel(id)?.subscriberCount ?? 0; }
export function getChannelMessages(id: string): ChannelMessage[] { return posts.get(id) ?? []; }
export async function syncChannelComments(postId: string): Promise<void> {
  const owner = await viewer();
  const { data, error } = await db.rpc('get_channel_post_comments', { p_post_id: postId });
  await check({ data, error });
  if (owner.generation !== accessGeneration) return;
  comments.set(postId, (data ?? []).map(rowToComment));
}

export function getChannelComments(postId: string): ChannelComment[] { return comments.get(postId) ?? []; }
export async function sendChannelComment(channelId: string, postId: string, text: string): Promise<void> {
  const owner = await viewer();
  const trimmed = text.trim();
  if (!trimmed) return;
  await check(await db.from('channel_post_comments').insert({ post_id: postId, channel_id: channelId, author_id: owner.id, text: trimmed }).select('id'), true);
  if (owner.generation !== accessGeneration) throw new Error('Account changed');
  await Promise.all([syncChannelComments(postId), syncChannelMessages(channelId)]);
}
export async function deleteChannelComment(channelId: string, postId: string, commentId: string): Promise<void> {
  await viewer();
  await check(await db.from('channel_post_comments').delete().eq('id', commentId).select('id'), true);
  await Promise.all([syncChannelComments(postId), syncChannelMessages(channelId)]);
}
export async function setChannelCommentsEnabled(channelId: string, postId: string, enabled: boolean): Promise<void> {
  await viewer();
  await check(await db.from('channel_posts').update({ comments_enabled: enabled }).eq('id', postId).eq('channel_id', channelId).select('id'), true);
  await syncChannelMessages(channelId);
}

export async function sendChannelMessage(channelId: string,content: string,senderId: string,_senderName: string,type = 'text'): Promise<ChannelMessage> {
  const owner = await viewer(); if (owner.id !== senderId) throw new Error('Account changed');
  const message: ChannelMessage = { id: `msg_${crypto.randomUUID()}`,channelId,content,senderId,senderName: 'Hidden profile',createdAt: new Date().toISOString(),type: type as ChannelMessage['type'],views: 0,edited: false,reactions: {} };
  await check(await db.from('channel_posts').insert(messageToRow(message)).select('id'),true);
  if (owner.generation !== accessGeneration) throw new Error('Account changed');
  await syncChannelMessages(channelId); return message;
}
export async function deleteChannelMessage(channelId: string,messageId: string): Promise<void> {
  await viewer(); await check(await db.from('channel_posts').delete().eq('id',messageId).eq('channel_id',channelId).select('id'),true);
  posts.set(channelId,getChannelMessages(channelId).filter(item => item.id !== messageId)); emit();
}
export async function pinMessage(channelId: string,messageId: string): Promise<void> { await updateChannel(channelId,{ pinnedMessageId: messageId }); }
export async function unpinMessage(channelId: string): Promise<void> { await updateChannel(channelId,{ pinnedMessageId: undefined }); }
async function setReaction(channelId: string,messageId: string,emoji: string,userId: string,add: boolean): Promise<void> {
  const owner = await viewer(); if (owner.id !== userId) throw new Error('Account changed');
  await check(await db.rpc('toggle_channel_reaction',{ p_post_id: messageId,p_emoji: emoji,p_add: add })); await syncChannelMessages(channelId);
}
export async function addReaction(channelId: string,messageId: string,emoji: string,userId: string): Promise<void> { await setReaction(channelId,messageId,emoji,userId,true); }
export async function removeReaction(channelId: string,messageId: string,emoji: string,userId: string): Promise<void> { await setReaction(channelId,messageId,emoji,userId,false); }
export function getMyChannels(userId: string): Channel[] { return getChannels().filter(c => c.createdBy === userId); }
export function getSubscribedChannels(userId: string): Channel[] { return getChannels().filter(c => isSubscribed(c.id,userId) && c.createdBy !== userId); }
