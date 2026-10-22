// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Star, Archive, Camera, Sparkles,
  Eye, Clock, Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatAvatar } from "@/components/ui/chat-avatar";
import { useAuth } from "@/contexts/AuthContext";
import {
  getActiveStories, getMyViewedStories, getArchivedStories,
  type Story, type StoryGroup,
} from "@/lib/storyService";
import { getAccessProfiles } from "@/lib/profileAccess";
import { useViewerEpoch } from "@/hooks/useViewerEpoch";
import { isCloseFriend, syncCloseFriends } from "@/lib/closeFriendsService";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StoriesBar, StoryCreator, StoryViewerComponent } from "@/components/stories/StoriesBar";

// ─── helpers ────────────────────────────────────────────────────────────────

function parseContent(c: string | null): Record<string, unknown> {
  if (!c) return {};
  try { const p = JSON.parse(c); if (p && typeof p === "object") return p; } catch {}
  return { text: c };
}

function ago(d: string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return "1d";
}

// gradient per user id — deterministic, unique
const CARD_GRADIENTS = [
  "linear-gradient(145deg,#7c3aed,#ec4899)",
  "linear-gradient(145deg,#06b6d4,#7c3aed)",
  "linear-gradient(145deg,#f97316,#ec4899)",
  "linear-gradient(145deg,#10b981,#06b6d4)",
  "linear-gradient(145deg,#f43f5e,#fb923c)",
  "linear-gradient(145deg,#8b5cf6,#3b82f6)",
  "linear-gradient(145deg,#ec4899,#f43f5e)",
  "linear-gradient(145deg,#0f172a,#7c3aed)",
];
function cardGradient(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) & 0xffffffff;
  return CARD_GRADIENTS[Math.abs(h) % CARD_GRADIENTS.length];
}

// ─── page ───────────────────────────────────────────────────────────────────

export default function Stories() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userId } = useAuth();

  const generation = useRef(0);
  const viewerEpoch = useViewerEpoch();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [myGroup, setMyGroup] = useState<StoryGroup | null>(null);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [archivedStories, setArchivedStories] = useState<Story[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);

  const loadStories = useCallback(async () => {
    if (!userId) return;
    const started = ++generation.current;
    setLoading(true); setError(false);
    try {
    await syncCloseFriends();
    const [stories, viewed] = await Promise.all([getActiveStories(), getMyViewedStories()]);
    if (started !== generation.current) return;
    setViewedIds(viewed);
    const grouped = new Map<string, Story[]>();
    for (const s of stories) { const a = grouped.get(s.user_id) || []; a.push(s); grouped.set(s.user_id, a); }
    const userIds = [...grouped.keys()];
    const profiles = new Map<string, { username: string; name: string; avatar_url: string | null }>();
    if (userIds.length) {
      const data = await getAccessProfiles(userIds);
      data.forEach(p => profiles.set(p.id, { username: p.username ?? '', name: p.name || 'Hidden profile', avatar_url: p.avatar_url }));
    }
    const all: StoryGroup[] = [];
    let mine: StoryGroup | null = null;
    if (grouped.has(userId)) {
      const own = grouped.get(userId) ?? [];
      const p = profiles.get(userId);
      mine = { user_id: userId, username: p?.username || "you", name: "Your Story", avatar_url: p?.avatar_url || null, stories: own, hasUnviewed: own.some(s => !viewed.has(s.id)) };
      all.push(mine);
    }
    for (const [uid, strs] of grouped) {
      if (uid === userId) continue;
      const p = profiles.get(uid);
      all.push({ user_id: uid, username: p?.username || "user", name: p?.name || "Hidden profile", avatar_url: p?.avatar_url || null, stories: strs, hasUnviewed: strs.some(s => !viewed.has(s.id)) });
    }
    const archived = await getArchivedStories(userId);
    if (started !== generation.current) return;
    setMyGroup(mine);
    setStoryGroups(all);
    const focused = searchParams.get("story");
    if (focused) { const idx = all.findIndex(g => g.stories.some(s => s.id === focused)); if (idx >= 0) setViewerIndex(idx); }
    setArchivedStories(archived);
    setLoading(false);
    } catch { if (started === generation.current) { setError(true); setLoading(false); } }
  }, [userId, viewerEpoch]);

  useEffect(() => { setStoryGroups([]); setMyGroup(null); setArchivedStories([]); setViewerIndex(null); void loadStories(); return () => { generation.current += 1; }; }, [loadStories]);

  const cfGroups   = storyGroups.filter(g => g.user_id !== userId && isCloseFriend(g.user_id));
  const freshGroups = storyGroups.filter(g => g.user_id !== userId && g.hasUnviewed && !isCloseFriend(g.user_id));
  const seenGroups  = storyGroups.filter(g => g.user_id !== userId && !g.hasUnviewed && !isCloseFriend(g.user_id));
  const othersTotal = storyGroups.filter(g => g.user_id !== userId).length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20">
        {/* gradient bar at very top */}
        <div className="h-[2px] w-full bg-gradient-to-r from-violet-500 via-pink-500 to-orange-400" />
        <div className="bg-background/95 backdrop-blur-xl px-4 pt-3 pb-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-muted/70">
                <ArrowLeft className="h-4.5 w-4.5" />
              </motion.button>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Stories</h1>
                {othersTotal > 0 && <p className="text-[11px] text-muted-foreground -mt-0.5">{othersTotal} active</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate("/close-friends")}
                className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-semibold"
                data-testid="button-close-friends">
                <Star className="h-3 w-3 fill-emerald-500" />
                Close Friends
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowArchive(v => !v)}
                className={`w-9 h-9 rounded-full flex items-center justify-center ${showArchive ? "bg-primary/15 text-primary" : "bg-muted/70 text-muted-foreground"}`}
                data-testid="button-toggle-archive">
                <Archive className="h-4 w-4" />
              </motion.button>
            </div>
          </div>

          {/* ── Horizontal scroll bar ─────────────────────────────── */}
          <StoriesBar />
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-28">

        {/* Archive */}
        <AnimatePresence>
          {showArchive && (
            <motion.div key="archive" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <SectionLabel icon={<Archive className="h-3.5 w-3.5" />} title={`Archive · ${archivedStories.length}`} />
              {archivedStories.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-5 px-4">No archived stories yet. Stories you post will be saved here.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 px-4 pb-4">
                  {archivedStories.map(s => (
                    <div key={s.id} className="aspect-[9/16] rounded-xl overflow-hidden relative opacity-50 ring-1 ring-white/10">
                      {s.media_url
                        ? <img src={s.media_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full" style={{ background: s.background_color || "#7c3aed" }}>
                            <div className="w-full h-full flex items-center justify-center p-2 bg-black/10">
                              <p className="text-white text-[9px] text-center font-semibold line-clamp-5">{String((parseContent(s.content) as Record<string, unknown>).text ?? s.content ?? "")}</p>
                            </div>
                          </div>
                      }
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5 text-white/60" />
                        <span className="text-[9px] text-white/60">{ago(s.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="h-px bg-border/50 mx-4 mb-1" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* My story big banner */}
        {!loading && (
          <MyStoryBanner group={myGroup} onAddStory={() => setShowCreator(true)} onOpen={() => setViewerIndex(storyGroups.findIndex(g => g.user_id === userId))} />
        )}

        {loading ? (
          <SkeletonGrid />
        ) : (
          <>
            {/* Close Friends section */}
            {cfGroups.length > 0 && (
              <section>
                <SectionLabel
                  icon={<Star className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />}
                  title="Close Friends"
                  accent="text-emerald-500"
                  badge={cfGroups.length}
                />
                <div className="grid grid-cols-2 gap-3 px-4 pb-2">
                  {cfGroups.map((g, i) => (
                    <StoryCard key={g.user_id} group={g} onOpen={() => setViewerIndex(storyGroups.findIndex(item => item.user_id === g.user_id))} viewedIds={viewedIds} index={i} isCF />
                  ))}
                </div>
              </section>
            )}

            {/* Fresh (unviewed) */}
            {freshGroups.length > 0 && (
              <section>
                <SectionLabel
                  icon={<Sparkles className="h-3.5 w-3.5 text-violet-400" />}
                  title="New Stories"
                  badge={freshGroups.length}
                />
                <div className="grid grid-cols-2 gap-3 px-4 pb-2">
                  {freshGroups.map((g, i) => (
                    <StoryCard key={g.user_id} group={g} onOpen={() => setViewerIndex(storyGroups.findIndex(item => item.user_id === g.user_id))} viewedIds={viewedIds} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* Seen */}
            {seenGroups.length > 0 && (
              <section>
                <SectionLabel
                  icon={<Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                  title="Viewed"
                  muted
                />
                <div className="grid grid-cols-2 gap-3 px-4 pb-4">
                  {seenGroups.map((g, i) => (
                    <StoryCard key={g.user_id} group={g} onOpen={() => setViewerIndex(storyGroups.findIndex(item => item.user_id === g.user_id))} viewedIds={viewedIds} index={i} seen />
                  ))}
                </div>
              </section>
            )}

            {/* Empty */}
            {othersTotal === 0 && (
              <EmptyState onAdd={() => setShowCreator(true)} onCF={() => navigate("/close-friends")} />
            )}
          </>
        )}
      </div>

      {/* ── Creator overlay ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreator && (
          <StoryCreator onClose={() => setShowCreator(false)} onCreated={() => { setShowCreator(false); loadStories(); }} />
        )}
      </AnimatePresence>

      {error && <div className="p-4 text-destructive" role="alert">Could not load stories. <Button variant="ghost" onClick={() => void loadStories()}>Retry</Button></div>}
      {viewerIndex !== null && <StoryViewerComponent groups={storyGroups} initialGroupIndex={viewerIndex} viewedIds={viewedIds} userId={userId ?? ''} onClose={() => { setViewerIndex(null); void loadStories(); }} onMarkViewed={id => setViewedIds(prev => new Set(prev).add(id))} />}
      {/* ── FAB ─────────────────────────────────────────────────────── */}
      <motion.button
        whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.06 }}
        onClick={() => setShowCreator(true)}
        className="fixed bottom-20 right-5 z-30 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center"
        style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}
        data-testid="button-fab-add-story"
      >
        <Plus className="h-6 w-6 text-white" />
      </motion.button>
    </div>
  );
}

// ─── MyStoryBanner ───────────────────────────────────────────────────────────

function MyStoryBanner({ group, onAddStory, onOpen }: { group: StoryGroup | null; onAddStory: () => void; onOpen: () => void }) {
  if (!group) {
    return (
      <motion.button
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        onClick={onAddStory}
        className="mx-4 mt-4 mb-2 w-[calc(100%-2rem)] h-28 rounded-2xl overflow-hidden relative flex items-center gap-4 px-5"
        style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(236,72,153,0.15))" }}
        data-testid="button-my-story-empty"
      >
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-violet-400/60 flex items-center justify-center bg-violet-500/10 shrink-0">
          <Camera className="h-7 w-7 text-violet-400" />
        </div>
        <div className="text-left">
          <p className="font-bold text-base">Add to Your Story</p>
          <p className="text-sm text-muted-foreground mt-0.5">Share a photo, video, or text</p>
        </div>
        <div className="absolute right-4 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
          <Plus className="h-5 w-5 text-white" />
        </div>
        <div className="absolute inset-0 rounded-2xl ring-1 ring-violet-400/20" />
      </motion.button>
    );
  }

  const latest = group.stories[0];
  const parsed = parseContent(latest?.content);
  return (
    <motion.div
      onClick={onOpen}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="mx-4 mt-4 mb-2 h-28 rounded-2xl overflow-hidden relative"
      data-testid="banner-my-story"
    >
      {latest?.media_url
        ? <img src={latest.media_url} alt="" className="w-full h-full object-cover" />
        : <div className="w-full h-full" style={{ background: latest?.background_color || "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
            {parsed.text && <div className="w-full h-full flex items-center justify-center bg-black/10 p-3">
              <p className="text-white font-semibold text-sm text-center line-clamp-3">{String(parsed.text)}</p>
            </div>}
          </div>
      }
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
      <div className="absolute inset-0 flex items-center gap-3 px-4">
        <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 shrink-0">
          <div className="p-[2px] rounded-full bg-black/40">
            <ChatAvatar name={group.name} src={group.avatar_url || undefined} size="sm" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">Your Story</p>
          <p className="text-white/60 text-xs">{group.stories.length} part{group.stories.length !== 1 ? "s" : ""} · {ago(latest?.created_at)}</p>
        </div>
        <Button variant="secondary" onClick={e => { e.stopPropagation(); onAddStory(); }}
          className="shrink-0 flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-3 h-8 rounded-full border border-white/30"
          data-testid="button-add-more-story">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      <div className="absolute top-0 left-0 right-0 flex gap-[3px] p-2">
        {group.stories.map((_, i) => (
          <div key={i} className="flex-1 h-[2.5px] rounded-full bg-white/60" />
        ))}
      </div>
    </motion.div>
  );
}

// ─── StoryCard ───────────────────────────────────────────────────────────────

function StoryCard({
  group, onOpen, viewedIds, index, seen = false, isCF = false,
}: {
  group: StoryGroup;
  onOpen: () => void;
  viewedIds: Set<string>;
  index: number;
  seen?: boolean;
  isCF?: boolean;
}) {
  const navigate = useNavigate();
  const latest = group.stories[0];
  const unviewed = group.stories.filter(s => !viewedIds.has(s.id)).length;
  const parsed = parseContent(latest?.content);
  const bg = cardGradient(group.user_id);

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, type: "spring", damping: 18 }}
      whileTap={{ scale: 0.95 }}
      onClick={onOpen}
      className="aspect-[9/16] rounded-2xl overflow-hidden relative text-left group"
      data-testid={`story-card-${group.user_id}`}
    >
      {/* background */}
      {latest?.media_url
        ? <img src={latest.media_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        : <div className="absolute inset-0" style={{ background: latest?.background_color || bg }} />
      }

      {/* blurred text preview */}
      {!latest?.media_url && parsed.text && (
        <div className="absolute inset-0 flex items-center justify-center p-5 bg-black/10">
          <p className="text-white font-bold text-center leading-snug" style={{ fontSize: "clamp(11px, 3.5vw, 15px)", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
            {String(parsed.text).slice(0, 80)}{String(parsed.text).length > 80 ? "…" : ""}
          </p>
        </div>
      )}

      {/* dark vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none" />

      {/* seen overlay */}
      {seen && <div className="absolute inset-0 bg-black/30 pointer-events-none" />}

      {/* progress dots at top */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex gap-[3px] z-10">
        {group.stories.map((s, i) => (
          <div key={s.id} className={`flex-1 h-[2.5px] rounded-full ${viewedIds.has(s.id) ? "bg-white/40" : "bg-white"}`} />
        ))}
      </div>

      {/* close friend badge */}
      {isCF && (
        <div className="absolute top-7 right-2.5 z-10">
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
            <Star className="h-2.5 w-2.5 fill-white text-white" />
          </div>
        </div>
      )}

      {/* unviewed count badge */}
      {unviewed > 0 && !isCF && (
        <div className="absolute top-7 right-2.5 z-10 bg-gradient-to-br from-violet-500 to-pink-500 text-white text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow-md">
          {unviewed}
        </div>
      )}

      {/* border ring */}
      {isCF
        ? <div className="absolute inset-0 rounded-2xl ring-2 ring-emerald-400/80 pointer-events-none" />
        : !seen && <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ boxShadow: "inset 0 0 0 2.5px rgba(139,92,246,0.9)" }} />
      }

      {/* bottom info */}
      <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 z-10">
        {/* avatar + name */}
        <div className="flex items-center gap-2 mb-1">
          <div className={`p-[2px] rounded-full shrink-0 ${isCF ? "bg-gradient-to-tr from-emerald-400 to-teal-500" : !seen ? "bg-gradient-to-tr from-violet-500 via-pink-500 to-orange-400" : "bg-white/20"}`}>
            <div className="p-[1.5px] rounded-full bg-black/30">
              <ChatAvatar name={group.name} src={group.avatar_url || undefined} size="sm" />
            </div>
          </div>
          <p className="text-white text-[11px] font-semibold truncate leading-tight" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
            {group.name.split(" ")[0]}
          </p>
        </div>
        {/* meta */}
        <div className="flex items-center justify-between">
          <span className="text-white/55 text-[9px]">{ago(latest?.created_at)}</span>
          <div className="flex items-center gap-1">
            <Eye className="h-2.5 w-2.5 text-white/40" />
            <span className="text-white/40 text-[9px]">{latest?.views_count || 0}</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// ─── SectionLabel ────────────────────────────────────────────────────────────

function SectionLabel({
  icon, title, accent, badge, muted = false,
}: {
  icon: React.ReactNode;
  title: string;
  accent?: string;
  badge?: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-4 pt-5 pb-3">
      <div className={`flex items-center gap-1.5 ${accent || (muted ? "text-muted-foreground" : "text-foreground")}`}>
        {icon}
        <span className="text-xs font-bold uppercase tracking-widest">{title}</span>
      </div>
      {badge !== undefined && badge > 0 && (
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
          <span className="text-[9px] text-white font-black">{badge}</span>
        </div>
      )}
    </div>
  );
}

// ─── Skeletons ───────────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 px-4 pt-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="aspect-[9/16] rounded-2xl overflow-hidden">
          <div className="w-full h-full bg-muted animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
        </div>
      ))}
    </div>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd, onCF }: { onAdd: () => void; onCF: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center px-8 py-16 gap-5 text-center"
    >
      {/* icon cluster */}
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 animate-pulse" />
        <div className="absolute inset-3 rounded-full bg-gradient-to-br from-violet-500/30 to-pink-500/30" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Users className="h-10 w-10 text-violet-400/70" />
        </div>
      </div>

      <div>
        <p className="text-base font-bold mb-1">No Stories Yet</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Stories from your contacts will appear here. Be the first to share one!
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-[220px]">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onAdd}
          className="w-full h-11 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}
          data-testid="button-empty-add-story"
        >
          <Camera className="h-4 w-4" /> Add Your Story
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onCF}
          className="w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-emerald-500/15 text-emerald-500"
          data-testid="button-empty-close-friends"
        >
          <Star className="h-4 w-4 fill-emerald-500" /> Manage Close Friends
        </motion.button>
      </div>
    </motion.div>
  );
}
