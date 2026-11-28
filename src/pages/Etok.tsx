// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Radio, RefreshCw, ArrowLeft, Flame, Users, TrendingUp, Bell, Film, MessageSquare, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { fetchFYPVideos, fetchFollowingVideos, fetchVideoById, subscribeToPublicEtokVideos, type EtokVideo } from "@/lib/etokService";
import { EtokVideoCard } from "@/components/etok/EtokVideoCard";
import { EtokBottomNav } from "@/components/etok/EtokBottomNav";
import { Button } from "@/components/ui/button";
import logoImage from "@/assets/echat-logo.png";
import { isEtokOnboardedAsync } from "./EtokOnboarding";

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
  const requestGeneration = useRef(0);
  const [loadError, setLoadError] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUserId) return;
    let active = true;
    isEtokOnboardedAsync(currentUserId).then((done) => {
      if (active && !done) navigate("/etok/onboarding", { replace: true });
    });
    return () => { active = false; };
  }, [currentUserId, navigate]);

  const loadVideos = useCallback(async (showLoading = true) => {
    const generation = ++requestGeneration.current;
    if (showLoading) { setLoading(true); setVideos([]); }
    setLoadError(false);
    try {
      let data = activeTab === "fyp"
        ? await fetchFYPVideos()
        : await fetchFollowingVideos(currentUserId);
      if (focusVideoId) {
        const focusedVideo = await fetchVideoById(focusVideoId);
        if (focusedVideo) data = [focusedVideo, ...data.filter(v => v.id !== focusedVideo.id)];
      }
      if (generation !== requestGeneration.current) return;
      setVideos(data);
    } catch (e) {
      if (generation === requestGeneration.current) setLoadError(true);
    } finally {
      if (generation === requestGeneration.current) { setLoading(false); setRefreshing(false); }
    }
  }, [activeTab, currentUserId, focusVideoId]);

  useEffect(() => {
    loadVideos(true);
    setActiveIndex(0);
    containerRef.current?.scrollTo({ top: 0 });
    return () => { requestGeneration.current += 1; };
  }, [loadVideos]);

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
    <div className="etok-shell fixed inset-0 z-40 flex flex-col bg-background text-foreground safe-x">
      <header className="etok-header shrink-0 border-b border-primary/10">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 pb-2 pt-3">
          <Button variant="ghost" size="icon" aria-label="Back to Echat" title="Back to Echat" onClick={() => navigate("/chats")} className="shrink-0 rounded-full border border-border/50"><ArrowLeft /></Button>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <img src={logoImage} alt="" className="h-9 w-9 rounded-full object-cover" />
            <h1 className="text-xl font-bold">Echat <span className="text-primary">eTok</span></h1>
          </div>
          <Button variant="ghost" size="icon" aria-label="Search eTok" title="Search eTok" onClick={() => navigate("/etok/search")}><Search /></Button>
          <Button variant="ghost" size="icon" aria-label="Notification settings" title="Notification settings" onClick={() => navigate("/notification-settings")}><Bell /></Button>
        </div>
        <nav aria-label="Video categories" className="scrollbar-hide mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-3">
          {[
            { id: "fyp", label: "For You", icon: Flame },
            { id: "following", label: "Following", icon: Users },
            { id: "trending", label: "Trending", icon: TrendingUp },
            { id: "live", label: "Live", icon: Radio },
          ].map(tab => (
            <Button key={tab.id} variant={activeTab === tab.id ? "default" : "ghost"}
              aria-pressed={activeTab === tab.id} className="shrink-0 rounded-full px-3 text-xs"
              onClick={() => tab.id === "live" ? navigate("/etok/live") : tab.id === "trending" ? navigate("/etok/search") : setActiveTab(tab.id as FeedTab)}>
              <tab.icon className={cn(tab.id === "live" && "text-cosmic-magenta")} />{tab.label}
            </Button>
          ))}
        </nav>
      </header>

      <div className="relative mx-auto w-full max-w-3xl min-h-0 flex-1 px-3 pt-3">
        <AnimatePresence>
          {(pullY > 0 || refreshing) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-x-0 top-2 z-30 flex justify-center pointer-events-none"
              style={{ transform: `translateY(${pullY}px)` }}>
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-card shadow-card">
                <RefreshCw className={cn("h-5 w-5 text-primary", refreshing && "animate-spin")} style={{ transform: refreshing ? undefined : `rotate(${progress * 360}deg)` }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={containerRef} data-testid="etok-feed" className="etok-feed scrollbar-hide h-full overflow-y-auto rounded-lg"
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 bg-card">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-primary" />
              <p className="text-sm text-muted-foreground">Loading videos...</p>
            </div>
          ) : loadError ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 bg-card"><p role="alert">Could not load videos.</p><Button onClick={() => void loadVideos()}>Retry</Button></div>
          ) : videos.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 bg-card px-8 text-center">
              <Film className="h-12 w-12 text-primary" />
              <p className="text-lg font-bold">{activeTab === "following" ? "Follow creators to see their videos" : "No videos yet"}</p>
              <Button onClick={() => activeTab === "following" ? setActiveTab("fyp") : navigate("/etok/camera")}>
                {activeTab === "following" ? "Browse For You" : "Create a video"}
              </Button>
            </div>
          ) : videos.map((video, idx) => (
            <EtokVideoCard key={video.id} video={video} currentUserId={currentUserId} isActive={idx === activeIndex} index={idx} muted={muted} onMuteToggle={() => setMuted(m => !m)} />
          ))}
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl shrink-0 items-center gap-3 px-4 py-2">
        <MessageSquare className="h-5 w-5 shrink-0 text-cosmic-cyan" />
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">Connect people. Share moments.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/chats")} className="gap-1 px-2 text-primary">Chat <ArrowUpRight /></Button>
      </div>
      <EtokBottomNav inFlow />
    </div>
  );
};

export default Etok;
