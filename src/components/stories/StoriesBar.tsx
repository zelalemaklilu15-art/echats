// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  Plus, X, Eye, Trash2, Camera, Type, Send, ChevronUp,
  Pause, Play, Volume2, VolumeX, Image as ImageIcon, Sparkles,
  Globe, Users2, Star, Link, Clock, HelpCircle,
  BarChart2, Smile, Download, Forward, ChevronRight, Palette,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatAvatar } from "@/components/ui/chat-avatar";
import { useAuth } from "@/contexts/AuthContext";
import {
  getActiveStories, createTextStory, createMediaStory,
  viewStory, getMyViewedStories, getStoryViewers, deleteStory,
  uploadStoryMedia, isStealthMode, archiveStory,
  type Story, type StoryGroup, type StoryViewerInfo,
} from "@/lib/storyService";
import { isCloseFriend } from "@/lib/closeFriendsService";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/supabaseStorage";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// =============================================
// CONSTANTS
// =============================================

const STORY_GRADIENTS = [
  { name: "Sunset",  value: "linear-gradient(135deg, #f97316, #ec4899)" },
  { name: "Ocean",   value: "linear-gradient(135deg, #06b6d4, #7c3aed)" },
  { name: "Aurora",  value: "linear-gradient(135deg, #10b981, #06b6d4, #7c3aed)" },
  { name: "Rose",    value: "linear-gradient(135deg, #f43f5e, #fb923c)" },
  { name: "Midnight",value: "linear-gradient(135deg, #1e1b4b, #4c1d95)" },
  { name: "Forest",  value: "linear-gradient(135deg, #166534, #15803d)" },
  { name: "Candy",   value: "linear-gradient(135deg, #ec4899, #a855f7, #6366f1)" },
  { name: "Cosmic",  value: "linear-gradient(135deg, #0f172a, #7c3aed, #ec4899)" },
];

const STORY_SOLID_COLORS = [
  "#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#7c3aed","#ec4899","#78716c",
];

const FONT_STYLES = [
  { id: "normal",  label: "Aa",  style: { fontWeight: 400, textShadow: "none" } },
  { id: "bold",    label: "AB",  style: { fontWeight: 900, textShadow: "none" } },
  { id: "neon",    label: "Neon",style: { fontWeight: 700, textShadow: "0 0 10px currentColor, 0 0 20px currentColor" } },
  { id: "bubble",  label: "Bub", style: { fontWeight: 800, WebkitTextStroke: "2px rgba(0,0,0,0.6)", color: "#fff" } },
  { id: "outline", label: "Otl", style: { fontWeight: 900, WebkitTextStroke: "2px #fff", color: "transparent" } },
];

const REACTION_EMOJIS = ["❤️","🔥","😂","😮","👏","💯"];
const POPULAR_EMOJIS = ["😍","🥳","🎉","✨","💫","⚡","🌟","🔥","❤️","🫶","😂","🤣","😎","💪","🙌","👀","🎶","🌈","🦋","💎"];

// =============================================
// TYPES
// =============================================

type StoryPrivacy = "everyone" | "contacts" | "close_friends";

interface StorySticker {
  id: string;
  type: "emoji" | "poll" | "question" | "countdown" | "link";
  x: number;
  y: number;
  emoji?: string;
  question?: string;
  options?: string[];
  votes?: Record<string, number>;
  prompt?: string;
  event?: string;
  endsAt?: string;
  url?: string;
  label?: string;
}

interface StoryContent {
  text?: string;
  caption?: string;
  textStyle?: string;
  privacy?: StoryPrivacy;
  stickers?: StorySticker[];
}

// =============================================
// HELPERS
// =============================================

function parseContent(raw: string | null): StoryContent {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object") return p as StoryContent;
  } catch {}
  return { text: raw };
}

function getPrivacyRing(group: StoryGroup): string {
  const parsed = parseContent(group.stories[0]?.content);
  const privacy = parsed.privacy;
  if (privacy === "close_friends") return "bg-gradient-to-tr from-green-400 to-emerald-500";
  if (group.hasUnviewed) return "bg-gradient-to-tr from-primary via-pink-500 to-orange-400";
  return "bg-muted-foreground/30";
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return "1d ago";
}

// =============================================
// STORIES BAR (horizontal scroll)
// =============================================

export function StoriesBar() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [myStoryGroup, setMyStoryGroup] = useState<StoryGroup | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  const loadStories = useCallback(async () => {
    if (!userId) return;
    const [stories, viewed] = await Promise.all([getActiveStories(), getMyViewedStories()]);
    setViewedIds(viewed);

    const grouped = new Map<string, Story[]>();
    for (const s of stories) {
      const arr = grouped.get(s.user_id) || [];
      arr.push(s);
      grouped.set(s.user_id, arr);
    }

    const userIds = Array.from(grouped.keys());
    const profiles = new Map<string, { username: string; name: string; avatar_url: string | null }>();
    if (userIds.length > 0) {
      const { data } = await supabase.from("profiles").select("id, username, name, avatar_url").in("id", userIds);
      for (const p of data || []) profiles.set(p.id, { username: p.username, name: p.name || p.username, avatar_url: p.avatar_url });
    }

    const allGroups: StoryGroup[] = [];
    let myGroup: StoryGroup | null = null;

    if (grouped.has(userId)) {
      const own = grouped.get(userId)!;
      const p = profiles.get(userId);
      myGroup = { user_id: userId, username: p?.username || "You", name: "Your Story", avatar_url: p?.avatar_url || null, stories: own, hasUnviewed: own.some(s => !viewed.has(s.id)) };
      allGroups.push(myGroup);
    }

    for (const [uid, strs] of grouped) {
      if (uid === userId) continue;
      const p = profiles.get(uid);
      allGroups.push({ user_id: uid, username: p?.username || "user", name: p?.name || p?.username || "User", avatar_url: p?.avatar_url || null, stories: strs, hasUnviewed: strs.some(s => !viewed.has(s.id)) });
    }

    setMyStoryGroup(myGroup);
    setStoryGroups(allGroups);
  }, [userId]);

  useEffect(() => { loadStories(); }, [loadStories]);

  const openViewer = (groupIdx: number) => {
    setCurrentGroupIndex(groupIdx);
    setShowViewer(true);
  };

  return (
    <>
      <div className="flex items-center gap-4 px-4 py-3 pb-4 overflow-x-auto scrollbar-hide" data-testid="stories-bar">
        {/* Add story / My story button */}
        <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowCreator(true)} className="flex flex-col items-center gap-1.5 min-w-[60px]" data-testid="button-add-story">
          <div className="relative">
            {myStoryGroup?.stories.length ? (
              <div
                onClick={(e) => { e.stopPropagation(); const idx = storyGroups.findIndex(g => g.user_id === userId); if (idx >= 0) openViewer(idx); }}
                className={`p-[2.5px] rounded-full ${getPrivacyRing(myStoryGroup)}`}
              >
                <div className="p-[2px] rounded-full bg-background">
                  <ChatAvatar name={myStoryGroup.name} src={myStoryGroup.avatar_url || undefined} size="md" />
                </div>
              </div>
            ) : (
              <div className="w-[62px] h-[62px] rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.12),rgba(236,72,153,0.12))", border: "2px dashed rgba(139,92,246,0.5)" }}>
                <Camera className="h-6 w-6 text-violet-400" />
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center border-[2px] border-background"
              style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
              <Plus className="h-2.5 w-2.5 text-white" />
            </div>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">My Story</span>
        </motion.button>

        {storyGroups.filter(g => g.user_id !== userId).map((group, i) => {
          const realIdx = storyGroups.findIndex(g => g.user_id === group.user_id);
          return <StoryCircle key={group.user_id} group={group} index={i} onClick={() => openViewer(realIdx)} />;
        })}

        {/* View All */}
        <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/stories")} className="flex flex-col items-center gap-1.5 min-w-[60px]" data-testid="button-all-stories">
          <div className="w-[62px] h-[62px] rounded-full bg-muted flex items-center justify-center ring-1 ring-border">
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">See All</span>
        </motion.button>
      </div>

      <AnimatePresence>
        {showCreator && (
          <StoryCreator onClose={() => setShowCreator(false)} onCreated={() => { setShowCreator(false); loadStories(); }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showViewer && storyGroups[currentGroupIndex] && (
          <StoryViewerComponent
            groups={storyGroups}
            initialGroupIndex={currentGroupIndex}
            viewedIds={viewedIds}
            userId={userId || ""}
            onClose={() => { setShowViewer(false); loadStories(); }}
            onMarkViewed={(id) => setViewedIds(prev => new Set(prev).add(id))}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// =============================================
// STORY CIRCLE
// =============================================

function StoryCircle({ group, index, onClick }: { group: StoryGroup; index: number; onClick: () => void }) {
  const ring = getPrivacyRing(group);
  const isCF = ring.includes("green");
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04, type: "spring", damping: 16 }}
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 min-w-[60px]"
      data-testid={`story-circle-${group.user_id}`}
    >
      <div className="relative">
        <div className={`p-[2.5px] rounded-full ${ring}`}>
          <div className="p-[2px] rounded-full bg-background">
            <ChatAvatar name={group.name} src={group.avatar_url || undefined} size="md" />
          </div>
        </div>
        {isCF && (
          <div className="absolute -bottom-0.5 -right-0.5 w-[16px] h-[16px] rounded-full bg-emerald-500 flex items-center justify-center border-[1.5px] border-background">
            <Star className="h-2 w-2 fill-white text-white" />
          </div>
        )}
      </div>
      <span className="text-[10px] font-medium text-foreground/70 truncate max-w-[58px]">{group.name.split(" ")[0]}</span>
    </motion.button>
  );
}

// =============================================
// STORY CREATOR
// =============================================

export function StoryCreator({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const navigate = useNavigate();
  // ── step: "create" = editor, "share" = privacy settings ──
  const [step, setStep] = useState<"create" | "share">("create");
  const [mode, setMode] = useState<"text" | "media">("text");
  const [text, setText] = useState("");
  const [selectedBg, setSelectedBg] = useState(STORY_GRADIENTS[0].value);
  const [bgTab, setBgTab] = useState<"gradient" | "solid">("gradient");
  const [fontStyle, setFontStyle] = useState(FONT_STYLES[0]);
  const [posting, setPosting] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<StoryPrivacy>("everyone");
  const [duration, setDuration] = useState(5);
  const [stickers, setStickers] = useState<StorySticker[]>([]);
  const [activeTool, setActiveTool] = useState<"bg" | "font" | "sticker" | null>(null);
  const [showStickerModal, setShowStickerModal] = useState<"poll" | "question" | "countdown" | "link" | null>(null);
  const [allowScreenshots, setAllowScreenshots] = useState(true);
  const [postToProfile, setPostToProfile] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Poll modal state
  const [pollQ, setPollQ] = useState("");
  const [pollOpts, setPollOpts] = useState(["", ""]);
  // Question modal state
  const [qPrompt, setQPrompt] = useState("");
  // Countdown modal state
  const [cdEvent, setCdEvent] = useState("");
  const [cdDate, setCdDate] = useState("");
  // Link modal state
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 50 * 1024 * 1024) { toast.error("Max 50MB"); return; }
    const isVid = file.type.startsWith("video/") || ["mp4","webm","mov","3gp"].includes((file.name.split(".").pop() || "").toLowerCase());
    setIsVideo(isVid);
    setMediaFile(file);
    if (isVid) { setMediaPreview(URL.createObjectURL(file)); }
    else { const r = new FileReader(); r.onload = () => setMediaPreview(r.result as string); r.readAsDataURL(file); }
    setMode("media");
  };

  const addSticker = (sticker: Omit<StorySticker, "id" | "x" | "y">) => {
    setStickers(prev => [...prev, { ...sticker, id: `stk_${Date.now()}`, x: 50, y: 50 }]);
    setShowStickerModal(null);
    setActiveTool(null);
  };

  const buildContent = (): string => JSON.stringify({
    text: mode === "text" ? text.trim() : undefined,
    caption: mode === "media" ? caption.trim() || undefined : undefined,
    textStyle: fontStyle.id,
    privacy,
    stickers: stickers.length > 0 ? stickers : undefined,
  } as StoryContent);

  const handlePost = async () => {
    setPosting(true);
    try {
      const json = buildContent();
      if (mode === "text") {
        if (!text.trim()) { setPosting(false); return; }
        if (await createTextStory(json, selectedBg)) { toast.success("Story posted!"); onCreated(); }
        else toast.error("Failed to post story");
      } else if (mediaFile) {
        let f = mediaFile;
        if (!isVideo && mediaFile.type.startsWith("image/")) { try { f = await compressImage(mediaFile); } catch {} }
        const { url, type } = await uploadStoryMedia(f);
        if (await createMediaStory(url, type, json)) { toast.success("Story posted!"); onCreated(); }
        else toast.error("Failed to post story");
      }
    } catch { toast.error("Failed to post story"); }
    finally { setPosting(false); }
  };

  const canPost = mode === "text" ? text.trim().length > 0 : !!mediaFile;

  // ── Privacy options (Telegram-style) ──
  const PRIVACY_OPTIONS: { id: StoryPrivacy; label: string; sub: string; color: string; bg: string; Icon: React.ElementType }[] = [
    { id: "everyone",      label: "Everyone",       sub: "exclude people",  color: "#fff",  bg: "#29b6f6", Icon: Globe },
    { id: "contacts",      label: "My Contacts",    sub: "exclude people",  color: "#fff",  bg: "#7c4dff", Icon: Users2 },
    { id: "close_friends", label: "Close Friends",  sub: "edit list",       color: "#fff",  bg: "#4caf50", Icon: Star },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaSelect} data-testid="input-story-file" />
      <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={handleMediaSelect} data-testid="input-story-camera" />

      {/* ── STEP 1: EDITOR ────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {step === "create" && (
          <motion.div key="create" initial={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "tween", duration: 0.25 }} className="absolute inset-0 flex flex-col">
            {/* Header */}
            <div className="flex items-center px-3 pt-10 pb-2 z-20">
              <button onClick={onClose} className="p-2 text-white" data-testid="button-close-creator">
                <ArrowLeft className="h-6 w-6" />
              </button>
              <span className="flex-1 text-center text-white font-semibold text-base">New Story</span>
              <button onClick={() => { fileInputRef.current?.click(); }} className="p-2 text-white opacity-70" data-testid="button-story-download">
                <Download className="h-5 w-5" />
              </button>
            </div>

            {/* Preview */}
            <div className="flex-1 relative overflow-hidden">
              {mode === "text" ? (
                <div className="w-full h-full flex items-center justify-center p-10" style={{ background: selectedBg }}>
                  <textarea
                    value={text} onChange={e => setText(e.target.value)}
                    placeholder="Type something..." maxLength={500} autoFocus
                    className="text-center text-[26px] bg-transparent border-none text-white placeholder:text-white/30 focus:outline-none resize-none w-full"
                    style={{ ...fontStyle.style, lineHeight: 1.4 }}
                    data-testid="input-story-text"
                  />
                </div>
              ) : mediaPreview ? (
                <div className="w-full h-full bg-black flex items-center justify-center">
                  {isVideo
                    ? <video src={mediaPreview} className="w-full h-full object-contain" autoPlay muted loop playsInline data-testid="video-story-preview" />
                    : <img src={mediaPreview} alt="" className="w-full h-full object-contain" data-testid="img-story-preview" />
                  }
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#111] cursor-pointer gap-4"
                  onClick={() => fileInputRef.current?.click()}>
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                    <ImageIcon className="h-9 w-9 text-white/50" />
                  </div>
                  <p className="text-white/40 text-sm">Tap to add a photo or video</p>
                </div>
              )}

              {/* Sticker overlays */}
              {stickers.map(stk => (
                <div key={stk.id} style={{ position: "absolute", left: `${stk.x}%`, top: `${stk.y}%`, transform: "translate(-50%,-50%)", zIndex: 15 }}>
                  <div className="relative group">
                    <StickerPreview sticker={stk} />
                    <button onClick={() => setStickers(p => p.filter(s => s.id !== stk.id))}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 group-active:opacity-100">×</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Caption bar */}
            <div className="bg-black px-3 pt-2 pb-1">
              <div className="flex items-center gap-2">
                <input
                  value={caption} onChange={e => setCaption(e.target.value)}
                  placeholder="Add a caption..."
                  className="flex-1 bg-transparent text-white placeholder:text-white/30 text-[15px] outline-none py-2"
                  data-testid="input-story-caption"
                />
                <div className="flex items-center gap-2.5 shrink-0">
                  <button onClick={() => setActiveTool(activeTool === "duration" ? null : "duration")}
                    className="w-9 h-9 rounded-full border border-white/30 flex items-center justify-center"
                    data-testid="button-story-duration">
                    <span className="text-white text-[13px] font-bold">{duration}</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 rounded-full border border-white/30 flex items-center justify-center" data-testid="button-story-gallery">
                    <Camera className="h-4.5 w-4.5 text-white" />
                  </button>
                </div>
              </div>
              {activeTool === "duration" && (
                <div className="flex gap-2 pb-2 pt-1">
                  {[5, 10, 15].map(d => (
                    <button key={d} onClick={() => { setDuration(d); setActiveTool(null); }}
                      className={`px-4 py-1 rounded-full text-sm font-semibold ${duration === d ? "bg-white text-black" : "bg-white/15 text-white"}`}
                      data-testid={`button-duration-${d}`}>{d}s</button>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom toolbar */}
            <div className="bg-black flex items-center px-5 pb-8 pt-1">
              <div className="flex items-center gap-6 flex-1">
                {/* Pen → font style */}
                <button onClick={() => setActiveTool(activeTool === "font" ? null : "font")}
                  className={`p-2 ${activeTool === "font" ? "text-white" : "text-white/50"}`}
                  data-testid="button-tool-font">
                  <Palette className="h-6 w-6" />
                </button>
                {/* Sticker */}
                <button onClick={() => setActiveTool(activeTool === "sticker" ? null : "sticker")}
                  className={`p-2 ${activeTool === "sticker" ? "text-white" : "text-white/50"}`}
                  data-testid="button-tool-sticker">
                  <Smile className="h-6 w-6" />
                </button>
                {/* Text style */}
                <button onClick={() => setActiveTool(activeTool === "font" ? null : "font")}
                  className={`p-2 text-white/50`}
                  data-testid="button-tool-text">
                  <Type className="h-6 w-6" />
                </button>
                {/* BG */}
                <button onClick={() => setActiveTool(activeTool === "bg" ? null : "bg")}
                  className={`p-2 ${activeTool === "bg" ? "text-white" : "text-white/50"}`}
                  data-testid="button-tool-bg">
                  <Sparkles className="h-6 w-6" />
                </button>
              </div>
              <button
                onClick={() => { if (canPost) setStep("share"); }}
                disabled={!canPost}
                className={`flex items-center gap-1.5 px-5 h-11 rounded-full text-white font-semibold text-[15px] transition-opacity ${canPost ? "opacity-100" : "opacity-40"}`}
                style={{ background: canPost ? "#29b6f6" : "#555" }}
                data-testid="button-story-next"
              >
                NEXT <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Tool panels (slide up) */}
            <AnimatePresence>
              {activeTool === "bg" && (
                <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25 }}
                  className="absolute bottom-0 left-0 right-0 bg-[#1a1a1a] rounded-t-2xl p-4 z-30">
                  <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
                  <div className="flex gap-2 mb-3">
                    {(["gradient","solid"] as const).map(t => (
                      <button key={t} onClick={() => setBgTab(t)} className={`px-4 py-1.5 rounded-full text-sm font-semibold ${bgTab === t ? "bg-white text-black" : "bg-white/10 text-white"}`}>{t === "gradient" ? "Gradients" : "Colors"}</button>
                    ))}
                  </div>
                  {bgTab === "gradient" ? (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {STORY_GRADIENTS.map(g => (
                        <button key={g.name} onClick={() => setSelectedBg(g.value)}
                          className={`flex-shrink-0 w-14 h-14 rounded-2xl border-[2.5px] transition-all ${selectedBg === g.value ? "border-white scale-105" : "border-transparent"}`}
                          style={{ background: g.value }}>
                          {selectedBg === g.value && <div className="w-full h-full rounded-xl flex items-center justify-center"><div className="w-4 h-4 rounded-full bg-white/60" /></div>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-3 flex-wrap pb-2">
                      {STORY_SOLID_COLORS.map(c => (
                        <button key={c} onClick={() => setSelectedBg(c)}
                          className={`w-12 h-12 rounded-2xl border-[2.5px] transition-all ${selectedBg === c ? "border-white scale-105" : "border-transparent"}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  )}
                  <button onClick={() => setActiveTool(null)} className="mt-2 w-full text-center text-white/50 text-sm py-2">Done</button>
                </motion.div>
              )}

              {activeTool === "font" && (
                <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25 }}
                  className="absolute bottom-0 left-0 right-0 bg-[#1a1a1a] rounded-t-2xl p-4 z-30">
                  <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
                  <p className="text-white/50 text-xs uppercase tracking-widest mb-3 text-center">Font Style</p>
                  <div className="flex gap-3 justify-center flex-wrap">
                    {FONT_STYLES.map(fs => (
                      <button key={fs.id} onClick={() => setFontStyle(fs)}
                        className={`px-5 py-3 rounded-xl text-lg text-white transition-all ${fontStyle.id === fs.id ? "bg-white/25 ring-2 ring-white" : "bg-white/10"}`}
                        style={fs.style}>{fs.label}</button>
                    ))}
                  </div>
                  <button onClick={() => setActiveTool(null)} className="mt-4 w-full text-center text-white/50 text-sm py-2">Done</button>
                </motion.div>
              )}

              {activeTool === "sticker" && (
                <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25 }}
                  className="absolute bottom-0 left-0 right-0 bg-[#1a1a1a] rounded-t-2xl p-4 z-30">
                  <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
                  <p className="text-white/50 text-xs uppercase tracking-widest mb-3 text-center">Add Sticker</p>
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                    {POPULAR_EMOJIS.map(em => (
                      <button key={em} onClick={() => { addSticker({ type: "emoji", emoji: em }); }} className="text-2xl flex-shrink-0 w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">{em}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { icon: BarChart2, label: "Poll",      action: () => setShowStickerModal("poll"),      bg: "#29b6f6" },
                      { icon: HelpCircle,label: "Q&A",       action: () => setShowStickerModal("question"),  bg: "#7c4dff" },
                      { icon: Clock,     label: "Countdown", action: () => setShowStickerModal("countdown"), bg: "#ff7043" },
                      { icon: Link,      label: "Link",      action: () => setShowStickerModal("link"),      bg: "#4caf50" },
                    ].map(btn => (
                      <button key={btn.label} onClick={btn.action}
                        className="flex flex-col items-center gap-1.5 py-3 rounded-2xl"
                        style={{ background: btn.bg + "22" }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: btn.bg }}>
                          <btn.icon className="h-4.5 w-4.5 text-white" />
                        </div>
                        <span className="text-white text-[11px] font-medium">{btn.label}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setActiveTool(null)} className="mt-3 w-full text-center text-white/50 text-sm py-2">Done</button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sticker modals */}
            <AnimatePresence>
              {showStickerModal === "poll" && (
                <StickerModal title="Create Poll" onClose={() => setShowStickerModal(null)}
                  onAdd={() => { if (!pollQ.trim()) return; addSticker({ type: "poll", question: pollQ, options: pollOpts.filter(Boolean), votes: {} }); setPollQ(""); setPollOpts(["",""]); }}>
                  <Input value={pollQ} onChange={e => setPollQ(e.target.value)} placeholder="Poll question..." className="mb-2" />
                  {pollOpts.map((opt, i) => <Input key={i} value={opt} onChange={e => { const n=[...pollOpts]; n[i]=e.target.value; setPollOpts(n); }} placeholder={`Option ${i+1}`} className="mb-1" />)}
                  {pollOpts.length < 4 && <button onClick={() => setPollOpts(p=>[...p,""])} className="text-primary text-sm">+ Add option</button>}
                </StickerModal>
              )}
              {showStickerModal === "question" && (
                <StickerModal title="Q&A Sticker" onClose={() => setShowStickerModal(null)}
                  onAdd={() => { if (!qPrompt.trim()) return; addSticker({ type: "question", prompt: qPrompt }); setQPrompt(""); }}>
                  <Input value={qPrompt} onChange={e => setQPrompt(e.target.value)} placeholder="Ask your followers something..." />
                </StickerModal>
              )}
              {showStickerModal === "countdown" && (
                <StickerModal title="Countdown Timer" onClose={() => setShowStickerModal(null)}
                  onAdd={() => { if (!cdEvent.trim() || !cdDate) return; addSticker({ type: "countdown", event: cdEvent, endsAt: cdDate }); setCdEvent(""); setCdDate(""); }}>
                  <Input value={cdEvent} onChange={e => setCdEvent(e.target.value)} placeholder="Event name..." className="mb-2" />
                  <Input type="datetime-local" value={cdDate} onChange={e => setCdDate(e.target.value)} />
                </StickerModal>
              )}
              {showStickerModal === "link" && (
                <StickerModal title="Link Sticker" onClose={() => setShowStickerModal(null)}
                  onAdd={() => { if (!linkUrl.trim()) return; addSticker({ type: "link", url: linkUrl, label: linkLabel || linkUrl }); setLinkUrl(""); setLinkLabel(""); }}>
                  <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." className="mb-2" />
                  <Input value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder="Link label (optional)" />
                </StickerModal>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── STEP 2: SHARE SETTINGS ──────────────────────────────── */}
        {step === "share" && (
          <motion.div key="share" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "tween", duration: 0.25 }}
            className="absolute inset-0 flex flex-col bg-[#0e0e0e]">
            {/* blurred preview behind */}
            <div className="absolute inset-0 overflow-hidden">
              {mediaPreview && !isVideo && (
                <img src={mediaPreview} alt="" className="w-full h-full object-cover opacity-20 blur-2xl scale-110" />
              )}
              {mode === "text" && (
                <div className="w-full h-full opacity-10" style={{ background: selectedBg }} />
              )}
            </div>

            {/* header */}
            <div className="relative flex items-center px-3 pt-10 pb-3 z-10">
              <button onClick={() => setStep("create")} className="p-2 text-white">
                <ArrowLeft className="h-6 w-6" />
              </button>
              <span className="flex-1 text-center text-white font-semibold text-base">New Story</span>
              <div className="w-10" />
            </div>

            {/* scrollable panel */}
            <div className="relative z-10 flex-1 overflow-y-auto">
              <div className="mx-4 rounded-2xl overflow-hidden" style={{ background: "#1c1c1e" }}>
                {/* section title */}
                <div className="px-4 pt-5 pb-3">
                  <h2 className="text-white text-xl font-bold">Share story</h2>
                  <p className="text-white/40 text-sm mt-0.5">Choose who can view your story</p>
                </div>

                {/* privacy radio list */}
                {PRIVACY_OPTIONS.map((opt, i) => (
                  <button key={opt.id} onClick={() => setPrivacy(opt.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-white/5 transition-colors"
                    style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.07)" : undefined }}
                    data-testid={`button-privacy-${opt.id}`}>
                    {/* custom radio */}
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${privacy === opt.id ? "border-[#29b6f6]" : "border-white/30"}`}>
                      {privacy === opt.id && <div className="w-2.5 h-2.5 rounded-full bg-[#29b6f6]" />}
                    </div>
                    {/* colored icon */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: opt.bg }}>
                      <opt.Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium text-[15px]">{opt.label}</p>
                      <p className="text-[#29b6f6] text-[13px] mt-0.5">{opt.sub} ›</p>
                    </div>
                  </button>
                ))}

                <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-[#29b6f6] text-sm">
                    Select people who will never see your stories.
                  </p>
                </div>
              </div>

              {/* toggles */}
              <div className="mx-4 mt-3 rounded-2xl overflow-hidden" style={{ background: "#1c1c1e" }}>
                <div className="flex items-center justify-between px-4 py-4">
                  <span className="text-white text-[15px]">Allow Screenshots</span>
                  <button onClick={() => setAllowScreenshots(v => !v)}
                    className={`w-12 h-7 rounded-full transition-colors flex items-center px-0.5 ${allowScreenshots ? "bg-[#29b6f6]" : "bg-white/15"}`}
                    data-testid="switch-allow-screenshots">
                    <motion.div animate={{ x: allowScreenshots ? 20 : 0 }} transition={{ type: "spring", damping: 20 }}
                      className="w-6 h-6 rounded-full bg-white shadow-md" />
                  </button>
                </div>
                <div className="flex items-center justify-between px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="text-white text-[15px]">Post to My Profile</span>
                  <button onClick={() => setPostToProfile(v => !v)}
                    className={`w-12 h-7 rounded-full transition-colors flex items-center px-0.5 ${postToProfile ? "bg-[#29b6f6]" : "bg-white/15"}`}
                    data-testid="switch-post-to-profile">
                    <motion.div animate={{ x: postToProfile ? 20 : 0 }} transition={{ type: "spring", damping: 20 }}
                      className="w-6 h-6 rounded-full bg-white shadow-md" />
                  </button>
                </div>
                <div className="flex items-center justify-between px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="text-white text-[15px]">Album</span>
                  <span className="text-[#29b6f6] text-[15px]">All Stories ›</span>
                </div>
              </div>

              <p className="text-white/30 text-[12px] px-8 mt-3 text-center leading-relaxed">
                Keep this story on your profile even after it expires in 24 hours. Privacy settings will apply.
              </p>

              <div className="h-32" />
            </div>

            {/* Post button */}
            <div className="relative z-10 px-4 pb-10 pt-3">
              <button onClick={handlePost} disabled={posting}
                className="w-full h-14 rounded-full text-white font-semibold text-[17px] flex items-center justify-center transition-opacity disabled:opacity-60"
                style={{ background: "linear-gradient(90deg,#29b6f6,#0288d1)" }}
                data-testid="button-post-story">
                {posting ? "Posting..." : "Post Story"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StickerModal({ title, children, onClose, onAdd }: { title: string; children: React.ReactNode; onClose: () => void; onAdd: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/70 flex items-end">
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25 }}
        className="w-full bg-background rounded-t-2xl p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-foreground">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        {children}
        <Button onClick={onAdd} className="w-full">Add Sticker</Button>
      </motion.div>
    </motion.div>
  );
}

function StickerPreview({ sticker }: { sticker: StorySticker }) {
  if (sticker.type === "emoji") return <div className="text-3xl select-none">{sticker.emoji}</div>;
  if (sticker.type === "poll") return (
    <div className="bg-white/90 text-black rounded-xl px-3 py-2 max-w-[140px]">
      <p className="text-xs font-bold text-center mb-1">{sticker.question}</p>
      {(sticker.options || []).slice(0, 2).map((opt, i) => (
        <div key={i} className="text-[10px] text-center bg-black/10 rounded-full px-2 py-0.5 mb-0.5">{opt}</div>
      ))}
    </div>
  );
  if (sticker.type === "question") return (
    <div className="bg-gradient-to-br from-violet-500 to-pink-500 text-white rounded-xl px-3 py-2 max-w-[140px]">
      <p className="text-[10px] font-bold text-center">{sticker.prompt}</p>
      <div className="mt-1 bg-white/20 rounded-lg text-[10px] text-center py-0.5 text-white/60">Tap to answer</div>
    </div>
  );
  if (sticker.type === "countdown") {
    const diff = Math.max(0, new Date(sticker.endsAt || "").getTime() - Date.now());
    const h = Math.floor(diff / 3600000);
    return (
      <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-xl px-3 py-2 max-w-[140px] text-center">
        <p className="text-[10px] font-bold">{sticker.event}</p>
        <p className="text-lg font-mono font-black">{h}h</p>
      </div>
    );
  }
  if (sticker.type === "link") return (
    <div className="bg-white/90 text-black rounded-xl px-3 py-1.5 max-w-[140px] flex items-center gap-1">
      <Link className="h-3 w-3 text-blue-500 shrink-0" />
      <span className="text-[10px] font-semibold truncate">{sticker.label}</span>
    </div>
  );
  return null;
}

// =============================================
// STORY VIEWER
// =============================================

function StoryViewerComponent({
  groups, initialGroupIndex, viewedIds, userId, onClose, onMarkViewed,
}: {
  groups: StoryGroup[];
  initialGroupIndex: number;
  viewedIds: Set<string>;
  userId: string;
  onClose: () => void;
  onMarkViewed: (id: string) => void;
}) {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerInfo[]>([]);
  const [replyText, setReplyText] = useState("");
  const [flyEmojis, setFlyEmojis] = useState<{ id: string; emoji: string; x: number }[]>([]);
  const [showForward, setShowForward] = useState(false);
  const [forwardChats, setForwardChats] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [votedPoll, setVotedPoll] = useState<Record<string, string>>({});
  const [questionAnswer, setQuestionAnswer] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];
  const isOwn = group?.user_id === userId;
  const isVideoStory = story?.story_type === "video" || story?.media_type === "video";
  const parsed = parseContent(story?.content || null);
  const storyStickers = parsed.stickers || [];
  const caption = parsed.caption || (parsed.text === undefined && story?.content && !story.content.startsWith("{") ? story.content : undefined);

  useEffect(() => {
    if (story && !viewedIds.has(story.id)) {
      if (!isStealthMode()) {
        viewStory(story.id);
      }
      onMarkViewed(story.id);
    }
    archiveStory(story!);
  }, [story?.id]);

  const goNext = useCallback(() => {
    if (!group) return;
    if (storyIndex < group.stories.length - 1) { setStoryIndex(i => i + 1); }
    else if (groupIndex < groups.length - 1) { setGroupIndex(i => i + 1); setStoryIndex(0); }
    else { onClose(); }
    setProgress(0); progressRef.current = 0; setShowViewers(false);
  }, [group, storyIndex, groupIndex, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) { setStoryIndex(i => i - 1); }
    else if (groupIndex > 0) { setGroupIndex(i => i - 1); setStoryIndex(groups[groupIndex - 1].stories.length - 1); }
    setProgress(0); progressRef.current = 0;
  }, [storyIndex, groupIndex, groups]);

  useEffect(() => {
    if (!story || isPaused || showViewers) return;
    const durationMs = (story.duration || 5) * 1000;
    if (isVideoStory && videoRef.current) {
      videoRef.current.play().catch(() => {});
      const upd = () => {
        const v = videoRef.current;
        if (!v || isPaused) return;
        if (v.duration && v.currentTime) {
          const pct = (v.currentTime / v.duration) * 100;
          setProgress(pct); progressRef.current = pct;
          if (v.currentTime >= v.duration - 0.1) { goNext(); return; }
        }
        animFrameRef.current = requestAnimationFrame(upd);
      };
      animFrameRef.current = requestAnimationFrame(upd);
      return () => cancelAnimationFrame(animFrameRef.current);
    }
    startTimeRef.current = Date.now() - (progressRef.current / 100) * durationMs;
    const tick = () => {
      if (isPaused) return;
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / durationMs) * 100, 100);
      setProgress(pct); progressRef.current = pct;
      if (pct >= 100) { goNext(); return; }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [story?.id, isPaused, showViewers, isVideoStory, goNext]);

  useEffect(() => {
    setProgress(0); progressRef.current = 0; startTimeRef.current = Date.now(); pausedAtRef.current = 0;
  }, [story?.id]);

  const handlePause = useCallback(() => {
    setIsPaused(true); pausedAtRef.current = Date.now();
    if (isVideoStory && videoRef.current) videoRef.current.pause();
  }, [isVideoStory]);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    if (pausedAtRef.current && startTimeRef.current) startTimeRef.current += Date.now() - pausedAtRef.current;
    if (isVideoStory && videoRef.current) videoRef.current.play().catch(() => {});
  }, [isVideoStory]);

  const handlePointerDown = () => {
    isLongPressRef.current = false;
    longPressRef.current = setTimeout(() => { isLongPressRef.current = true; handlePause(); }, 200);
  };
  const handlePointerUp = (side: "left" | "right") => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    if (isLongPressRef.current) { handleResume(); isLongPressRef.current = false; return; }
    if (side === "left") goPrev(); else goNext();
  };

  const handleSwipeEnd = (_: unknown, info: PanInfo) => { if (info.offset.y > 100) onClose(); };

  const loadViewers = async () => { if (!story) return; setViewers(await getStoryViewers(story.id)); };
  const toggleViewers = () => {
    if (!showViewers) { handlePause(); loadViewers(); } else handleResume();
    setShowViewers(!showViewers);
  };

  const handleReaction = async (emoji: string) => {
    const x = 20 + Math.random() * 60;
    const id = `fly_${Date.now()}_${Math.random()}`;
    setFlyEmojis(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setFlyEmojis(prev => prev.filter(f => f.id !== id)), 2000);

    if (!group || isOwn) return;
    try {
      const { data: existingChat } = await supabase.from("chats").select("id").or(`and(participant_1.eq.${userId},participant_2.eq.${group.user_id}),and(participant_1.eq.${group.user_id},participant_2.eq.${userId})`).maybeSingle();
      let chatId = existingChat?.id;
      if (!chatId) {
        const { data: newChat } = await supabase.from("chats").insert({ participant_1: userId, participant_2: group.user_id }).select("id").single();
        chatId = newChat?.id;
      }
      if (chatId) {
        await supabase.from("messages").insert({ chat_id: chatId, sender_id: userId, receiver_id: group.user_id, content: `${emoji} — reacted to your story`, message_type: "text" });
      }
    } catch {}
  };

  const handleDownload = async () => {
    if (!story) return;
    if (story.media_url) {
      try {
        const res = await fetch(story.media_url);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `story_${story.id}`;
        a.click(); URL.revokeObjectURL(url);
        toast.success("Story saved!");
      } catch { toast.error("Couldn't download story"); }
    }
  };

  const openForward = async () => {
    handlePause();
    const { data: chats } = await supabase.from("chats").select("id, participant_1, participant_2").or(`participant_1.eq.${userId},participant_2.eq.${userId}`).limit(10);
    if (!chats) return;
    const ids = chats.map(c => c.participant_1 === userId ? c.participant_2 : c.participant_1);
    const { data: profiles } = await supabase.from("profiles").select("id, name, username, avatar_url").in("id", ids);
    setForwardChats((profiles || []).map(p => ({ id: chats.find(c => c.participant_1 === p.id || c.participant_2 === p.id)!.id, name: p.name || p.username, avatar_url: p.avatar_url })));
    setShowForward(true);
  };

  const sendForward = async (chatId: string) => {
    if (!story || !group) return;
    const text = story.media_url ? `📖 Forwarded story from ${group.name}` : `📖 "${parsed.text || story.content}"`;
    await supabase.from("messages").insert({ chat_id: chatId, sender_id: userId, receiver_id: "", content: text, message_type: "text" });
    toast.success("Story forwarded!");
    setShowForward(false);
    handleResume();
  };

  const handleReply = async () => {
    if (!replyText.trim() || !group) return;
    try {
      const { data: existing } = await supabase.from("chats").select("id").or(`and(participant_1.eq.${userId},participant_2.eq.${group.user_id}),and(participant_1.eq.${group.user_id},participant_2.eq.${userId})`).maybeSingle();
      let chatId = existing?.id;
      if (!chatId) {
        const { data: newChat } = await supabase.from("chats").insert({ participant_1: userId, participant_2: group.user_id }).select("id").single();
        chatId = newChat?.id;
      }
      if (chatId) {
        await supabase.from("messages").insert({ chat_id: chatId, sender_id: userId, receiver_id: group.user_id, content: replyText.trim(), message_type: "text" });
        toast.success("Reply sent");
      }
    } catch { toast.error("Failed to send reply"); }
    setReplyText(""); handleResume();
  };

  if (!story || !group) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: isPaused ? 0.97 : 1 }} exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.3} onDragEnd={handleSwipeEnd}
      className="fixed inset-0 z-50 bg-black flex flex-col select-none"
      style={{ filter: isPaused ? "brightness(0.8)" : "brightness(1)", transition: "filter 0.2s" }}
      data-testid="story-viewer"
    >
      {/* Progress Bars */}
      <div className="flex gap-[2px] px-2 pt-safe-top pt-2 z-20" data-testid="story-progress-bars">
        {group.stories.map((s, i) => (
          <div key={s.id} className="flex-1 h-[2px] rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-white rounded-full transition-none" style={{ width: i < storyIndex ? "100%" : i === storyIndex ? `${progress}%` : "0%" }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 z-20">
        <div className="flex items-center gap-2">
          <ChatAvatar name={group.name} src={group.avatar_url || undefined} size="sm" />
          <div>
            <p className="text-white text-sm font-semibold">{isOwn ? "Your Story" : group.name}</p>
            <p className="text-white/50 text-[11px]">{getTimeAgo(story.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isVideoStory && (
            <Button variant="ghost" size="icon" onClick={() => { setIsMuted(!isMuted); if (videoRef.current) videoRef.current.muted = !isMuted; }} className="text-white h-8 w-8" data-testid="button-toggle-mute">
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => isPaused ? handleResume() : handlePause()} className="text-white h-8 w-8" data-testid="button-toggle-pause">
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={openForward} className="text-white h-8 w-8" data-testid="button-forward-story">
            <Forward className="h-4 w-4" />
          </Button>
          {(isOwn || story.media_url) && (
            <Button variant="ghost" size="icon" onClick={handleDownload} className="text-white h-8 w-8" data-testid="button-download-story">
              <Download className="h-4 w-4" />
            </Button>
          )}
          {isOwn && (
            <Button variant="ghost" size="icon" onClick={async () => { await deleteStory(story.id); toast.success("Story deleted"); if (group.stories.length <= 1) onClose(); else goNext(); }} className="text-white h-8 w-8" data-testid="button-delete-story">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white h-8 w-8" data-testid="button-close-viewer">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Story Content */}
      <div className="flex-1 relative overflow-hidden">
        {story.story_type === "text" ? (
          <div className="w-full h-full flex items-center justify-center p-8" style={{ background: story.background_color }}>
            <p className="text-white text-2xl text-center leading-relaxed max-w-md" style={FONT_STYLES.find(f => f.id === (parsed.textStyle || "normal"))?.style}>
              {parsed.text || story.content}
            </p>
          </div>
        ) : isVideoStory ? (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <video ref={videoRef} src={story.media_url || ""} className="w-full h-full object-contain" autoPlay muted={isMuted} playsInline preload="auto" data-testid="video-story-playback" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <img src={story.media_url || ""} alt="Story" className="w-full h-full object-contain" data-testid="img-story-display" />
          </div>
        )}

        {/* Caption Overlay */}
        {caption && (
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-16 bg-gradient-to-t from-black/70 to-transparent z-10 pointer-events-none">
            <p className="text-white text-center text-sm font-medium leading-relaxed">{caption}</p>
          </div>
        )}

        {/* Interactive Stickers */}
        {storyStickers.map(stk => (
          <ViewerSticker key={stk.id} sticker={stk} userId={userId} group={group} votedPoll={votedPoll} setVotedPoll={setVotedPoll}
            questionAnswer={questionAnswer} setQuestionAnswer={setQuestionAnswer} onSendAnswer={async (ans) => {
              try {
                const { data: existing } = await supabase.from("chats").select("id").or(`and(participant_1.eq.${userId},participant_2.eq.${group.user_id}),and(participant_1.eq.${group.user_id},participant_2.eq.${userId})`).maybeSingle();
                let chatId = existing?.id;
                if (!chatId) { const { data: nc } = await supabase.from("chats").insert({ participant_1: userId, participant_2: group.user_id }).select("id").single(); chatId = nc?.id; }
                if (chatId) { await supabase.from("messages").insert({ chat_id: chatId, sender_id: userId, receiver_id: group.user_id, content: `💬 Answer to "${stk.prompt}": ${ans}`, message_type: "text" }); toast.success("Answer sent!"); }
              } catch {}
            }} />
        ))}

        {/* Tap zones */}
        <div className="absolute left-0 top-0 w-1/3 h-full z-20" onPointerDown={handlePointerDown} onPointerUp={() => handlePointerUp("left")} onPointerCancel={() => { if (longPressRef.current) clearTimeout(longPressRef.current); if (isLongPressRef.current) handleResume(); }} />
        <div className="absolute right-0 top-0 w-1/3 h-full z-20" onPointerDown={handlePointerDown} onPointerUp={() => handlePointerUp("right")} onPointerCancel={() => { if (longPressRef.current) clearTimeout(longPressRef.current); if (isLongPressRef.current) handleResume(); }} />

        {/* Flying emoji reactions */}
        {flyEmojis.map(f => (
          <motion.div key={f.id} initial={{ y: 0, opacity: 1, scale: 1 }} animate={{ y: -200, opacity: 0, scale: 1.5 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
            className="absolute bottom-24 text-3xl pointer-events-none z-30" style={{ left: `${f.x}%` }}>
            {f.emoji}
          </motion.div>
        ))}
      </div>

      {/* Bottom Controls */}
      <div className="px-3 pb-safe-bottom pb-3 z-20 space-y-2">
        {/* Reaction bar */}
        <div className="flex items-center justify-center gap-3">
          {REACTION_EMOJIS.map(em => (
            <motion.button key={em} whileTap={{ scale: 1.4 }} onClick={() => handleReaction(em)} className="text-2xl" data-testid={`button-react-${em}`}>{em}</motion.button>
          ))}
        </div>

        {isOwn ? (
          <div className="flex items-center justify-center">
            <Button variant="ghost" onClick={toggleViewers} className="text-white/70 gap-1" data-testid="button-show-viewers">
              <Eye className="h-4 w-4" />
              <span className="text-sm">{story.views_count} views</span>
              <ChevronUp className={`h-4 w-4 transition-transform ${showViewers ? "rotate-180" : ""}`} />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={`Reply to ${group.name}...`}
              className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-full"
              onFocus={handlePause} onBlur={() => { if (!replyText) handleResume(); }}
              onKeyDown={e => { if (e.key === "Enter") handleReply(); }}
              data-testid="input-story-reply" />
            {replyText.trim() && (
              <Button size="icon" onClick={handleReply} className="rounded-full" data-testid="button-send-reply">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Viewers Sheet */}
      <AnimatePresence>
        {showViewers && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25 }}
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl z-30 max-h-[60%] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold">Viewers ({viewers.length})</h3>
              <Button variant="ghost" size="icon" onClick={toggleViewers}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {viewers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No viewers yet</p>
              ) : viewers.map(v => (
                <div key={v.viewer_id} className="flex items-center gap-3 p-2 rounded-lg">
                  <ChatAvatar name={v.name} src={v.avatar_url || undefined} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.name}</p>
                    <p className="text-xs text-muted-foreground">@{v.username}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Forward Sheet */}
      <AnimatePresence>
        {showForward && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25 }}
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl z-30 max-h-[50%] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold">Forward Story</h3>
              <Button variant="ghost" size="icon" onClick={() => { setShowForward(false); handleResume(); }}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {forwardChats.map(c => (
                <button key={c.id} onClick={() => sendForward(c.id)} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted text-left" data-testid={`button-forward-to-${c.id}`}>
                  <ChatAvatar name={c.name} src={c.avatar_url || undefined} size="sm" />
                  <span className="font-medium text-sm">{c.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// =============================================
// INTERACTIVE STICKERS IN VIEWER
// =============================================

function ViewerSticker({ sticker, userId, group, votedPoll, setVotedPoll, questionAnswer, setQuestionAnswer, onSendAnswer }: {
  sticker: StorySticker;
  userId: string;
  group: StoryGroup;
  votedPoll: Record<string, string>;
  setVotedPoll: (v: Record<string, string>) => void;
  questionAnswer: string;
  setQuestionAnswer: (v: string) => void;
  onSendAnswer: (ans: string) => void;
}) {
  const [localVotes, setLocalVotes] = useState<Record<string, number>>(sticker.votes || {});
  const [countdownSec, setCountdownSec] = useState(0);

  useEffect(() => {
    if (sticker.type !== "countdown" || !sticker.endsAt) return;
    const tick = () => {
      const diff = Math.max(0, new Date(sticker.endsAt!).getTime() - Date.now());
      setCountdownSec(Math.floor(diff / 1000));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [sticker.endsAt]);

  const style: React.CSSProperties = { position: "absolute", left: `${sticker.x}%`, top: `${sticker.y}%`, transform: "translate(-50%, -50%)", zIndex: 15, maxWidth: 200, pointerEvents: "auto" };

  if (sticker.type === "emoji") return <div style={{ ...style, fontSize: 40, pointerEvents: "none" }}>{sticker.emoji}</div>;

  if (sticker.type === "poll") {
    const voted = votedPoll[sticker.id];
    const total = Object.values(localVotes).reduce((a, b) => a + b, 0);
    return (
      <div style={style} className="bg-white/90 dark:bg-black/70 rounded-2xl p-3 shadow-lg backdrop-blur-sm">
        <p className="text-sm font-bold text-black dark:text-white text-center mb-2">{sticker.question}</p>
        {(sticker.options || []).map((opt, i) => {
          const votes = localVotes[opt] || 0;
          const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
          return (
            <button key={i} disabled={!!voted} onClick={() => {
              if (voted) return;
              const next = { ...localVotes, [opt]: (localVotes[opt] || 0) + 1 };
              setLocalVotes(next);
              setVotedPoll({ ...votedPoll, [sticker.id]: opt });
            }} className={`w-full rounded-xl px-3 py-1.5 mb-1 text-sm font-semibold text-left transition-all relative overflow-hidden ${voted === opt ? "bg-primary text-primary-foreground" : "bg-black/10 dark:bg-white/10 text-black dark:text-white"}`}>
              {voted && <div className="absolute left-0 top-0 bottom-0 bg-primary/20 transition-all" style={{ width: `${pct}%` }} />}
              <span className="relative z-10 flex justify-between"><span>{opt}</span>{voted && <span>{pct}%</span>}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (sticker.type === "question") {
    const isOwn = group.user_id === userId;
    if (isOwn) return (
      <div style={style} className="bg-gradient-to-br from-violet-500 to-pink-500 rounded-2xl p-3 shadow-lg">
        <p className="text-xs font-bold text-white text-center">{sticker.prompt}</p>
        <p className="text-[10px] text-white/70 text-center mt-1">Waiting for answers</p>
      </div>
    );
    return (
      <div style={style} className="bg-gradient-to-br from-violet-500 to-pink-500 rounded-2xl p-3 shadow-lg">
        <p className="text-xs font-bold text-white text-center mb-2">{sticker.prompt}</p>
        <input value={questionAnswer} onChange={e => setQuestionAnswer(e.target.value)}
          placeholder="Type your answer..." onKeyDown={e => { if (e.key === "Enter" && questionAnswer.trim()) { onSendAnswer(questionAnswer.trim()); setQuestionAnswer(""); } }}
          className="w-full bg-white/20 text-white placeholder:text-white/50 text-xs rounded-lg px-2 py-1 outline-none border border-white/30" />
      </div>
    );
  }

  if (sticker.type === "countdown") {
    const h = Math.floor(countdownSec / 3600);
    const m = Math.floor((countdownSec % 3600) / 60);
    const s = countdownSec % 60;
    return (
      <div style={style} className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-3 shadow-lg text-center">
        <p className="text-xs font-bold text-white mb-1">{sticker.event}</p>
        <p className="text-xl font-black font-mono text-white">{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</p>
      </div>
    );
  }

  if (sticker.type === "link") return (
    <a href={sticker.url} target="_blank" rel="noopener noreferrer" style={style}
      className="flex items-center gap-2 bg-white/90 dark:bg-black/70 rounded-full px-3 py-1.5 shadow-lg">
      <Link className="h-3.5 w-3.5 text-blue-500 shrink-0" />
      <span className="text-xs font-semibold text-black dark:text-white truncate">{sticker.label || sticker.url}</span>
    </a>
  );

  return null;
}
