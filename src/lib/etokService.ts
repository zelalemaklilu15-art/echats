// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

export interface EtokVideo {
  id: string;
  authorId: string;
  description: string;
  hashtags: string[];
  soundName: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  duration: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  privacy: "everyone" | "friends" | "only_me";
  allowComments: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  allowDownload: boolean;
  isSponsored: boolean;
  createdAt: string;
  // joined author profile
  author?: EtokUser;
}

export interface EtokUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  isOnline?: boolean;
}

export interface EtokComment {
  id: string;
  videoId: string;
  authorId: string;
  text: string;
  likes: number;
  isPinned: boolean;
  parentId?: string | null;
  createdAt: string;
  author?: EtokUser;
}

export interface EtokSound {
  id: string;
  title: string;
  authorName: string;
  coverEmoji: string;
  duration: number;
  videoCount: number;
  isOriginal: boolean;
}

export interface EtokHashtag {
  id: string;
  name: string;
  viewCount: number;
  trending: boolean;
}

/* ═══════════════════════════════════════════
   Row → Model mappers
   ═══════════════════════════════════════════ */

function mapVideo(row: any): EtokVideo {
  return {
    id: row.id,
    authorId: row.author_id,
    description: row.description ?? "",
    hashtags: row.hashtags ?? [],
    soundName: row.sound_name ?? "Original Sound",
    videoUrl: row.video_url,
    thumbnailUrl: row.thumbnail_url,
    duration: row.duration ?? 15,
    views: row.views ?? 0,
    likes: row.likes ?? 0,
    comments: row.comments ?? 0,
    shares: row.shares ?? 0,
    privacy: row.privacy ?? "everyone",
    allowComments: row.allow_comments ?? true,
    allowDuet: row.allow_duet ?? true,
    allowStitch: row.allow_stitch ?? true,
    allowDownload: row.allow_download ?? true,
    isSponsored: row.is_sponsored ?? false,
    createdAt: row.created_at,
    author: row.profiles ? mapUser(row.profiles) : undefined,
  };
}

function mapUser(row: any): EtokUser {
  return {
    id: row.id,
    username: row.username ?? "user",
    displayName: row.name ?? row.username ?? "User",
    avatar: row.avatar_url,
    bio: row.bio,
    isOnline: row.is_online,
  };
}

function mapComment(row: any): EtokComment {
  return {
    id: row.id,
    videoId: row.video_id,
    authorId: row.author_id,
    text: row.text,
    likes: row.likes ?? 0,
    isPinned: row.is_pinned ?? false,
    parentId: row.parent_id,
    createdAt: row.created_at,
    author: row.profiles ? mapUser(row.profiles) : undefined,
  };
}

async function hydrateVideos(rows: any[] | null | undefined): Promise<EtokVideo[]> {
  const list = rows ?? [];
  const authorIds = [...new Set(list.map(r => r.author_id).filter(Boolean))];
  const profilesById = new Map<string, EtokUser>();
  if (authorIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, name, avatar_url, bio, is_online")
      .in("id", authorIds);
    (data ?? []).forEach(p => profilesById.set(p.id, mapUser(p)));
  }
  return list.map(row => ({ ...mapVideo(row), author: profilesById.get(row.author_id) }));
}

async function hydrateComments(rows: any[] | null | undefined): Promise<EtokComment[]> {
  const list = rows ?? [];
  const authorIds = [...new Set(list.map(r => r.author_id).filter(Boolean))];
  const profilesById = new Map<string, EtokUser>();
  if (authorIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, name, avatar_url, bio, is_online")
      .in("id", authorIds);
    (data ?? []).forEach(p => profilesById.set(p.id, mapUser(p)));
  }
  return list.map(row => ({ ...mapComment(row), author: profilesById.get(row.author_id) }));
}

/* ═══════════════════════════════════════════
   Video queries
   ═══════════════════════════════════════════ */

export async function fetchFYPVideos(): Promise<EtokVideo[]> {
  const { data, error } = await supabase
    .from("etok_videos")
    .select("*")
    .eq("privacy", "everyone")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) { console.error("[Etok] FYP error:", error); return []; }
  return hydrateVideos(data);
}

export async function fetchFollowingVideos(userId: string): Promise<EtokVideo[]> {
  // Get who user follows
  const { data: follows } = await supabase
    .from("etok_follows")
    .select("following_id")
    .eq("follower_id", userId);
  const ids = (follows ?? []).map(f => f.following_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("etok_videos")
    .select("*")
    .in("author_id", ids)
    .neq("privacy", "only_me")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) { console.error("[Etok] following error:", error); return []; }
  return hydrateVideos(data);
}

export async function fetchUserVideos(userId: string): Promise<EtokVideo[]> {
  const { data, error } = await supabase
    .from("etok_videos")
    .select("*")
    .eq("author_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) { console.error("[Etok] user videos error:", error); return []; }
  return hydrateVideos(data);
}

export async function fetchVideoById(videoId: string): Promise<EtokVideo | null> {
  const { data, error } = await supabase
    .from("etok_videos")
    .select("*")
    .eq("id", videoId)
    .maybeSingle();
  if (error || !data) return null;
  const [video] = await hydrateVideos([data]);
  return video ?? null;
}

export function subscribeToPublicEtokVideos(onNew: (video: EtokVideo) => void) {
  const channel = supabase
    .channel("etok-public-videos")
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "etok_videos",
      filter: "privacy=eq.everyone",
    }, async (payload: any) => {
      const video = await fetchVideoById(payload.new.id);
      if (video) onNew(video);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/* ═══════════════════════════════════════════
   Likes
   ═══════════════════════════════════════════ */

export async function checkIsLiked(userId: string, videoId: string): Promise<boolean> {
  const { count } = await supabase
    .from("etok_likes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("video_id", videoId);
  return (count ?? 0) > 0;
}

export async function toggleLikeAsync(userId: string, videoId: string): Promise<boolean> {
  if (!userId) throw new Error("Please sign in first");
  const liked = await checkIsLiked(userId, videoId);
  if (liked) {
    await supabase.from("etok_likes").delete().eq("user_id", userId).eq("video_id", videoId);
    // Decrement likes count
    const { data: vid } = await supabase.from("etok_videos").select("likes").eq("id", videoId).single();
    if (vid) {
      await supabase.from("etok_videos").update({ likes: Math.max(0, vid.likes - 1) }).eq("id", videoId);
    }
    return false;
  } else {
    await supabase.from("etok_likes").insert({ user_id: userId, video_id: videoId });
    const { data: vid } = await supabase.from("etok_videos").select("likes").eq("id", videoId).single();
    if (vid) {
      await supabase.from("etok_videos").update({ likes: vid.likes + 1 }).eq("id", videoId);
    }
    await recordVideoInteractionAsync(videoId, "like");
    return true;
  }
}

/* ═══════════════════════════════════════════
   Follows
   ═══════════════════════════════════════════ */

export async function checkIsFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { count } = await supabase
    .from("etok_follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("follower_id", followerId)
    .eq("following_id", followingId);
  return (count ?? 0) > 0;
}

export async function toggleFollowAsync(followerId: string, followingId: string): Promise<boolean> {
  if (!followerId) throw new Error("Please sign in first");
  if (followerId === followingId) return true;
  const isFollow = await checkIsFollowing(followerId, followingId);
  if (isFollow) {
    await supabase.from("etok_follows").delete().eq("follower_id", followerId).eq("following_id", followingId);
    return false;
  } else {
    await supabase.from("etok_follows").insert({ follower_id: followerId, following_id: followingId });
    return true;
  }
}

export async function fetchFollowerCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from("etok_follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("following_id", userId);
  return count ?? 0;
}

export async function fetchFollowingCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from("etok_follows")
    .select("following_id", { count: "exact", head: true })
    .eq("follower_id", userId);
  return count ?? 0;
}

/* ═══════════════════════════════════════════
   Comments
   ═══════════════════════════════════════════ */

export async function fetchComments(videoId: string): Promise<EtokComment[]> {
  const { data, error } = await supabase
    .from("etok_comments")
    .select("*")
    .eq("video_id", videoId)
    .is("parent_id", null)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) { console.error("[Etok] comments error:", error); return []; }
  return hydrateComments(data);
}

export async function fetchReplies(parentId: string): Promise<EtokComment[]> {
  const { data } = await supabase
    .from("etok_comments")
    .select("*")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true });
  return hydrateComments(data);
}

export async function addCommentAsync(videoId: string, authorId: string, text: string, parentId?: string): Promise<EtokComment | null> {
  if (!authorId) throw new Error("Please sign in first");
  const { data, error } = await supabase
    .from("etok_comments")
    .insert({ video_id: videoId, author_id: authorId, text, parent_id: parentId ?? null })
    .select("*")
    .single();
  if (error) { console.error("[Etok] add comment error:", error); return null; }
  // Increment comment count
  const { data: vid } = await supabase.from("etok_videos").select("comments").eq("id", videoId).single();
  if (vid) {
    await supabase.from("etok_videos").update({ comments: vid.comments + 1 }).eq("id", videoId);
  }
  await recordVideoInteractionAsync(videoId, "comment");
  const [comment] = await hydrateComments(data ? [data] : []);
  return comment ?? null;
}

export async function deleteCommentAsync(commentId: string): Promise<void> {
  await supabase.from("etok_comments").delete().eq("id", commentId);
}

/* ═══════════════════════════════════════════
   Profile
   ═══════════════════════════════════════════ */

export async function fetchEtokProfile(userId: string): Promise<EtokUser | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, username, name, avatar_url, bio, is_online")
    .eq("id", userId)
    .single();
  return data ? mapUser(data) : null;
}

export async function updateEtokProfileAsync(userId: string, updates: { name: string; username: string; bio: string }): Promise<EtokUser | null> {
  if (!userId) throw new Error("Please sign in first");
  const { data, error } = await supabase
    .from("profiles")
    .update({ name: updates.name.trim(), username: updates.username.trim(), bio: updates.bio.trim(), updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id, username, name, avatar_url, bio, is_online")
    .single();
  if (error) throw new Error(error.message || "Profile update failed");
  return data ? mapUser(data) : null;
}

export async function fetchTotalVideoLikes(userId: string): Promise<number> {
  const { data } = await supabase
    .from("etok_videos")
    .select("likes")
    .eq("author_id", userId);
  return (data ?? []).reduce((sum, v) => sum + (v.likes ?? 0), 0);
}

/* ═══════════════════════════════════════════
   Search
   ═══════════════════════════════════════════ */

export async function searchVideosAsync(query: string): Promise<EtokVideo[]> {
  const clean = query.trim().replace(/^#/, "");
  if (!clean) return [];
  const q = `%${clean}%`;
  const { data } = await supabase
    .from("etok_videos")
    .select("*")
    .or(`description.ilike.${q},sound_name.ilike.${q}`)
    .eq("privacy", "everyone")
    .order("views", { ascending: false })
    .limit(30);
  const hydrated = await hydrateVideos(data);
  return hydrated.filter(v =>
    v.description.toLowerCase().includes(clean.toLowerCase()) ||
    v.soundName.toLowerCase().includes(clean.toLowerCase()) ||
    v.hashtags.some(h => h.toLowerCase().includes(clean.toLowerCase()))
  );
}

export async function searchUsersAsync(query: string): Promise<EtokUser[]> {
  const q = `%${query}%`;
  const { data } = await supabase
    .from("profiles")
    .select("id, username, name, avatar_url, bio, is_online")
    .or(`username.ilike.${q},name.ilike.${q}`)
    .limit(20);
  return (data ?? []).map(mapUser);
}

/* ═══════════════════════════════════════════
   Upload
   ═══════════════════════════════════════════ */

export async function uploadVideoAsync(
  blob: Blob,
  metadata: {
    authorId: string;
    description: string;
    hashtags: string[];
    soundName: string;
    duration: number;
    privacy: "everyone" | "friends" | "only_me";
    allowComments: boolean;
    allowDuet: boolean;
    allowStitch: boolean;
    allowDownload: boolean;
  },
  onProgress?: (pct: number) => void
): Promise<EtokVideo | null> {
  if (!metadata.authorId) {
    throw new Error("You must be signed in to post a video");
  }
  if (!blob || blob.size === 0) {
    throw new Error("Recorded video is empty");
  }

  onProgress?.(10);

  const contentType = blob.type || "video/webm";
  const extension = contentType.includes("mp4") ? "mp4" : "webm";
  const filePath = `${metadata.authorId}/etok-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const { data: storageData, error: storageError } = await supabase.storage
    .from("etok-videos")
    .upload(filePath, blob, { contentType, upsert: false });

  if (storageError || !storageData) {
    console.error("[Etok] storage upload error:", storageError);
    throw new Error(storageError?.message || "Video upload failed");
  }

  const { data: urlData } = supabase.storage.from("etok-videos").getPublicUrl(storageData.path);
  const videoUrl = urlData.publicUrl;

  onProgress?.(70);

  // Insert into DB
  const { data, error } = await supabase
    .from("etok_videos")
    .insert({
      author_id: metadata.authorId,
      video_url: videoUrl,
      description: metadata.description,
      hashtags: metadata.hashtags,
      sound_name: metadata.soundName,
      duration: metadata.duration,
      privacy: metadata.privacy,
      allow_comments: metadata.allowComments,
      allow_duet: metadata.allowDuet,
      allow_stitch: metadata.allowStitch,
      allow_download: metadata.allowDownload,
    })
    .select("*, profiles!etok_videos_author_id_fkey(id, username, name, avatar_url, bio)")
    .single();

  onProgress?.(100);

  if (error) {
    console.error("[Etok] upload error:", error);
    await supabase.storage.from("etok-videos").remove([storageData.path]);
    throw new Error(error.message || "Could not save video post");
  }
  return data ? mapVideo(data) : null;
}

export async function recordVideoViewAsync(videoId: string, source: "fyp" | "following" | "search" | "profile" = "fyp"): Promise<void> {
  await supabase.rpc("record_etok_video_view", { _video_id: videoId, _source: source });
}

export async function recordVideoInteractionAsync(videoId: string, kind: "like" | "comment" | "share"): Promise<void> {
  await supabase.rpc("record_etok_video_interaction", { _video_id: videoId, _kind: kind });
}

/* ═══════════════════════════════════════════
   Utility
   ═══════════════════════════════════════════ */

export function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "K";
  return n.toString();
}

/* ═══════════════════════════════════════════
   Sounds & Hashtags (DB-backed)
   ═══════════════════════════════════════════ */

function mapSound(r: any): EtokSound {
  return {
    id: r.id,
    title: r.title,
    authorName: r.author_name,
    coverEmoji: r.cover_emoji,
    duration: r.duration,
    videoCount: r.video_count,
    isOriginal: r.is_original,
  };
}

function mapHashtag(r: any): EtokHashtag {
  return { id: r.id, name: r.name, viewCount: Number(r.view_count) || 0, trending: r.trending };
}

export async function fetchAllSounds(): Promise<EtokSound[]> {
  const { data } = await supabase.from("etok_sounds").select("*").order("video_count", { ascending: false });
  return (data ?? []).map(mapSound);
}

export async function fetchSoundById(id: string): Promise<EtokSound | null> {
  const { data } = await supabase.from("etok_sounds").select("*").eq("id", id).maybeSingle();
  return data ? mapSound(data) : null;
}

export async function fetchAllHashtags(): Promise<EtokHashtag[]> {
  const { data } = await supabase.from("etok_hashtags").select("*").order("view_count", { ascending: false });
  return (data ?? []).map(mapHashtag);
}

export async function fetchTrendingHashtags(): Promise<EtokHashtag[]> {
  const { data } = await supabase
    .from("etok_hashtags").select("*").eq("trending", true).order("view_count", { ascending: false });
  return (data ?? []).map(mapHashtag);
}

export async function searchSoundsAsync(query: string): Promise<EtokSound[]> {
  const q = query.trim();
  if (!q) return [];
  const { data } = await supabase
    .from("etok_sounds").select("*")
    .or(`title.ilike.%${q}%,author_name.ilike.%${q}%`)
    .limit(50);
  return (data ?? []).map(mapSound);
}

export async function searchHashtagsAsync(query: string): Promise<EtokHashtag[]> {
  const q = query.trim().replace(/^#/, "");
  if (!q) return [];
  const { data } = await supabase
    .from("etok_hashtags").select("*").ilike("name", `%${q}%`).limit(50);
  return (data ?? []).map(mapHashtag);
}


// Not-interested (kept in localStorage since it's client-side preference)
const NOT_INTERESTED_KEY = "etok_not_interested";
export function markNotInterested(videoId: string): void {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(NOT_INTERESTED_KEY) || "[]");
    if (!list.includes(videoId)) { list.push(videoId); localStorage.setItem(NOT_INTERESTED_KEY, JSON.stringify(list)); }
  } catch {}
}
export function getNotInterestedIds(): string[] {
  try { return JSON.parse(localStorage.getItem(NOT_INTERESTED_KEY) || "[]"); } catch { return []; }
}
