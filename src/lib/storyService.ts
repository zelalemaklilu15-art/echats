import { getAccessProfiles, PROFILE_ACCESS_EVENT } from "@/lib/profileAccess";
import { mediaObjectPath, resolveFeatureMedia } from "@/lib/featureMedia";
import { supabase } from "@/integrations/supabase/client";

export interface Story {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  story_type: "text" | "image" | "video";
  media_type?: "image" | "video";
  background_color: string;
  views_count: number;
  duration?: number | null;
  privacy?: "everyone" | "contacts" | "close_friends";
  media_path?: string | null;
  created_at: string;
  expires_at: string;
}

export interface StoryViewerInfo {
  viewer_id: string;
  viewed_at: string;
  username?: string;
  name?: string;
  avatar_url?: string | null;
}

export interface StoryGroup {
  user_id: string;
  username: string;
  name: string;
  avatar_url: string | null;
  stories: Story[];
  hasUnviewed: boolean;
}

let generation = 0;
window.addEventListener(PROFILE_ACCESS_EVENT, () => { generation += 1; });
export async function hydrateStories(rows: Story[]): Promise<Story[]> {
  return Promise.all(rows.map(async row => ({ ...row, media_url: await resolveFeatureMedia(row.media_path ? `chat-media/${row.media_path}` : row.media_url, 'chat-media') })));
}
export async function getActiveStories(): Promise<Story[]> {
  const started = generation;
  const { data, error } = await supabase.from('user_stories').select('*').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true });
  if (error) throw error;
  const rows = await hydrateStories((data ?? []) as Story[]);
  return started === generation ? rows : [];
}
function audience(content: string | null | undefined): 'everyone' | 'contacts' | 'close_friends' {
  try { const p = JSON.parse(content ?? '{}').privacy; if (p === 'contacts' || p === 'close_friends') return p; } catch {}
  return 'everyone';
}
export async function createTextStory(content: string, bgColor: string, duration = 5): Promise<boolean> {
  const started = generation;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || started !== generation) return false;
  const { error } = await supabase.from('user_stories').insert({ user_id: user.id, content, story_type: 'text', background_color: bgColor, privacy: audience(content), duration });
  if (error) throw error;
  return true;
}
export async function createImageStory(mediaUrl: string, caption?: string): Promise<boolean> {
  return createMediaStory(mediaUrl, 'image', caption);
}

export function isStealthMode(): boolean {
  return localStorage.getItem("echat_story_stealth") === "true";
}

export async function viewStory(storyId: string): Promise<void> {
  if (isStealthMode()) return;
  const started = generation;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || started !== generation) return;
  const { error } = await supabase.from('story_views').upsert({ story_id: storyId, viewer_id: user.id }, { onConflict: 'story_id,viewer_id', ignoreDuplicates: true });
  if (error) throw error;
}
/** Archive stays server-owned; never persist other people's story bytes or identities. */
export function archiveStory(_story: Story): void {}
export async function getArchivedStories(userId: string): Promise<Story[]> {
  const { data, error } = await supabase.from('user_stories').select('*').eq('user_id', userId).lte('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return hydrateStories((data ?? []) as Story[]);
}

export async function getMyViewedStories(): Promise<Set<string>> {
  const started = generation;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || started !== generation) return new Set();

  const { data, error } = await supabase
    .from("story_views")
    .select("story_id")
    .eq("viewer_id", user.id);

  if (error) throw error;
  if (started !== generation) return new Set();
  return new Set((data || []).map((v) => v.story_id));
}

export async function deleteStory(storyId: string): Promise<boolean> {
  const { data, error } = await supabase.from('user_stories').delete().eq('id', storyId).select('id,media_path');
  if (error) throw error;
  if (!data?.length) return false;
  const path = data[0].media_path;
  if (path) await supabase.storage.from('chat-media').remove([path]);
  window.dispatchEvent(new Event(PROFILE_ACCESS_EVENT));
  return true;
}
export async function uploadStoryMedia(file: File, ownerId?: string): Promise<{ url: string; type: 'image' | 'video'; ownerId: string }> {
  const started = generation;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || (ownerId && ownerId !== user.id) || started !== generation) throw new Error('Account changed');
  if ((!file.type.startsWith('image/') && !file.type.startsWith('video/')) || file.size > 50 * 1024 * 1024) throw new Error('Choose an image or video under 50MB');
  const isVideo = file.type.startsWith('video/');
  const ext = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || (isVideo ? 'mp4' : 'jpg');
  const path = `stories/${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('chat-media').upload(path, file, { upsert: false });
  if (error) throw error;
  if (started !== generation) throw new Error('Account changed. Story was not published.');
  return { url: `chat-media/${path}`, type: isVideo ? 'video' : 'image', ownerId: user.id };
}
export async function createMediaStory(mediaUrl: string, mediaType: 'image' | 'video', caption?: string, duration = 5, ownerId?: string): Promise<boolean> {
  const started = generation;
  const { data: { user } } = await supabase.auth.getUser();
  const path = mediaObjectPath(mediaUrl, 'chat-media');
  if (!user || started !== generation || (ownerId && user.id !== ownerId) || !path?.startsWith(`stories/${user.id}/`)) throw new Error('Story media owner mismatch');
  const { error } = await supabase.from('user_stories').insert({ user_id: user.id, media_url: `chat-media/${path}`, media_path: path, content: caption ?? null, story_type: mediaType, privacy: audience(caption), duration });
  if (error) throw error;
  return true;
}

export async function getStoryViewers(storyId: string): Promise<StoryViewerInfo[]> {
  const { data, error } = await supabase
    .from("story_views")
    .select("viewer_id, viewed_at")
    .eq("story_id", storyId);

  if (error) throw error;
  if (!data) return [];

  const viewerIds = data.map(v => v.viewer_id);
  if (viewerIds.length === 0) return [];

  const profiles = await getAccessProfiles(viewerIds);
  const profileMap = new Map(profiles.map(p => [p.id,p]));

  return data.map(v => {
    const p = profileMap.get(v.viewer_id);
    return {
      viewer_id: v.viewer_id,
      viewed_at: v.viewed_at,
      username: p?.username ?? undefined,
      name: p?.name || p?.username || "Hidden profile",
      avatar_url: p?.avatar_url,
    };
  });
}
