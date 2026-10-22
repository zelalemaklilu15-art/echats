// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from "react";
import { Heart, MessageCircle, Bookmark, Share2, Music, Check, VolumeX, Volume2, MoreHorizontal, Scissors, Copy, Flag, Play, Pause, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  type EtokVideo,
  checkIsLiked, setLikeAsync, recordVideoViewAsync,
  checkIsFollowing, toggleFollowAsync,
  formatCount, markNotInterested,
} from "@/lib/etokService";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { EtokComments } from "./EtokComments";
import { EtokShareSheet } from "./EtokShareSheet";

const BG_PATTERNS = [
  { gradient: "linear-gradient(135deg,#1a1a2e 0%,#16213e 40%,#0f3460 100%)", accent: "#e94560" },
  { gradient: "linear-gradient(135deg,#0d0d0d 0%,#1a0533 50%,#2d1b69 100%)", accent: "#7c3aed" },
  { gradient: "linear-gradient(135deg,#000000 0%,#1c0a00 50%,#2d1200 100%)", accent: "#f97316" },
  { gradient: "linear-gradient(135deg,#001a00 0%,#003300 50%,#004d00 100%)", accent: "#22c55e" },
  { gradient: "linear-gradient(135deg,#0a0a1a 0%,#001a3a 50%,#003366 100%)", accent: "#3b82f6" },
  { gradient: "linear-gradient(135deg,#1a0010 0%,#330022 50%,#660044 100%)", accent: "#ec4899" },
  { gradient: "linear-gradient(135deg,#0d1117 0%,#1a2332 50%,#274151 100%)", accent: "#06b6d4" },
  { gradient: "linear-gradient(135deg,#1a1500 0%,#332900 50%,#665200 100%)", accent: "#eab308" },
  { gradient: "linear-gradient(135deg,#0f0f0f 0%,#1a1a1a 50%,#2a2a2a 100%)", accent: "#ff0050" },
  { gradient: "linear-gradient(135deg,#002233 0%,#004466 50%,#006699 100%)", accent: "#20d5ec" },
  { gradient: "linear-gradient(135deg,#1a0000 0%,#330000 50%,#660000 100%)", accent: "#ef4444" },
  { gradient: "linear-gradient(135deg,#001a1a 0%,#003333 50%,#006666 100%)", accent: "#14b8a6" },
];

function PlusIcon(props: any) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>;
}

interface EtokVideoCardProps {
  video: EtokVideo;
  currentUserId: string;
  isActive: boolean;
  index: number;
  muted: boolean;
  onMuteToggle: () => void;
}

export function EtokVideoCard({ video, currentUserId, isActive, index, muted, onMuteToggle }: EtokVideoCardProps) {
  const author = video.author;

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [following, setFollowing] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [heartPos, setHeartPos] = useState({ x: 0, y: 0 });
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [commentCount, setCommentCount] = useState(video.comments);
  const [progress, setProgress] = useState(0);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);

  const likeBusy = useRef(false);
  const [likePending, setLikePending] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTapRef = useRef(0);
  const pauseIconTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pattern = BG_PATTERNS[index % BG_PATTERNS.length];

  useEffect(() => {
    let active = true;
    setLiked(false); setFollowing(video.authorId === currentUserId);
    checkIsLiked(currentUserId, video.id).then(value => { if (active) setLiked(value); }).catch(() => {});
    if (video.authorId !== currentUserId) checkIsFollowing(currentUserId, video.authorId).then(value => { if (active) setFollowing(value); }).catch(() => {});
    return () => { active = false; };
  }, [currentUserId, video.id, video.authorId]);
  useEffect(() => {
    if (!isActive || !currentUserId) return;
    const timer = setTimeout(() => { void recordVideoViewAsync(video.id).catch(() => {}); }, 2000);
    return () => clearTimeout(timer);
  }, [isActive, currentUserId, video.id]);
  const applyLike = async (target: boolean) => {
    if (likeBusy.current || !currentUserId) return;
    likeBusy.current = true; setLikePending(true);
    try { const result = await setLikeAsync(video.id, target); setLiked(result.liked); setLikeCount(result.likes); }
    catch { toast.error('Could not save like. Please retry.'); }
    finally { likeBusy.current = false; setLikePending(false); }
  };

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive && !paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isActive, paused]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = muted;
  }, [muted]);

  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    setProgress(el.currentTime / el.duration);
  };

  const handleCanPlay = () => { setVideoLoading(false); setVideoError(false); };
  const handleError = () => { setVideoLoading(false); setVideoError(true); };

  const handleTap = useCallback((e: React.MouseEvent) => {
    const now = Date.now();
    const el = videoRef.current;
    if (now - lastTapRef.current < 280) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setHeartPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      if (!liked) {
        void applyLike(true);
      }
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 900);
    } else {
      if (el) {
        if (el.paused) { el.play().catch(() => {}); setPaused(false); }
        else { el.pause(); setPaused(true); }
        clearTimeout(pauseIconTimerRef.current);
        setShowPauseIcon(true);
        pauseIconTimerRef.current = setTimeout(() => setShowPauseIcon(false), 800);
      }
    }
    lastTapRef.current = now;
  }, [liked, currentUserId, video.id]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await applyLike(!liked);
  };

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (video.authorId === currentUserId) return;
    if (followPending) return;
    setFollowPending(true);
    try { setFollowing(await toggleFollowAsync(currentUserId, video.authorId)); }
    catch { toast.error("Could not save follow. Please retry."); }
    finally { setFollowPending(false); }
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVideoError(false);
    setVideoLoading(true);
    videoRef.current?.load();
  };

  const soundName = video.soundName ?? "Original Sound";

  const renderHashtagDescription = () => {
    const parts = video.description.split(/(#\w+)/g);
    return parts.map((part, i) =>
      part.startsWith("#")
        ? <span key={i} className="font-semibold text-white">{part}</span>
        : <span key={i}>{part}</span>
    );
  };

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{ height: "100dvh", scrollSnapAlign: "start", scrollSnapStop: "always" }}
      onClick={handleTap}
    >
      {/* Video Background */}
      {video.videoUrl && !videoError ? (
        <>
          <video
            ref={videoRef}
            src={video.videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            loop playsInline muted={muted} preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onCanPlay={handleCanPlay}
            onError={handleError}
            onWaiting={() => setVideoLoading(true)}
            onPlaying={() => setVideoLoading(false)}
          />
          {videoLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="absolute inset-0" style={{ background: pattern.gradient }} />
              <div className="relative z-10"><div className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin" /></div>
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: pattern.gradient }}>
          {videoError && video.videoUrl && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <button onClick={handleRetry} className="flex flex-col items-center gap-2 bg-black/50 rounded-2xl p-5">
                <RefreshCw className="h-8 w-8 text-white" />
                <span className="text-white text-sm font-semibold">Tap to retry</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20" />

      {/* Play/Pause icon */}
      <AnimatePresence>
        {showPauseIcon && (
          <motion.div initial={{ scale: 0.5, opacity: 1 }} animate={{ scale: 1.2, opacity: 0 }} transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="bg-black/50 rounded-full p-5">
              {paused ? <Play className="h-12 w-12 text-white fill-white" /> : <Pause className="h-12 w-12 text-white fill-white" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Double-tap heart */}
      <AnimatePresence>
        {showHeart && (
          <motion.div initial={{ scale: 0, opacity: 1 }} animate={{ scale: [0, 1.8, 1.5], opacity: [1, 1, 0] }} transition={{ duration: 0.8, times: [0, 0.4, 1] }}
            className="absolute pointer-events-none z-20" style={{ left: heartPos.x - 48, top: heartPos.y - 48 }}>
            <Heart className="h-24 w-24 fill-white text-white drop-shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mute */}
      <button className="absolute top-16 right-3 z-10 p-2 rounded-full bg-black/30"
        onClick={e => { e.stopPropagation(); onMuteToggle(); }}>
        {muted ? <VolumeX className="h-4 w-4 text-white" /> : <Volume2 className="h-4 w-4 text-white" />}
      </button>

      {/* Right action column */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-10" onClick={e => e.stopPropagation()}>
        {/* Avatar + follow */}
        <div className="relative mb-1">
          <div className="w-[48px] h-[48px] rounded-full border-[2px] border-white overflow-hidden bg-white/10 flex items-center justify-center text-2xl">
            {author?.avatar ? <img src={author.avatar} alt="" className="w-full h-full object-cover" /> : "👤"}
          </div>
          {video.authorId !== currentUserId && (
            <Button variant="ghost" size="icon" aria-label={following ? "Unfollow creator" : "Follow creator"} disabled={followPending} onClick={handleFollow}
              className={cn("absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-colors",
                following ? "bg-white" : "bg-[#ff0050]")}>
              {following ? <Check className="h-3 w-3 text-[#ff0050]" strokeWidth={3} /> : <PlusIcon className="h-3 w-3 text-white" strokeWidth={3} />}
            </Button>
          )}
        </div>

        {/* Like */}
        <ActionBtn icon={<motion.div whileTap={{ scale: 1.4 }}><Heart className={cn("h-[34px] w-[34px] drop-shadow", liked ? "fill-[#ff0050] text-[#ff0050]" : "fill-white text-white")} /></motion.div>}
          label={formatCount(likeCount)} name={liked ? "Unlike video" : "Like video"} disabled={likePending} onClick={handleLike} />
        {/* Comment */}
        <ActionBtn icon={<MessageCircle className="h-[34px] w-[34px] fill-white text-white drop-shadow" />}
          label={formatCount(commentCount)} name="Comments" onClick={e => { e.stopPropagation(); setShowComments(true); }} />
        {/* Share */}
        <ActionBtn icon={<Share2 className="h-[30px] w-[30px] text-white drop-shadow" />}
          label={formatCount(video.shares)} name="Share video" onClick={e => { e.stopPropagation(); setShowShare(true); }} />
        {/* More */}
        <button onClick={e => { e.stopPropagation(); setShowMore(true); }} className="flex flex-col items-center">
          <MoreHorizontal className="h-7 w-7 text-white drop-shadow" />
        </button>
        {/* Spinning disc */}
        <motion.div animate={isActive && !paused ? { rotate: 360 } : {}} transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          className="w-[42px] h-[42px] rounded-full border-[5px] overflow-hidden flex items-center justify-center"
          style={{ borderColor: "#2a2a2a", background: "radial-gradient(circle at center, #333 30%, #111 100%)" }}>
          <div className="w-[16px] h-[16px] rounded-full" style={{ background: pattern.accent }} />
        </motion.div>
      </div>

      {/* Bottom text */}
      <div className="absolute bottom-16 left-0 right-16 px-3 pb-2 z-10" onClick={e => e.stopPropagation()}>
        <p className="text-white font-bold text-[15px] mb-1 drop-shadow">@{author?.username ?? "user"}</p>
        <button onClick={() => setDescExpanded(!descExpanded)} className="text-left w-full">
          <p className={cn("text-white text-[13px] leading-[18px] drop-shadow", !descExpanded && "line-clamp-2")}>{renderHashtagDescription()}</p>
          {!descExpanded && video.description.length > 80 && <span className="text-white/60 text-[13px]"> more</span>}
        </button>
        <div className="flex items-center gap-2 mt-2">
          <Music className="h-3 w-3 text-white flex-shrink-0" />
          <div className="overflow-hidden flex-1" style={{ maxWidth: 220 }}>
            <motion.p animate={isActive && !paused ? { x: ["0%", "-50%"] } : { x: "0%" }} transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
              className="text-white text-[12px] whitespace-nowrap drop-shadow">
              {soundName}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{soundName}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            </motion.p>
          </div>
        </div>
      </div>

      {/* Video progress */}
      {video.videoUrl && !videoError && (
        <div className="absolute bottom-14 left-0 right-0 h-[2px] bg-white/20 z-10">
          <div className="h-full bg-white transition-none" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {/* More options */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 z-30" onClick={() => setShowMore(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-[#1a1a1a] rounded-t-2xl z-40 pb-8">
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-4" />
              {[
                { icon: Flag, label: "Not Interested", action: () => { markNotInterested(video.id); setShowMore(false); } },
                { icon: Flag, label: "Report", action: () => setShowMore(false) },
              ].map(item => (
                <button key={item.label} onClick={item.action} className="flex items-center gap-4 w-full px-6 py-4 active:bg-white/5">
                  <item.icon className="h-5 w-5 text-white/60" />
                  <span className="text-white text-[15px]">{item.label}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Comments sheet */}
      <AnimatePresence>
        {showComments && (
          <EtokComments video={video} currentUserId={currentUserId} onClose={() => setShowComments(false)}
            onCommentAdded={() => setCommentCount(c => c + 1)} onCommentDeleted={() => setCommentCount(c => Math.max(0,c - 1))} />
        )}
      </AnimatePresence>

      {/* Share sheet */}
      <AnimatePresence>
        {showShare && <EtokShareSheet video={video} currentUserId={currentUserId} onClose={() => setShowShare(false)} />}
      </AnimatePresence>
    </div>
  );
}

function ActionBtn({ icon, label, name, disabled, onClick }: { icon: React.ReactNode; label: string; name: string; disabled?: boolean; onClick: (e: React.MouseEvent) => void }) {
  return <Button variant="ghost" aria-label={name} disabled={disabled} onClick={onClick} className="flex h-auto flex-col items-center gap-1 p-0 hover:bg-transparent">
    {icon}<span className="text-foreground text-[12px] font-semibold drop-shadow">{label}</span>
  </Button>;
}
