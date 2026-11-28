// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from "react";
import { Heart, MessageCircle, Bookmark, Share2, Music, Check, VolumeX, Volume2, MoreHorizontal, Flag, Play, Pause, RefreshCw, Plus, User, X, BookmarkCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  type EtokVideo,
  checkIsLiked, setLikeAsync, recordVideoViewAsync,
  checkIsFollowing, toggleFollowAsync,
  formatCount, markNotInterested, isVideoSaved, setVideoSaved,
} from "@/lib/etokService";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { EtokComments } from "./EtokComments";
import { EtokShareSheet } from "./EtokShareSheet";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { reportContentAsync, REPORT_REASONS } from "@/lib/etokPrivacyService";
import { createPortal } from "react-dom";
import { createVideoTapHandler } from "@/lib/etokPlayback";

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
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const saveLock = useRef(false);
  const saveGeneration = useRef(0);
  const [showReport, setShowReport] = useState(false);
  const [reportPending, setReportPending] = useState(false);
  const readSaved = useCallback(() => {
    const generation = ++saveGeneration.current;
    if (currentUserId) void isVideoSaved(currentUserId, video.id).then(value => {
      if (generation === saveGeneration.current) setSaved(value);
    }).catch(() => {});
  }, [currentUserId, video.id]);
  useEffect(() => { setSaved(false); readSaved(); return () => { saveGeneration.current += 1; }; }, [readSaved]);
  const handleSave = async () => {
    if (!currentUserId || saveLock.current) return;
    saveLock.current = true; setSavePending(true);
    const generation = ++saveGeneration.current;
    const next = !saved;
    try {
      await setVideoSaved(currentUserId, video.id, next);
      if (generation === saveGeneration.current) setSaved(next);
    } catch { toast.error("Could not save video. Please retry."); }
    finally { saveLock.current = false; if (generation === saveGeneration.current) setSavePending(false); }
  };
  const submitReport = async (reason: string) => {
    if (reportPending || !currentUserId) return;
    setReportPending(true);
    try { await reportContentAsync(currentUserId, "video", video.id, reason); setShowReport(false); setShowMore(false); toast.success("Report submitted"); }
    catch { toast.error("Could not submit report. Please retry."); }
    finally { setReportPending(false); }
  };

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
  const tapPositionRef = useRef({ x: 0, y: 0 });
  const unmutedTapRef = useRef(false);
  const heartTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pauseIconTimerRef = useRef<ReturnType<typeof setTimeout>>();


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

  const toggleSound = () => {
    const el = videoRef.current;
    if (el) {
      el.muted = !muted;
      if (muted && isActive) { setPaused(false); void el.play().catch(() => {}); }
    }
    onMuteToggle();
  };
  const tapActionsRef = useRef({ single: () => {}, double: () => {} });
  tapActionsRef.current = {
    single: () => {
      const el = videoRef.current;
      if (unmutedTapRef.current) { unmutedTapRef.current = false; return; }
      if (muted) { toggleSound(); return; }
      if (el) {
        if (el.paused) { el.play().catch(() => {}); setPaused(false); }
        else { el.pause(); setPaused(true); }
        clearTimeout(pauseIconTimerRef.current);
        setShowPauseIcon(true);
        pauseIconTimerRef.current = setTimeout(() => setShowPauseIcon(false), 800);
      }
    },
    double: () => {
      unmutedTapRef.current = false;
      setHeartPos(tapPositionRef.current);
      if (!liked) void applyLike(true);
      setShowHeart(true);
      clearTimeout(heartTimerRef.current);
      heartTimerRef.current = setTimeout(() => setShowHeart(false), 900);
    },
  };
  const tapHandlerRef = useRef<ReturnType<typeof createVideoTapHandler>>();
  if (!tapHandlerRef.current) tapHandlerRef.current = createVideoTapHandler(
    () => tapActionsRef.current.single(), () => tapActionsRef.current.double(),
  );
  useEffect(() => {
    if (!isActive) { tapHandlerRef.current?.cancel(); unmutedTapRef.current = false; }
    return () => { tapHandlerRef.current?.cancel(); unmutedTapRef.current = false; clearTimeout(pauseIconTimerRef.current); clearTimeout(heartTimerRef.current); };
  }, [isActive, video.id, currentUserId]);
  const handleTap = (e: React.MouseEvent) => {
    if (!isActive) return;
    // Unmute synchronously within the user's gesture for mobile autoplay policies.
    if (muted) { unmutedTapRef.current = true; toggleSound(); }
    const rect = e.currentTarget.getBoundingClientRect();
    tapPositionRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    tapHandlerRef.current?.tap();
  };

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
        ? <span key={i} className="font-semibold text-primary">{part}</span>
        : <span key={i}>{part}</span>
    );
  };

  return (
    <article className="etok-video-card relative h-full w-full snap-start overflow-hidden rounded-lg border border-primary/15 bg-surface-lowest select-none" onClick={handleTap} aria-label="Video">
      {video.videoUrl && !videoError ? (
        <video ref={videoRef} src={video.videoUrl} className="absolute inset-0 h-full w-full object-contain" loop playsInline muted={muted} preload="metadata"
          onTimeUpdate={handleTimeUpdate} onCanPlay={handleCanPlay} onError={handleError} onWaiting={() => setVideoLoading(true)} onPlaying={() => setVideoLoading(false)} />
      ) : <div className="absolute inset-0 bg-surface-lowest" />}
      <div className="etok-video-shade pointer-events-none absolute inset-0" />
      {videoLoading && !videoError && video.videoUrl && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><RefreshCw className="h-7 w-7 animate-spin text-primary" /></div>}
      {videoError && <div className="absolute inset-0 flex items-center justify-center"><Button variant="outline" onClick={handleRetry}><RefreshCw />Retry video</Button></div>}

      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 p-3" onClick={e => e.stopPropagation()}>
        <Button variant="ghost" aria-label="View creator profile" title="View creator profile" onClick={() => navigate(`/etok/profile/${video.authorId}`)} className="h-11 min-w-0 flex-1 justify-start gap-2 px-0 text-media-foreground hover:bg-transparent">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/50 bg-surface-high">
            {author?.avatar ? <img src={author.avatar} alt="" className="h-full w-full object-cover" /> : <User className="!h-5 !w-5 text-primary" />}
          </span>
          <span className="min-w-0 text-left">
            <span className="block truncate text-sm font-semibold">{author?.displayName || "Hidden profile"}</span>
            <span className="block truncate text-[10px] font-normal text-media-foreground/70">{author?.username ? `@${author.username} · ` : ""}{video.createdAt && !Number.isNaN(Date.parse(video.createdAt)) ? formatDistanceToNowStrict(new Date(video.createdAt), { addSuffix: true }) : ""}</span>
          </span>
        </Button>
        {video.authorId !== currentUserId && <Button variant={following ? "ghost" : "default"} size="icon" aria-label={following ? "Unfollow creator" : "Follow creator"} title={following ? "Unfollow creator" : "Follow creator"} disabled={followPending} onClick={handleFollow} className={cn("shrink-0 rounded-full", following && "text-primary bg-media-scrim/60")}>
          {following ? <Check /> : <Plus />}
        </Button>}
        <Button variant="ghost" size="icon" aria-label="Video options" title="Video options" onClick={() => setShowMore(true)} className="shrink-0 text-media-foreground"><MoreHorizontal /></Button>
      </div>

      <div className="absolute left-3 top-[68px] z-10 flex items-center gap-2" onClick={e => e.stopPropagation()}>
        <Button variant="ghost" size="icon" aria-label={muted ? "Unmute video" : "Mute video"} title={muted ? "Unmute video" : "Mute video"}
          className="rounded-full bg-media-scrim/70 text-media-foreground hover:bg-media-scrim/90" onClick={() => { tapHandlerRef.current?.cancel(); toggleSound(); }}>
          {muted ? <VolumeX /> : <Volume2 />}
        </Button>
        {muted && isActive && video.videoUrl && !videoError && <Button variant="ghost" className="rounded-full bg-media-scrim/70 px-3 text-xs text-media-foreground hover:bg-media-scrim/90" onClick={() => { tapHandlerRef.current?.cancel(); toggleSound(); }}>Tap to unmute</Button>}
      </div>

      <AnimatePresence>
        {showPauseIcon && <motion.div initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.7 }} className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-media-scrim/60 p-5">{paused ? <Play className="h-9 w-9 fill-media-foreground text-media-foreground" /> : <Pause className="h-9 w-9 text-media-foreground" />}</div>
        </motion.div>}
        {showHeart && <motion.div initial={{ scale: 0, opacity: 1 }} animate={{ scale: [0, 1.3, 1], opacity: [1, 1, 0] }} transition={{ duration: 0.8 }} className="pointer-events-none absolute z-20" style={{ left: heartPos.x - 40, top: heartPos.y - 40 }}>
          <Heart className="h-20 w-20 fill-cosmic-magenta text-cosmic-magenta" />
        </motion.div>}
      </AnimatePresence>

      <div className="etok-action-rail absolute bottom-4 right-2 z-10 flex flex-col items-center gap-2" onClick={e => e.stopPropagation()}>
        <ActionBtn icon={<Heart className={cn("!h-6 !w-6", liked ? "fill-cosmic-magenta text-cosmic-magenta" : "text-media-foreground")} />} label={formatCount(likeCount)} name={liked ? "Unlike video" : "Like video"} disabled={likePending} onClick={handleLike} />
        <ActionBtn icon={<MessageCircle className="!h-6 !w-6" />} label={formatCount(commentCount)} name="Comments" onClick={() => setShowComments(true)} />
        <ActionBtn icon={<Share2 className="!h-6 !w-6" />} label={formatCount(video.shares)} name="Share video" onClick={() => setShowShare(true)} />
        <ActionBtn icon={saved ? <BookmarkCheck className="!h-6 !w-6 text-tertiary" /> : <Bookmark className="!h-6 !w-6" />} label={saved ? "Saved" : "Save"} name={saved ? "Unsave video" : "Save video"} disabled={savePending} onClick={() => void handleSave()} />
      </div>
      <div className="etok-caption absolute bottom-4 left-3 right-20 z-10 text-media-foreground" onClick={e => e.stopPropagation()}>
        {video.isSponsored && <span className="mb-2 inline-block text-[10px] text-tertiary">Sponsored</span>}
        <Button variant="ghost" aria-label="Expand video description" aria-expanded={descExpanded} onClick={() => setDescExpanded(!descExpanded)} className="h-auto min-h-0 w-full whitespace-normal justify-start p-0 text-left text-media-foreground hover:bg-transparent">
          <span className={cn("block max-h-28 overflow-y-auto break-words text-sm leading-relaxed", !descExpanded && "line-clamp-2")}>{renderHashtagDescription()}</span>
        </Button>
        {video.hashtags.length > 0 && <p className="mt-1 truncate text-xs text-primary">{video.hashtags.map(tag => tag.startsWith("#") ? tag : `#${tag}`).join(" ")}</p>}
        <div className="mt-2 flex min-w-0 items-center gap-2 text-[11px] text-media-foreground/80"><Music className="h-3.5 w-3.5 shrink-0 text-tertiary" /><span className="truncate">{soundName}</span></div>
      </div>
      {video.videoUrl && !videoError && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-media-foreground/20"><div className="h-full bg-primary" style={{ width: `${progress * 100}%` }} /></div>}

      {showMore && createPortal(<div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={e => e.stopPropagation()}>
        <div className="absolute inset-0 bg-background/70" onClick={() => { setShowMore(false); setShowReport(false); }} />
        <section role="dialog" aria-modal="true" aria-label={showReport ? "Report video" : "Video options"} className="relative w-full max-w-3xl rounded-t-lg border-t border-primary/20 bg-card p-4 safe-bottom">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">{showReport ? "Report video" : "Video options"}</h2><Button variant="ghost" size="icon" aria-label="Close video options" onClick={() => { setShowMore(false); setShowReport(false); }}><X /></Button></div>
          {showReport ? <div className="max-h-[55dvh] overflow-y-auto">{REPORT_REASONS.map(reason => <Button key={reason} variant="ghost" className="w-full justify-start whitespace-normal text-left" disabled={reportPending} onClick={() => void submitReport(reason)}>{reason}</Button>)}</div> : <>
            <Button variant="ghost" className="w-full justify-start" onClick={() => { markNotInterested(video.id); setShowMore(false); }}><Flag />Not interested</Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => setShowReport(true)}><Flag />Report video</Button>
          </>}
        </section>
      </div>, document.body)}
      <AnimatePresence>{showComments && <EtokComments video={video} currentUserId={currentUserId} onClose={() => setShowComments(false)} onCommentAdded={() => setCommentCount(c => c + 1)} onCommentDeleted={() => setCommentCount(c => Math.max(0, c - 1))} />}</AnimatePresence>
      <AnimatePresence>{showShare && <EtokShareSheet video={video} currentUserId={currentUserId} onClose={() => { setShowShare(false); readSaved(); }} />}</AnimatePresence>
    </article>
  );
}

function ActionBtn({ icon, label, name, disabled, onClick }: { icon: React.ReactNode; label: string; name: string; disabled?: boolean; onClick: (e: React.MouseEvent) => void }) {
  return <Button variant="ghost" aria-label={name} title={name} disabled={disabled} onClick={onClick} className="h-[58px] w-14 flex-col gap-1 rounded-lg bg-media-scrim/55 p-1 text-media-foreground hover:bg-media-scrim/80 hover:text-media-foreground">
    {icon}<span className="text-[10px] font-semibold">{label}</span>
  </Button>;
}
