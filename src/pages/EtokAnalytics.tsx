import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, Users, Eye, Heart, PlayCircle, Calendar, ChevronDown } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserVideos, fetchFollowerCount, fetchTotalVideoLikes, formatCount, type EtokVideo } from "@/lib/etokService";
import { EtokBottomNav } from "@/components/etok/EtokBottomNav";

type Period = "7d" | "28d";
type AnalyticsTab = "overview" | "content" | "audience";

interface Stats {
  views: number;
  likes: number;
  followers: number;
  videoCount: number;
}

const EtokAnalytics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";
  const [period, setPeriod] = useState<Period>("7d");
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [videos, setVideos] = useState<EtokVideo[]>([]);
  const [stats, setStats] = useState<Stats>({ views: 0, likes: 0, followers: 0, videoCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserId) return;
    const load = async () => {
      setLoading(true);
      const [vids, followers, totalLikes] = await Promise.all([
        fetchUserVideos(currentUserId),
        fetchFollowerCount(currentUserId),
        fetchTotalVideoLikes(currentUserId),
      ]);
      setVideos(vids);
      const totalViews = vids.reduce((s, v) => s + v.views, 0);
      setStats({ views: totalViews, likes: totalLikes, followers, videoCount: vids.length });
      setLoading(false);
    };
    load();
  }, [currentUserId]);

  // Generate chart data from real videos only; no simulated/random analytics.
  const days = period === "7d" ? 7 : 28;
  const growthData = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const iso = d.toISOString().slice(0, 10);
    const dayVideos = videos.filter(v => v.createdAt?.slice(0, 10) === iso);
    return {
      date: iso.slice(5, 10),
      views: dayVideos.reduce((sum, v) => sum + v.views, 0),
      likes: dayVideos.reduce((sum, v) => sum + v.likes, 0),
      followers: 0,
    };
  });

  const periodLabel = period === "7d" ? "Last 7 days" : "Last 28 days";

  const TABS: { id: AnalyticsTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "content", label: "Content" },
    { id: "audience", label: "Audience" },
  ];

  const statCards = [
    { label: "Video Views", value: formatCount(stats.views), icon: Eye, color: "#ff0050" },
    { label: "Likes", value: formatCount(stats.likes), icon: Heart, color: "#f97316" },
    { label: "Followers", value: formatCount(stats.followers), icon: Users, color: "#20d5ec" },
    { label: "Videos", value: stats.videoCount.toString(), icon: PlayCircle, color: "#22c55e" },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 bg-black z-20 flex items-center justify-between px-4 pt-12 pb-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-white" /></button>
        <h1 className="font-bold text-[17px]">Creator Analytics</h1>
        <div />
      </div>

      {/* Period selector */}
      <div className="px-4 mb-4 relative">
        <button
          onClick={() => setShowPeriodPicker(!showPeriodPicker)}
          className="flex items-center gap-1.5 bg-white/10 rounded-lg px-4 py-2.5 text-white text-[14px] font-semibold"
        >
          <Calendar className="h-4 w-4 text-white/60" />
          {periodLabel}
          <ChevronDown className={cn("h-4 w-4 text-white/60 transition-transform", showPeriodPicker && "rotate-180")} />
        </button>
        {showPeriodPicker && (
          <div className="absolute top-full left-4 mt-1 bg-[#1a1a1a] rounded-xl overflow-hidden border border-white/10 z-10">
            {(["7d", "28d"] as Period[]).map(p => (
              <button key={p} onClick={() => { setPeriod(p); setShowPeriodPicker(false); }} className={cn("flex items-center w-full px-5 py-3 text-[14px]", period === p ? "text-[#ff0050] font-bold" : "text-white/80")}>
                {p === "7d" ? "Last 7 days" : "Last 28 days"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 px-2 mb-4 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn("flex-shrink-0 px-3 py-2.5 text-[14px] font-semibold border-b-2 transition-colors", activeTab === tab.id ? "border-[#ff0050] text-white" : "border-transparent text-white/50")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 pb-28 space-y-5">
        {loading ? (
          <div className="text-center py-20 text-white/40">Loading analytics...</div>
        ) : (
          <>
            {activeTab === "overview" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {statCards.map(s => (
                    <div key={s.label} className="bg-white/5 rounded-2xl p-4 border border-white/[0.08]">
                      <div className="flex items-center justify-between mb-2">
                        <s.icon className="h-5 w-5" style={{ color: s.color }} />
                      </div>
                      <p className="text-white font-bold text-[22px]">{s.value}</p>
                      <p className="text-white/50 text-[11px] mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/[0.08]">
                  <p className="text-white font-bold text-[15px] mb-4">Video Views</p>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={growthData}>
                      <defs>
                        <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ff0050" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#ff0050" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#666", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => formatCount(v)} />
                      <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#fff", fontSize: 12 }} />
                      <Area type="monotone" dataKey="views" stroke="#ff0050" fill="url(#viewsGrad)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/[0.08]">
                  <p className="text-white font-bold text-[15px] mb-4">Likes Trend</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={growthData}>
                      <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#666", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#fff", fontSize: 12 }} />
                      <Bar dataKey="likes" fill="#20d5ec" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {activeTab === "content" && (
              <>
                <p className="text-white/50 text-[13px]">Your {videos.length} videos</p>
                <div className="space-y-3">
                  {videos.length === 0 ? (
                    <div className="text-center py-12 text-white/40 text-[14px]">No videos yet. Start creating!</div>
                  ) : videos.map(v => (
                    <div key={v.id} className="flex gap-3 bg-white/5 rounded-2xl p-3 border border-white/[0.08]">
                      <div className="w-14 h-[78px] rounded-xl overflow-hidden bg-gray-800 flex items-center justify-center text-3xl flex-shrink-0">
                        {v.videoUrl ? (
                          <video src={v.videoUrl} className="w-full h-full object-cover" muted preload="metadata" />
                        ) : "🎬"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-[13px] font-semibold line-clamp-2">{v.description || "No description"}</p>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {[
                            { icon: Eye, val: formatCount(v.views) },
                            { icon: Heart, val: formatCount(v.likes) },
                            { icon: PlayCircle, val: `${v.shares} shares` },
                          ].map((s, j) => (
                            <div key={j} className="flex items-center gap-1">
                              <s.icon className="h-3 w-3 text-white/40" />
                              <span className="text-white/70 text-[11px] font-semibold">{s.val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === "audience" && (
              <div className="text-center py-16 text-white/40 text-[14px]">
                Audience analytics will appear after real viewer demographic data is collected.
              </div>
            )}
          </>
        )}
      </div>

      <EtokBottomNav />
    </div>
  );
};

export default EtokAnalytics;
