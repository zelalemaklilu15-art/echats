// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Camera, Radio, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { fetchFYPVideos, fetchFollowingVideos, fetchVideoById, subscribeToPublicEtokVideos, type EtokVideo } from "@/lib/etokService";
import { EtokVideoCard } from "@/components/etok/EtokVideoCard";
import { EtokBottomNav } from "@/components/etok/EtokBottomNav";
import { isEtokOnboarded } from "./EtokOnboarding";

type FeedTab = "fyp" | "following";

const PULL_THRESHOLD = 72;

const Etok = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";
  const focusVideoId = searchParams.get("video");

  const [activeTab, setActiveTab] = useState<FeedTab>("fyp");
  const [videos, setVideos] = useState<EtokVideo[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(true);

  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEtokOnboarded(currentUserId)) {
      navigate("/etok/onboarding", { replace: true });
    }
  }, [currentUserId, navigate]);

  const loadVideos = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      let data = activeTab === "fyp"
        ? await fetchFYPVideos()
        : await fetchFollowingVideos(currentUserId);
      if (focusVideoId) {
        const focusedVideo = await fetchVideoById(focusVideoId);
        if (focusedVideo) data = [focusedVideo, ...data.filter(v => v.id !== focusedVideo.id)];
      }
      setVideos(data);
    } catch (e) {
      console.error("[Etok] load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, currentUserId, focusVideoId]);

  useEffect(() => {
    loadVideos(true);
    setActiveIndex(0);
    containerRef.current?.scrollTo({ top: 0 });
  }, [loadVideos]);

  useEffect(() => {
    if (!focusVideoId) return;
    fetchVideoById(focusVideoId).then(video => {
      if (!video) return;
      setActiveTab("fyp");
      setVideos(prev => [video, ...prev.filter(v => v.id !== video.id)]);
      setActiveIndex(0);
      containerRef.current?.scrollTo({ top: 0 });
    });
  }, [focusVideoId]);

  useEffect(() => {
    if (activeTab !== "fyp") return;
    return subscribeToPublicEtokVideos(video => {
      setVideos(prev => [video, ...prev.filter(v => v.id !== video.id)].slice(0, 50));
    });
  }, [activeTab]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || videos.length === 0) return;
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const idx = Array.from(container.children).indexOf(entry.target as HTMLElement);
            if (idx >= 0) setActiveIndex(idx);
          }
        });
      },
      { threshold: 0.5 }
    );
    Array.from(container.children).forEach(child => observer.observe(child));
    return () => observer.disconnect();
  }, [videos]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    if (container.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) { isPulling.current = false; setPullY(0); return; }
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setPullY(Math.min(delta * 0.45, PULL_THRESHOLD));
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullY >= PULL_THRESHOLD) {
      setRefreshing(true);
      setPullY(0);
      setActiveIndex(0);
      containerRef.current?.scrollTo({ top: 0 });
      loadVideos(false);
    } else {
      setPullY(0);
    }
  }, [pullY, loadVideos]);

  const progress = Math.min(pullY / PULL_THRESHOLD, 1);

  return (
    <div className="fixed inset-0 bg-black" style={{ zIndex: 100 }}>
      {/* Pull-to-refresh */}
      <AnimatePresence>
        {(pullY > 0 || refreshing) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 z-30 flex items-end justify-center pb-2 pointer-events-none"
            style={{ height: refreshing ? 56 : pullY + 20 }}>
            <div className={cn("w-9 h-9 rounded-full bg-black/60 border border-white/20 flex items-center justify-center transition-all", refreshing ? "animate-spin" : "")}>
              <RefreshCw className="h-4 w-4 text-white" style={{ transform: refreshing ? undefined : `rotate(${progress * 360}deg)` }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-12 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/chats")} aria-label="Back to Echat"
            className="h-9 w-9 -ml-1 rounded-full flex items-center justify-center bg-black/35 backdrop-blur-sm">
            <ArrowLeft className="h-5 w-5 text-white drop-shadow" />
          </button>
          <button onClick={() => navigate("/etok/camera")}><Camera className="h-6 w-6 text-white drop-shadow" /></button>
        </div>
        <div className="flex items-center gap-1">
          {[
            { id: "following" as FeedTab, label: "Following" },
            { id: "fyp" as FeedTab, label: "For You" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="relative px-3 py-1">
              <span className={cn("text-[17px] font-bold drop-shadow transition-colors", activeTab === tab.id ? "text-white" : "text-white/50")}>{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div layoutId="feed-tab" className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2.5px] w-8 bg-white rounded-full" />
              )}
            </button>
          ))}
        </div>
        <button onClick={() => navigate("/etok/search")}><Search className="h-6 w-6 text-white drop-shadow" /></button>
      </div>

      {/* Live badge */}
      <button onClick={() => navigate("/etok/live")} className="absolute top-16 right-4 z-20 flex items-center gap-1 bg-red-600 rounded px-1.5 py-0.5">
        <Radio className="h-3 w-3 text-white" /><span className="text-white text-[10px] font-bold">LIVE</span>
      </button>

      {/* Video feed */}
      <div ref={containerRef} className="absolute inset-0 overflow-y-scroll"
        style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4" style={{ height: "100dvh" }}>
            <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
            <p className="text-white/50 text-sm">Loading videos...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white gap-4 px-8 text-center" style={{ height: "100dvh" }}>
            <span className="text-7xl">🎬</span>
            <p className="text-xl font-bold">
              {activeTab === "following" ? "Follow creators to see their videos" : "No videos yet"}
            </p>
            {activeTab !== "fyp" && (
              <button onClick={() => setActiveTab("fyp")} className="mt-2 px-8 py-3 bg-[#ff0050] rounded-full font-bold text-base">Browse For You</button>
            )}
          </div>
        ) : (
          videos.map((video, idx) => (
            <EtokVideoCard key={video.id} video={video} currentUserId={currentUserId} isActive={idx === activeIndex} index={idx} muted={muted} onMuteToggle={() => setMuted(m => !m)} />
          ))
        )}
      </div>

      <EtokBottomNav />
    </div>
  );
};

export default Etok;
