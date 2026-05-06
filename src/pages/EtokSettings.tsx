// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, MessageCircle, Clock, ChevronRight, Bell, Eye, Lock, UserX, Globe, Search, Download, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPrivacySettingsAsync, savePrivacySettingsAsync, getBlockedUsersAsync, unblockUserAsync,
  getScreenTimeToday, type EtokPrivacySettings, type BlockedUser,
} from "@/lib/etokPrivacyService";
import { fetchEtokProfile, type EtokUser } from "@/lib/etokService";
import { toast } from "sonner";
import { EtokBottomNav } from "@/components/etok/EtokBottomNav";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SettingsSection = "main" | "privacy" | "comments" | "screen_time" | "blocked" | "data";

const EtokSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";

  const [section, setSection] = useState<SettingsSection>("main");
  const [settings, setSettings] = useState<EtokPrivacySettings | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedProfiles, setBlockedProfiles] = useState<Record<string, EtokUser>>({});
  const [keywordInput, setKeywordInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [unblockTarget, setUnblockTarget] = useState<BlockedUser | null>(null);
  const [unblocking, setUnblocking] = useState(false);
  const todayMinutes = getScreenTimeToday();

  useEffect(() => {
    if (!currentUserId) return;
    Promise.all([getPrivacySettingsAsync(currentUserId), getBlockedUsersAsync(currentUserId)]).then(([s, blocked]) => {
      setSettings(s);
      setBlockedUsers(blocked);
    });
  }, [currentUserId]);

  // Load profile data for blocked users
  useEffect(() => {
    blockedUsers.forEach(bu => {
      if (!blockedProfiles[bu.blockedId]) {
        fetchEtokProfile(bu.blockedId).then(p => {
          if (p) setBlockedProfiles(prev => ({ ...prev, [bu.blockedId]: p }));
        });
      }
    });
  }, [blockedUsers]);

  const save = async (updated: EtokPrivacySettings) => {
    await savePrivacySettingsAsync(updated);
    setSettings(updated);
    toast.success("Saved");
  };

  if (!settings) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-10 h-10 rounded-full border-4 border-white/20 border-t-white animate-spin" /></div>;
  }

  const ToggleRow = ({ label, sub, val, onChange }: { label: string; sub?: string; val: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center gap-3 py-4 border-b border-white/[0.08]">
      <div className="flex-1 min-w-0">
        <p className="text-white text-[14px] font-medium">{label}</p>
        {sub && <p className="text-white/40 text-[12px] mt-0.5">{sub}</p>}
      </div>
      <button
        onClick={() => onChange(!val)}
        className={cn("relative w-12 h-6 rounded-full transition-colors flex-shrink-0", val ? "bg-[#ff0050]" : "bg-white/20")}
      >
        <div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", val ? "translate-x-6" : "translate-x-0.5")} />
      </button>
    </div>
  );

  type IPerm = "everyone" | "friends" | "no_one";
  const RadioRow = ({ label, options, current, onChange }: { label: string; options: IPerm[]; current: string; onChange: (v: IPerm) => void }) => (
    <div className="py-4 border-b border-white/[0.08]">
      <p className="text-white text-[14px] font-medium mb-3">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={cn("px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors capitalize", current === opt ? "bg-[#ff0050] border-[#ff0050] text-white" : "border-white/20 text-white/60")}
          >
            {opt.replace("_", " ")}
          </button>
        ))}
      </div>
    </div>
  );

  const MAIN_SECTIONS = [
    { id: "privacy", label: "Privacy", icon: Shield, sub: "Account, interactions & permissions" },
    { id: "comments", label: "Comments & Keywords", icon: MessageCircle, sub: "Filter spam and keywords" },
    { id: "screen_time", label: "Screen Time", icon: Clock, sub: `Today: ${todayMinutes} min${settings.screenTimeLimitMinutes ? ` of ${settings.screenTimeLimitMinutes} min` : ""}` },
    { id: "blocked", label: "Blocked Accounts", icon: UserX, sub: `${blockedUsers.length} account${blockedUsers.length !== 1 ? "s" : ""} blocked` },
    { id: "data", label: "Data & Privacy", icon: Download, sub: "Download data, delete account" },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 bg-black z-20 flex items-center justify-between px-4 pt-12 pb-3">
        <button onClick={() => section === "main" ? navigate(-1) : setSection("main")}>
          <ArrowLeft className="h-6 w-6 text-white" />
        </button>
        <h1 className="font-bold text-[17px]">
          {section === "main" ? "Privacy & Settings" : MAIN_SECTIONS.find(s => s.id === section)?.label ?? "Settings"}
        </h1>
        <div />
      </div>

      <div className="pb-28">
        {section === "main" && (
          <div className="px-4">
            <div className="space-y-2 mt-2">
              {MAIN_SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id as SettingsSection)}
                  className="flex items-center gap-4 w-full bg-white/5 rounded-2xl p-4 active:bg-white/10"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <s.icon className="h-5 w-5 text-white/70" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-white font-semibold text-[14px]">{s.label}</p>
                    <p className="text-white/40 text-[12px]">{s.sub}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/30" />
                </button>
              ))}
            </div>

            <div className="mt-6 border border-white/10 rounded-2xl overflow-hidden">
              {[
                { label: "Notifications", icon: Bell },
                { label: "Account & Security", icon: Lock },
                { label: "Language", icon: Globe },
                { label: "Search History", icon: Search },
              ].map(item => (
                <button key={item.label} className="flex items-center gap-4 w-full px-4 py-4 border-b border-white/[0.08] last:border-0 active:bg-white/5">
                  <item.icon className="h-5 w-5 text-white/50" />
                  <span className="text-white/80 text-[14px] flex-1 text-left">{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-white/20" />
                </button>
              ))}
            </div>

            <button onClick={() => toast.error("Sign out?")} className="w-full mt-6 py-4 text-red-400 font-semibold text-[15px] border border-red-900/30 rounded-2xl">
              Log out
            </button>
          </div>
        )}

        {section === "privacy" && (
          <div className="px-4">
            <ToggleRow label="Private Account" sub="Only followers can see your content" val={settings.privateAccount} onChange={v => save({ ...settings, privateAccount: v })} />
            <ToggleRow label="Allow Downloads" sub="Let others download your videos" val={settings.allowDownload} onChange={v => save({ ...settings, allowDownload: v })} />
            <RadioRow label="Who can comment" options={["everyone", "friends", "no_one"]} current={settings.allowComments} onChange={v => save({ ...settings, allowComments: v })} />
            <RadioRow label="Who can Duet" options={["everyone", "friends", "no_one"]} current={settings.duetPermission} onChange={v => save({ ...settings, duetPermission: v })} />
            <RadioRow label="Who can Stitch" options={["everyone", "friends", "no_one"]} current={settings.stitchPermission} onChange={v => save({ ...settings, stitchPermission: v })} />
          </div>
        )}

        {section === "comments" && (
          <div className="px-4">
            <ToggleRow label="Filter spam" sub="Auto-hide spam and scam comments" val={settings.filterSpam} onChange={v => save({ ...settings, filterSpam: v })} />

            <div className="mt-5 mb-3">
              <p className="text-white font-bold text-[15px]">Keyword Filter</p>
              <p className="text-white/50 text-[13px] mt-0.5">Hide comments containing these words</p>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && keywordInput.trim()) {
                    const updated = { ...settings, commentKeywords: [...settings.commentKeywords, keywordInput.trim()] };
                    save(updated);
                    setKeywordInput("");
                  }
                }}
                placeholder="Add keyword..."
                className="flex-1 bg-white/10 rounded-xl px-4 py-2.5 text-white text-[14px] outline-none placeholder:text-white/30 border border-white/10"
              />
              <button
                onClick={() => { if (keywordInput.trim()) { save({ ...settings, commentKeywords: [...settings.commentKeywords, keywordInput.trim()] }); setKeywordInput(""); } }}
                className="px-4 py-2.5 bg-[#ff0050] rounded-xl text-white font-bold text-[14px]"
              >Add</button>
            </div>

            {settings.commentKeywords.length === 0 ? (
              <p className="text-white/30 text-[13px] text-center py-8">No blocked keywords</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {settings.commentKeywords.map(kw => (
                  <div key={kw} className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
                    <span className="text-white text-[13px]">{kw}</span>
                    <button onClick={() => save({ ...settings, commentKeywords: settings.commentKeywords.filter(k => k !== kw) })}>
                      <span className="text-white/40 text-[14px] leading-none">×</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {section === "screen_time" && (
          <div className="px-4">
            <div className="bg-white/5 rounded-2xl p-5 mb-5 border border-white/[0.08]">
              <p className="text-white/50 text-[12px] uppercase tracking-wide mb-1">Today's Usage</p>
              <p className="text-white font-bold text-[32px]">{Math.floor(todayMinutes / 60)}h {todayMinutes % 60}m</p>
              <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#ff0050]" style={{ width: settings.screenTimeLimitMinutes ? `${Math.min(100, (todayMinutes / settings.screenTimeLimitMinutes) * 100)}%` : "25%" }} />
              </div>
              {settings.screenTimeLimitMinutes > 0 && <p className="text-white/40 text-[12px] mt-1">of {settings.screenTimeLimitMinutes} min daily limit</p>}
            </div>

            <p className="text-white font-bold text-[15px] mb-3">Daily Limit</p>
            <div className="grid grid-cols-3 gap-2">
              {[30, 60, 90, 120, 180, 0].map(min => (
                <button
                  key={min}
                  onClick={() => save({ ...settings, screenTimeLimitMinutes: min })}
                  className={cn("py-3 rounded-xl text-[13px] font-semibold border transition-colors", settings.screenTimeLimitMinutes === min ? "bg-[#ff0050] border-[#ff0050] text-white" : "border-white/20 text-white/60")}
                >
                  {min === 0 ? "No limit" : `${min} min`}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <ToggleRow label="Break reminders" sub="Remind me to take breaks" val={settings.screenTimeReminderEnabled} onChange={v => save({ ...settings, screenTimeReminderEnabled: v })} />
            </div>
          </div>
        )}

        {section === "blocked" && (
          <div>
            {blockedUsers.length === 0 ? (
              <div className="text-center py-20 text-white/40">
                <UserX className="h-10 w-10 mx-auto mb-3" />
                <p className="text-[15px]">No blocked accounts</p>
              </div>
            ) : blockedUsers.map(bu => {
              const u = blockedProfiles[bu.blockedId];
              return (
                <div key={bu.blockedId} className="flex items-center gap-3 px-4 py-4 border-b border-white/[0.08]">
                  <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-2xl overflow-hidden">
                    {u?.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : "👤"}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold text-[14px]">{u?.username ?? "user"}</p>
                    <p className="text-white/50 text-[12px]">{u?.displayName}</p>
                  </div>
                  <button
                    onClick={() => setUnblockTarget(bu)}
                    className="px-3 py-1.5 border border-white/20 rounded-full text-white/70 text-[12px] font-semibold"
                  >
                    Unblock
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {section === "data" && (
          <div className="px-4 space-y-3">
            {/* Download data */}
            <button
              onClick={() => {
                const data = { userId: currentUserId, settings, screenTimeMinutes: todayMinutes, blockedUsers, exportedAt: new Date().toISOString() };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `etok-data-${currentUserId}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Data downloaded!");
              }}
              className="flex items-center gap-4 w-full bg-white/5 rounded-2xl p-4 active:bg-white/10"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#20d5ec25" }}>
                <Download className="h-5 w-5" style={{ color: "#20d5ec" }} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-[14px] text-white">Download your data</p>
                <p className="text-white/40 text-[12px]">Get a copy of your Etok data</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/20" />
            </button>

            {/* Your activity */}
            <button
              onClick={() => setSection("screen_time")}
              className="flex items-center gap-4 w-full bg-white/5 rounded-2xl p-4 active:bg-white/10"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#7c3aed25" }}>
                <Eye className="h-5 w-5" style={{ color: "#7c3aed" }} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-[14px] text-white">Your activity</p>
                <p className="text-white/40 text-[12px]">View screen time & interactions</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/20" />
            </button>

            {/* Data about you */}
            <button
              onClick={() => { toast.success(`Account ID: ${currentUserId.slice(0, 8)}… · Privacy: ${settings.whoCanComment} comments`); }}
              className="flex items-center gap-4 w-full bg-white/5 rounded-2xl p-4 active:bg-white/10"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#f9731625" }}>
                <Globe className="h-5 w-5" style={{ color: "#f97316" }} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-[14px] text-white">Data about you</p>
                <p className="text-white/40 text-[12px]">Information from partners</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/20" />
            </button>

            {/* Delete account */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-4 w-full bg-white/5 rounded-2xl p-4 active:bg-white/10"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-500/20">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-[14px] text-red-400">Delete account</p>
                <p className="text-white/40 text-[12px]">Permanently delete your account</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/20" />
            </button>

            {showDeleteConfirm && (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 space-y-3">
                <p className="text-red-400 font-semibold text-[14px]">Are you sure?</p>
                <p className="text-white/50 text-[12px]">Your account and all Etok data will be permanently deleted. This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 rounded-xl bg-white/10 text-white text-[13px] font-semibold">Cancel</button>
                  <button onClick={() => { toast.error("Please contact support to delete your account."); setShowDeleteConfirm(false); }} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-[13px] font-semibold">Delete</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <EtokBottomNav />
    </div>
  );
};

export default EtokSettings;
