import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, X, Radio, Users, Send, Crown, Gift, Swords, Bell, BellOff, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchActiveLives, fetchLiveById, joinLiveAsync, leaveLiveAsync, addLiveCommentAsync,
  fetchLiveComments, sendLiveGiftAsync, startLiveAsync, endLiveAsync, LIVE_GIFTS,
  CATEGORIES, fetchScheduledLives, toggleReminderAsync, getCoinsBalanceAsync,
  subscribeLiveComments, subscribeStreamUpdates,
  type EtokLiveStream, type LiveComment, type ScheduledLive,
} from "@/lib/etokLiveService";
import { formatCount, fetchEtokProfile, type EtokUser } from "@/lib/etokService";
import { EtokBottomNav } from "@/components/etok/EtokBottomNav";
import { useEtokLiveBroadcast } from "@/hooks/useEtokLiveBroadcast";


const EtokLive = () => {
  const navigate = useNavigate();
  const { streamId } = useParams<{ streamId: string }>();
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";
  const [currentUser, setCurrentUser] = useState<EtokUser | null>(null);
  const [hostProfiles, setHostProfiles] = useState<Record<string, EtokUser>>({});

  const [activeLives, setActiveLives] = useState<EtokLiveStream[]>([]);
  const [scheduledLives, setScheduledLives] = useState<ScheduledLive[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [currentStream, setCurrentStream] = useState<EtokLiveStream | undefined>(undefined);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [showGifts, setShowGifts] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [liveTitle, setLiveTitle] = useState("");
  const [liveCategory, setLiveCategory] = useState("Music");
  const [isHosting, setIsHosting] = useState(false);
  const [myStream, setMyStream] = useState<EtokLiveStream | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [giftAnim, setGiftAnim] = useState<{ emoji: string; name: string; color: string } | null>(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Fetch current user profile
  useEffect(() => {
    if (currentUserId) {
      fetchEtokProfile(currentUserId).then(p => setCurrentUser(p));
    }
  }, [currentUserId]);

  // Fetch host profiles for active and scheduled lives
  useEffect(() => {
    const hostIds = new Set([
      ...activeLives.map(l => l.hostId),
      ...scheduledLives.map(l => l.hostId),
      ...(currentStream ? [currentStream.hostId] : []),
    ]);
    hostIds.forEach(id => {
      if (!hostProfiles[id]) {
        fetchEtokProfile(id).then(p => {
          if (p) setHostProfiles(prev => ({ ...prev, [id]: p }));
        });
      }
    });
  }, [activeLives, scheduledLives, currentStream]);

  // Initial load of lives & coins
  useEffect(() => {
    fetchActiveLives().then(setActiveLives);
    fetchScheduledLives(currentUserId).then(setScheduledLives);
    if (currentUserId) getCoinsBalanceAsync(currentUserId).then(setCoinBalance);
  }, [currentUserId]);

  // Load specific stream when navigated
  useEffect(() => {
    if (!streamId || !currentUserId) return;
    fetchLiveById(streamId).then(async (stream) => {
      if (!stream) return;
      setCurrentStream(stream);
      await joinLiveAsync(streamId, currentUserId);
      const c = await fetchLiveComments(streamId);
      setComments(c);
    });
    return () => {
      if (streamId && currentUserId) leaveLiveAsync(streamId, currentUserId);
    };
  }, [streamId, currentUserId]);

  // Realtime: subscribe to new comments + stream updates
  useEffect(() => {
    if (!currentStream) return;
    const unsubComments = subscribeLiveComments(currentStream.id, (c) => {
      setComments(prev => [...prev, c].slice(-100));
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    const unsubStream = subscribeStreamUpdates(currentStream.id, (s) => {
      setCurrentStream(s);
    });
    return () => { unsubComments(); unsubStream(); };
  }, [currentStream?.id]);

  useEffect(() => {
    if (!currentStream) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(currentStream.startedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [currentStream]);

  const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handleSendComment = async () => {
    if (!commentText.trim() || !currentStream) return;
    const txt = commentText;
    setCommentText("");
    await addLiveCommentAsync(currentStream.id, currentUserId, txt);
  };

  const handleSendGift = async (giftId: string) => {
    if (!currentStream) return;
    const success = await sendLiveGiftAsync(currentStream.id, giftId, currentUserId, currentStream.hostId);
    if (success) {
      const gift = LIVE_GIFTS.find(g => g.id === giftId);
      if (gift) { setGiftAnim({ emoji: gift.emoji, name: gift.name, color: gift.animationColor }); setTimeout(() => setGiftAnim(null), 2000); }
      const bal = await getCoinsBalanceAsync(currentUserId);
      setCoinBalance(bal);
    } else toast.error("Not enough coins! Buy more coins.");
  };

  const handleStartLive = async () => {
    if (!liveTitle.trim()) { toast.error("Add a title first"); return; }
    const stream = await startLiveAsync(currentUserId, liveTitle, liveCategory);
    if (!stream) { toast.error("Failed to start live"); return; }
    setMyStream(stream);
    setCurrentStream(stream);
    setIsHosting(true);
    setShowStartDialog(false);
    toast.success("You're LIVE! 🔴");
  };

  const filteredLives = selectedCategory === "All" ? activeLives : activeLives.filter(l => l.category === selectedCategory);

  /* ─── WATCHING A LIVE STREAM ─── */
  const isHostOfCurrent = !!currentStream && (currentStream.hostId === currentUserId || isHosting);
  const { videoRef, error: broadcastError, isConnected: broadcastConnected } = useEtokLiveBroadcast({
    streamId: currentStream?.id,
    userId: currentUserId,
    isHost: isHostOfCurrent,
    hostId: currentStream?.hostId,
  });

  if (currentStream) {
    const host = hostProfiles[currentStream.hostId];
    const isHost = isHostOfCurrent;

    return (
      <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 100 }}>
        {/* Live video stream */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isHost}
          className="absolute inset-0 w-full h-full object-cover bg-black"
        />
        {/* Fallback gradient + emoji while connecting */}
        {!broadcastConnected && (
          <div className={cn("absolute inset-0 bg-gradient-to-b flex items-center justify-center", currentStream.thumbnailColor)}>
            <motion.span animate={{ scale: [1, 1.05, 1], opacity: [0.4, 0.6, 0.4] }} transition={{ repeat: Infinity, duration: 3 }} className="text-[140px]">
              {currentStream.thumbnailEmoji}
            </motion.span>
            <div className="absolute bottom-1/3 text-white/80 text-sm font-semibold">
              {broadcastError ? `⚠️ ${broadcastError}` : isHost ? "Starting camera..." : "Connecting to host..."}
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

        {/* Gift animation */}
        <AnimatePresence>
          {giftAnim && (
            <motion.div
              initial={{ y: 80, opacity: 0, scale: 0.5 }}
              animate={{ y: -40, opacity: 1, scale: 1.3 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute bottom-40 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-1"
            >
              <span className="text-7xl drop-shadow-2xl">{giftAnim.emoji}</span>
              <span className="text-white font-bold text-lg drop-shadow" style={{ color: giftAnim.color }}>{giftAnim.name}!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-12 pb-3">
          <button onClick={() => { if (currentUserId) leaveLiveAsync(currentStream.id, currentUserId); navigate("/etok/live"); }}>
            <ArrowLeft className="h-6 w-6 text-white drop-shadow" />
          </button>
          <div className="flex items-center gap-2">
            {/* Host info */}
            <div className="flex items-center gap-2 bg-black/40 rounded-full pl-1 pr-3 py-1">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-base">{host?.avatar ?? "👤"}</div>
              <span className="text-white text-[13px] font-semibold">{host?.username}</span>
              {!isHost && (
                <button className="ml-1 bg-[#ff0050] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">Follow</button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 bg-black/40 rounded-full px-3 py-1.5">
            <Users className="h-3.5 w-3.5 text-white" />
            <span className="text-white text-[12px] font-semibold">{formatCount(currentStream.viewerCount)}</span>
          </div>
        </div>

        {/* LIVE badge + timer */}
        <div className="absolute top-14 left-4 z-10 flex items-center gap-2">
          <div className="flex items-center gap-1 bg-red-600 rounded px-2 py-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-white text-[11px] font-bold">LIVE</span>
          </div>
          <span className="text-white/70 text-[11px] bg-black/40 rounded px-2 py-0.5">{formatElapsed(elapsed)}</span>
          <div className="bg-black/40 rounded px-2 py-0.5 flex items-center gap-1">
            <Crown className="h-3 w-3 text-yellow-400" />
            <span className="text-white text-[11px]">{formatCount(currentStream.giftTotal)} gifts</span>
          </div>
        </div>

        {/* PK Battle (coming soon) */}

        {/* Scrolling comments */}
        <div className="absolute bottom-28 left-3 right-20 z-10 overflow-hidden" style={{ maxHeight: "45vh" }}>
          <div className="flex flex-col gap-1.5">
            {comments.slice(-12).map(c => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn("flex items-start gap-2 max-w-full", c.isGift ? "bg-[#ff0050]/20 rounded-xl px-2 py-1" : "")}
              >
                <span className="text-lg leading-none flex-shrink-0">{c.authorAvatar}</span>
                <span className="text-white/80 text-[12px] font-semibold flex-shrink-0">{c.authorName}</span>
                <span className="text-white text-[12px] break-words leading-relaxed">
                  {c.isGift ? `${c.giftEmoji} ${c.text}` : c.text}
                </span>
              </motion.div>
            ))}
            <div ref={commentsEndRef} />
          </div>
        </div>

        {/* Right action column */}
        <div className="absolute right-3 bottom-32 z-10 flex flex-col gap-5 items-center">
          {isHost ? (
            <>
              <button onClick={async () => { if (myStream) { await endLiveAsync(myStream.id); } setIsHosting(false); setCurrentStream(undefined); setMyStream(null); navigate("/etok/live"); }} className="flex flex-col items-center gap-1">
                <div className="w-11 h-11 rounded-full bg-red-600 flex items-center justify-center"><X className="h-5 w-5 text-white" /></div>
                <span className="text-white text-[10px]">End</span>
              </button>
              <button
                onClick={() => toast.info("Multi-guest LIVE is coming soon")}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-11 h-11 rounded-full bg-black/50 border border-white/20 flex items-center justify-center"><Users className="h-5 w-5 text-white" /></div>
                <span className="text-white text-[10px]">Guests</span>
              </button>
              <button
                onClick={() => toast.info("PK Battle is coming soon")}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-11 h-11 rounded-full bg-black/50 border border-white/20 flex items-center justify-center"><Swords className="h-5 w-5 text-white" /></div>
                <span className="text-white text-[10px]">Battle</span>
              </button>
            </>
          ) : (
            <button onClick={() => setShowGifts(!showGifts)} className="flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-full bg-black/50 border border-white/20 flex items-center justify-center">
                <Gift className="h-5 w-5 text-white" />
              </div>
              <span className="text-white text-[10px]">Gift</span>
            </button>
          )}
        </div>

        {/* Gift drawer */}
        <AnimatePresence>
          {showGifts && (
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="absolute bottom-16 left-0 right-0 z-20 bg-[#111]/95 rounded-t-2xl"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-1.5">
                  <Crown className="h-4 w-4 text-yellow-400" />
                  <span className="text-white font-bold text-[15px]">{coinBalance} Coins</span>
                </div>
                <button onClick={() => toast.info("Coin recharge is coming soon")} className="text-[#ff0050] text-[13px] font-semibold">+ Recharge</button>
                <button onClick={() => setShowGifts(false)}><X className="h-5 w-5 text-white/50" /></button>
              </div>
              <div className="grid grid-cols-4 gap-0 pb-8">
                {LIVE_GIFTS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => handleSendGift(g.id)}
                    className={cn("flex flex-col items-center py-4 gap-1.5 active:bg-white/5 transition-colors", coinBalance < g.coins ? "opacity-40" : "")}
                  >
                    <span className="text-4xl">{g.emoji}</span>
                    <span className="text-white text-[11px] font-semibold">{g.name}</span>
                    <div className="flex items-center gap-0.5">
                      <Crown className="h-2.5 w-2.5 text-yellow-400" />
                      <span className="text-yellow-400 text-[11px] font-bold">{g.coins}</span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Comment input */}
        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-3 px-3 py-3 bg-gradient-to-t from-black via-black/70 to-transparent pb-5">
          <div className="flex-1 bg-white/15 rounded-full px-4 py-2.5 flex items-center gap-2">
            <input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendComment()}
              placeholder="Say something..."
              className="flex-1 bg-transparent text-white text-[14px] outline-none placeholder:text-white/40"
            />
          </div>
          <button onClick={handleSendComment} disabled={!commentText.trim()} className="w-9 h-9 flex items-center justify-center">
            <Send className={cn("h-5 w-5", commentText.trim() ? "text-[#ff0050]" : "text-white/30")} />
          </button>
        </div>
      </div>
    );
  }

  /* ─── BROWSE LIVES PAGE ─── */
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 bg-black z-20 flex items-center justify-between px-4 pt-12 pb-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-white" /></button>
        <h1 className="font-bold text-[17px]">LIVE</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/etok/search")}><Search className="h-5 w-5 text-white/70" /></button>
          <button
            onClick={() => setShowStartDialog(true)}
            className="flex items-center gap-1.5 bg-[#ff0050] px-3 py-1.5 rounded-full"
            data-testid="button-go-live"
          >
            <Radio className="h-3.5 w-3.5 text-white" />
            <span className="text-white text-[13px] font-bold">Go LIVE</span>
          </button>
        </div>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
        {["All", ...CATEGORIES.slice(0, 9)].map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn("flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-semibold transition-colors", selectedCategory === cat ? "bg-white text-black" : "bg-white/10 text-white/70")}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="pb-24 px-3">
        {/* Live grid */}
        <p className="text-white font-bold text-[15px] mb-3">🔴 Live Now</p>
        {filteredLives.length === 0 ? (
          <div className="text-center py-12 text-white/40">No live streams in this category</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mb-6">
            {filteredLives.map(live => {
              const host = hostProfiles[live.hostId];
              return (
                <button
                  key={live.id}
                  onClick={() => navigate(`/etok/live/${live.id}`)}
                  className={cn("rounded-xl overflow-hidden bg-gradient-to-b relative", live.thumbnailColor)}
                  style={{ aspectRatio: "4/5" }}
                  data-testid={`card-live-${live.id}`}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.span animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 3 }} className="text-6xl opacity-60">
                      {live.thumbnailEmoji}
                    </motion.span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                  {/* LIVE badge */}
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-600/90 rounded px-1.5 py-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span className="text-white text-[10px] font-bold">LIVE</span>
                  </div>
                  {/* Viewer count */}
                  <div className="absolute top-2 right-2 bg-black/50 rounded px-1.5 py-0.5 text-white text-[10px] font-semibold">
                    👁 {formatCount(live.viewerCount)}
                  </div>
                  {/* Host info */}
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-sm">{host?.avatar}</div>
                      <span className="text-white text-[11px] font-semibold truncate">{host?.displayName}</span>
                    </div>
                    <p className="text-white/80 text-[10px] line-clamp-2">{live.title}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[9px] bg-white/15 text-white/80 px-1.5 py-0.5 rounded">{live.category}</span>
                      <span className="text-[9px] text-yellow-400">
                        <Crown className="h-2.5 w-2.5 inline" /> {formatCount(live.giftTotal)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Scheduled lives */}
        <p className="text-white font-bold text-[15px] mb-3">📅 Upcoming Lives</p>
        <div className="space-y-3">
          {scheduledLives.map(s => {
            const host = hostProfiles[s.hostId];
            const hasReminder = !!s.hasReminder;
            return (
              <div key={s.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center text-3xl flex-shrink-0">{s.thumbnailEmoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-[14px] truncate">{s.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-base">{host?.avatar}</span>
                    <span className="text-white/60 text-[12px]">{host?.displayName}</span>
                  </div>
                  <p className="text-white/40 text-[11px] mt-0.5">
                    {new Date(s.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <button
                  onClick={async () => { const set = await toggleReminderAsync(s.id, currentUserId); setScheduledLives(await fetchScheduledLives(currentUserId)); toast.success(set ? "Reminder set! 🔔" : "Reminder removed"); }}
                  className={cn("flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-semibold transition-colors", hasReminder ? "bg-[#ff0050] text-white" : "border border-white/20 text-white/70")}
                >
                  {hasReminder ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                  {hasReminder ? "Reminded" : "Remind"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Go Live dialog */}
      <AnimatePresence>
        {showStartDialog && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 z-50" onClick={() => setShowStartDialog(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 bg-[#111] rounded-t-2xl z-50 pb-10"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-5" />
              <div className="flex items-center justify-between px-4 mb-5">
                <button onClick={() => setShowStartDialog(false)} className="text-white/50 text-[15px]">Cancel</button>
                <h3 className="text-white font-bold text-[17px]">Go LIVE</h3>
                <div />
              </div>

              <div className="px-4 space-y-4">
                <input
                  value={liveTitle}
                  onChange={e => setLiveTitle(e.target.value)}
                  placeholder="Give your LIVE a title..."
                  className="w-full bg-white/10 rounded-xl px-4 py-3.5 text-white text-[15px] outline-none placeholder:text-white/30 border border-white/10"
                  data-testid="input-live-title"
                />
                <div>
                  <p className="text-white/50 text-[12px] uppercase tracking-wide mb-2">Category</p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.slice(0, 8).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setLiveCategory(cat)}
                        className={cn("px-3 py-1.5 rounded-full text-[13px] font-semibold border transition-colors", liveCategory === cat ? "bg-[#ff0050] border-[#ff0050] text-white" : "border-white/20 text-white/60")}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleStartLive}
                  className="w-full py-4 bg-[#ff0050] rounded-xl text-white font-bold text-[16px] flex items-center justify-center gap-2"
                  data-testid="button-start-live"
                >
                  <Radio className="h-5 w-5" />
                  Go LIVE Now
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <EtokBottomNav />
    </div>
  );
};

export default EtokLive;
