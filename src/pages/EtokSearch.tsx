import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, TrendingUp, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  searchVideosAsync, searchUsersAsync, searchSoundsAsync, searchHashtagsAsync,
  fetchTrendingHashtags, fetchAllSounds, checkIsFollowing, toggleFollowAsync,
  formatCount,
  type EtokVideo, type EtokUser, type EtokHashtag, type EtokSound,
} from "@/lib/etokService";
import { fetchActiveLives, type EtokLiveStream } from "@/lib/etokLiveService";
import { EtokBottomNav } from "@/components/etok/EtokBottomNav";

type ResultTab = "top" | "users" | "videos" | "sounds" | "live";

interface UserCardProps { user: EtokUser; currentUserId: string; onNavigate: (id: string) => void; }
function UserCard({ user, currentUserId, onNavigate }: UserCardProps) {
  const [following, setF] = useState(false);

  useEffect(() => {
    if (currentUserId && user.id) {
      checkIsFollowing(currentUserId, user.id).then(setF).catch(() => {});
    }
  }, [currentUserId, user.id]);

  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try { setF(await toggleFollowAsync(currentUserId, user.id)); } catch { toast.error("Could not save follow"); }
  };

  return (
    <div className="flex items-center gap-3 w-full px-4 py-2.5 active:bg-white/5 cursor-pointer" onClick={() => onNavigate(user.id)}>
      <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-2xl flex-shrink-0">
        {user.avatar ? (
          <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
        ) : "👤"}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <span className="text-white font-semibold text-[14px] truncate block">{user.username}</span>
        <p className="text-white/50 text-[12px]">{user.displayName}</p>
      </div>
      {user.id !== currentUserId && (
        <button
          onClick={handleToggleFollow}
          className={cn("px-3 py-1 rounded-md text-[12px] font-semibold flex-shrink-0 border transition-colors", following ? "border-white/20 text-white/60" : "border-[#ff0050] text-[#ff0050]")}
        >
          {following ? <><Check className="h-3 w-3 inline mr-0.5" />Following</> : "Follow"}
        </button>
      )}
    </div>
  );
}

function VideoThumb({ video, onClick }: { video: EtokVideo; onClick: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      onClick={onClick}
      className="aspect-[9/16] relative overflow-hidden bg-black"
    >
      {video.videoUrl ? (
        <video
          ref={videoRef}
          src={video.videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={() => setLoaded(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-gray-700 to-gray-900 flex items-center justify-center">
          <span className="text-4xl">🎬</span>
        </div>
      )}
      {!loaded && video.videoUrl && (
        <div className="absolute inset-0 bg-gradient-to-b from-gray-700 to-gray-900 flex items-center justify-center">
          <span className="text-4xl">🎬</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" />
      <span className="absolute bottom-1 left-1 text-white text-[10px] font-medium drop-shadow">▶ {formatCount(video.views)}</span>
    </button>
  );
}

const CATEGORY_CARDS = [
  { label: "Dance", emoji: "💃", gradient: "from-pink-600 to-purple-700" },
  { label: "Comedy", emoji: "😂", gradient: "from-yellow-500 to-orange-600" },
  { label: "Sports", emoji: "⚽", gradient: "from-green-600 to-teal-700" },
  { label: "Food", emoji: "🍲", gradient: "from-red-600 to-orange-700" },
  { label: "Travel", emoji: "✈️", gradient: "from-sky-600 to-blue-700" },
  { label: "Fashion", emoji: "👗", gradient: "from-rose-600 to-pink-700" },
  { label: "Music", emoji: "🎵", gradient: "from-violet-600 to-indigo-700" },
  { label: "Fitness", emoji: "💪", gradient: "from-emerald-600 to-green-700" },
  { label: "Art", emoji: "🎨", gradient: "from-amber-500 to-yellow-600" },
  { label: "Life", emoji: "🌟", gradient: "from-cyan-500 to-blue-600" },
];

const EtokSearch = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeTab, setActiveTab] = useState<ResultTab>("top");

  const [videoResults, setVideoResults] = useState<EtokVideo[]>([]);
  const [userResults, setUserResults] = useState<EtokUser[]>([]);
  const [soundResults, setSoundResults] = useState<EtokSound[]>([]);
  const [hashtagResults, setHashtagResults] = useState<EtokHashtag[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<EtokUser[]>([]);
  const [trendingHashtags, setTrendingHashtags] = useState<EtokHashtag[]>([]);
  const [trendingSounds, setTrendingSounds] = useState<EtokSound[]>([]);
  const [activeLives, setActiveLives] = useState<EtokLiveStream[]>([]);

  // Load suggestions, trending data, and active lives on mount
  useEffect(() => {
    searchUsersAsync("").then(users => setSuggestedUsers(users.slice(0, 10)));
    fetchTrendingHashtags().then(setTrendingHashtags);
    fetchAllSounds().then(s => setTrendingSounds(s.slice(0, 5)));
    fetchActiveLives().then(setActiveLives);
  }, []);

  const [searchError, setSearchError] = useState(false);
  const [searching, setSearching] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setVideoResults([]); setUserResults([]); setSoundResults([]); setHashtagResults([]); setSearchError(false);
    if (!query.trim()) { setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const [videos, users, sounds, hashtags] = await Promise.all([searchVideosAsync(query), searchUsersAsync(query), searchSoundsAsync(query), searchHashtagsAsync(query)]);
        if (!active) return;
        setVideoResults(videos); setUserResults(users); setSoundResults(sounds); setHashtagResults(hashtags);
      } catch { if (active) setSearchError(true); }
      finally { if (active) setSearching(false); }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query, currentUserId, retry]);

  const tabs: { id: ResultTab; label: string }[] = [
    { id: "top", label: "Top" },
    { id: "users", label: "Accounts" },
    { id: "videos", label: "Videos" },
    { id: "sounds", label: "Sounds" },
    { id: "live", label: "LIVE" },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Search bar */}
      <div className="sticky top-0 bg-black z-20 px-3 pt-12 pb-3">
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {focused && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onClick={() => { setQuery(""); setFocused(false); inputRef.current?.blur(); }}
                className="text-white font-medium text-[14px] flex-shrink-0"
              >
                Cancel
              </motion.button>
            )}
          </AnimatePresence>
          <div className="flex-1 flex items-center bg-white/10 rounded-lg px-3 gap-2 h-11">
            <Search className="h-4 w-4 text-white/50 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => !query && setFocused(false)}
              placeholder="Search"
              className="flex-1 bg-transparent text-white text-[15px] outline-none placeholder:text-white/40"
            />
            {query && (
              <button onClick={() => setQuery("")}>
                <X className="h-4 w-4 text-white/50" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs when searching */}
      {query && (
        <div className="flex overflow-x-auto border-b border-white/10 sticky top-[80px] bg-black z-10">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn("flex-shrink-0 px-4 py-2.5 text-[14px] font-semibold border-b-2 transition-colors", activeTab === tab.id ? "border-white text-white" : "border-transparent text-white/50")}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {searching && <p className="px-4 py-2 text-muted-foreground" role="status">Searching…</p>}
      {searchError && <div className="px-4 py-2 text-destructive" role="alert">Could not load results. <button onClick={() => setRetry(v => v + 1)}>Retry</button></div>}
      {!query ? (
        <div className="px-3 pb-24">
          {/* Category grid */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {CATEGORY_CARDS.map(cat => (
              <button
                key={cat.label}
                onClick={() => { setQuery(cat.label.toLowerCase()); setFocused(true); }}
                className={cn("relative h-[90px] rounded-xl overflow-hidden bg-gradient-to-br", cat.gradient)}
              >
                <span className="absolute right-3 bottom-2 text-4xl opacity-80">{cat.emoji}</span>
                <span className="absolute left-3 bottom-3 text-white font-bold text-[16px] drop-shadow">{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Trending */}
          <div className="mb-6">
            <div className="flex items-center gap-1.5 mb-3">
              <TrendingUp className="h-4 w-4 text-[#ff0050]" />
              <span className="text-white font-bold text-[15px]">Trending</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {trendingHashtags.slice(0, 10).map(h => (
                <button
                  key={h.id}
                  onClick={() => { setQuery("#" + h.name); setFocused(true); }}
                  className="px-3 py-1.5 bg-white/[0.08] rounded-full border border-white/10 text-[13px] text-white/80"
                >
                  #{h.name}
                </button>
              ))}
            </div>
          </div>

          {/* Trending sounds */}
          <div className="mb-6">
            <p className="text-white font-bold text-[15px] mb-3">🎵 Trending Sounds</p>
            <div className="space-y-4">
              {trendingSounds.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="text-white/30 font-bold text-[15px] w-5 text-right">{i + 1}</span>
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center text-2xl">{s.coverEmoji}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[13px] font-semibold truncate">{s.title}</p>
                    <p className="text-white/50 text-[11px]">{s.authorName} · {formatCount(s.videoCount)} videos</p>
                  </div>
                  <div className="w-10 h-10 border border-white/20 rounded-xl flex items-center justify-center">
                    <span className="text-white/50 text-xl">▶</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Suggested accounts */}
          <div>
            <p className="text-white font-bold text-[15px] mb-3 px-1">Suggested Accounts</p>
            {suggestedUsers.map(u => (
              <UserCard key={u.id} user={u} currentUserId={currentUserId} onNavigate={id => navigate(`/etok/profile/${id}`)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="pb-24">
          {activeTab === "top" && (
            <>
              {userResults.length > 0 && (
                <div className="mb-2">
                  <p className="text-white/50 text-[12px] font-semibold px-4 pt-4 pb-2 uppercase tracking-wide">Accounts</p>
                  {userResults.slice(0, 3).map(u => (
                    <UserCard key={u.id} user={u} currentUserId={currentUserId} onNavigate={id => navigate(`/etok/profile/${id}`)} />
                  ))}
                </div>
              )}
              {videoResults.length > 0 && (
                <>
                  <p className="text-white/50 text-[12px] font-semibold px-4 pt-2 pb-2 uppercase tracking-wide">Videos</p>
                  <div className="grid grid-cols-3 gap-[1px]">
                    {videoResults.slice(0, 9).map(v => (
                      <VideoThumb key={v.id} video={v} onClick={() => navigate(`/etok?video=${v.id}`)} />
                    ))}
                  </div>
                </>
              )}
              {hashtagResults.length > 0 && (
                <>
                  <p className="text-white/50 text-[12px] font-semibold px-4 pt-4 pb-2 uppercase tracking-wide">Hashtags</p>
                  <div className="divide-y divide-white/10">
                    {hashtagResults.slice(0, 5).map(h => (
                      <button
                        key={h.id}
                        onClick={() => setQuery("#" + h.name)}
                        className="flex items-center gap-3 w-full px-4 py-3 active:bg-white/5 text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-[18px] font-bold text-white">#</div>
                        <div>
                          <p className="text-white font-semibold text-[14px]">#{h.name}</p>
                          <p className="text-white/50 text-[12px]">{formatCount(h.viewCount)} videos</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {userResults.length === 0 && videoResults.length === 0 && hashtagResults.length === 0 && (
                <div className="text-center py-20 text-white/40">
                  <p className="text-[15px]">No results for "{query}"</p>
                  <p className="text-[13px] mt-2">Try searching with different keywords</p>
                </div>
              )}
            </>
          )}

          {activeTab === "users" && (
            userResults.length === 0 ? (
              <div className="text-center py-20 text-white/40 text-[15px]">No accounts found</div>
            ) : userResults.map(u => (
              <UserCard key={u.id} user={u} currentUserId={currentUserId} onNavigate={id => navigate(`/etok/profile/${id}`)} />
            ))
          )}

          {activeTab === "videos" && (
            videoResults.length === 0 ? (
              <div className="text-center py-20 text-white/40 text-[15px]">No videos found</div>
            ) : (
              <div className="grid grid-cols-3 gap-[1px]">
                {videoResults.map(v => (
                  <VideoThumb key={v.id} video={v} onClick={() => navigate(`/etok?video=${v.id}`)} />
                ))}
              </div>
            )
          )}

          {activeTab === "sounds" && (
            soundResults.length === 0 ? (
              <div className="text-center py-20 text-white/40 text-[15px]">No sounds found</div>
            ) : (
              <div className="divide-y divide-white/10">
                {soundResults.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-4">
                    <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center text-3xl flex-shrink-0">{s.coverEmoji}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-[14px] truncate">{s.title}</p>
                      <p className="text-white/50 text-[12px]">Original · {s.authorName}</p>
                      <p className="text-white/40 text-[11px]">{formatCount(s.videoCount)} videos</p>
                    </div>
                    <button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white text-sm">▶</button>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === "live" && (
            activeLives.length === 0 ? (
              <div className="text-center py-20 text-white/40 text-[15px]">No live streams right now</div>
            ) : (
              <div className="grid grid-cols-2 gap-2 p-3">
                {activeLives.map(live => (
                  <button
                    key={live.id}
                    onClick={() => navigate(`/etok/live/${live.id}`)}
                    className={cn("aspect-[4/5] rounded-xl overflow-hidden relative bg-gradient-to-b", live.thumbnailColor)}
                  >
                    <div className="absolute inset-0 flex items-center justify-center text-5xl">{live.thumbnailEmoji}</div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent" />
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-600 rounded px-1.5 py-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span className="text-white text-[10px] font-bold">LIVE</span>
                    </div>
                    <div className="absolute top-2 right-2 bg-black/50 rounded px-1.5 py-0.5 text-white text-[10px]">👁 {formatCount(live.viewerCount)}</div>
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-white text-[11px] font-semibold line-clamp-2">{live.title}</p>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      )}

      <EtokBottomNav />
    </div>
  );
};

export default EtokSearch;
