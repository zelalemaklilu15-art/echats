// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MoreHorizontal, Settings, Share2, MessageSquare, Edit3, CheckCircle2, BarChart2, Lock, Grid3X3, Heart, Bookmark, Briefcase, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  fetchEtokProfile, fetchUserVideos, fetchFollowerCount, fetchFollowingCount, fetchTotalVideoLikes,
  checkIsFollowing, toggleFollowAsync, updateEtokProfileAsync,
  formatCount, type EtokUser, type EtokVideo,
} from "@/lib/etokService";
import { blockUserAsync, reportContentAsync } from "@/lib/etokPrivacyService";
import { EtokBottomNav } from "@/components/etok/EtokBottomNav";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type ProfileTab = "videos" | "likes" | "favorites";

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "abuse", label: "Abuse" },
  { value: "harassment", label: "Harassment" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "nudity", label: "Nudity / sexual content" },
  { value: "violence", label: "Violence" },
  { value: "other", label: "Other" },
] as const;

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50, "Name must be ≤ 50 chars"),
  username: z.string().trim().min(3, "Username must be ≥ 3 chars").max(24, "Username must be ≤ 24 chars")
    .regex(/^[a-zA-Z0-9_.]+$/, "Only letters, numbers, _ and ."),
  bio: z.string().trim().max(160, "Bio must be ≤ 160 chars"),
});

const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS.map(r => r.value) as [string, ...string[]], { message: "Select a reason" }),
  details: z.string().trim().max(500, "Details must be ≤ 500 chars"),
});

const EtokProfile = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? "";

  const resolvedId = userId ?? currentUserId;
  const isOwn = resolvedId === currentUserId;

  const [profile, setProfile] = useState<EtokUser | null>(null);
  const [videos, setVideos] = useState<EtokVideo[]>([]);
  const [following, setFollowingState] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("videos");
  const [showMore, setShowMore] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editErrors, setEditErrors] = useState<{ name?: string; username?: string; bio?: string }>({});
  const [saving, setSaving] = useState(false);

  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<string>("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportError, setReportError] = useState<string>("");
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [p, vids, followers, followings, totalLikes] = await Promise.all([
        fetchEtokProfile(resolvedId),
        fetchUserVideos(resolvedId),
        fetchFollowerCount(resolvedId),
        fetchFollowingCount(resolvedId),
        fetchTotalVideoLikes(resolvedId),
      ]);
      setProfile(p);
      setVideos(vids);
      setFollowerCount(followers);
      setFollowingCount(followings);
      setLikesCount(totalLikes);
      if (p) {
        setEditName(p.displayName);
        setEditUsername(p.username);
        setEditBio(p.bio ?? "");
      }
      if (!isOwn) {
        const isF = await checkIsFollowing(currentUserId, resolvedId);
        setFollowingState(isF);
      }
      setLoading(false);
    };
    load();
  }, [resolvedId, currentUserId, isOwn]);

  const handleFollow = async () => {
    const f = await toggleFollowAsync(currentUserId, resolvedId);
    setFollowingState(f);
    setFollowerCount(c => f ? c + 1 : Math.max(0, c - 1));
  };

  const VideoGrid = ({ vids }: { vids: EtokVideo[] }) => (
    <>
      {vids.length === 0 ? (
        <div className="col-span-3 flex flex-col items-center justify-center py-20 text-white/40">
          <Lock className="h-8 w-8 mb-3" />
          <p className="text-sm">No videos yet</p>
        </div>
      ) : (
        vids.map(v => (
          <button key={v.id} onClick={() => navigate(`/etok?video=${v.id}`)} className="relative aspect-[9/16] overflow-hidden rounded-sm bg-black">
            {v.videoUrl ? (
              <video src={v.videoUrl} className="absolute inset-0 w-full h-full object-cover" muted preload="metadata" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-purple-900 to-pink-900 flex items-center justify-center">
                <span className="text-4xl">🎬</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
            <div className="absolute bottom-1 left-1 flex items-center gap-0.5">
              <svg className="h-3 w-3 text-white fill-white" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              <span className="text-white text-[10px] font-medium">{formatCount(v.views)}</span>
            </div>
          </button>
        ))
      )}
    </>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 bg-black z-20 flex items-center justify-between px-4 pt-12 pb-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-white" /></button>
        <span className="font-bold text-[16px]">@{profile?.username}</span>
        <div className="flex items-center gap-3">
          {isOwn && (
            <>
              <button onClick={() => navigate("/etok/creator-tools")} title="Creator Tools"><Briefcase className="h-5 w-5 text-white/70" /></button>
              <button onClick={() => navigate("/etok/analytics")} title="Analytics"><BarChart2 className="h-5 w-5 text-white/70" /></button>
            </>
          )}
          <button onClick={() => setShowMore(true)}><MoreHorizontal className="h-6 w-6 text-white" /></button>
        </div>
      </div>

      <div className="overflow-y-auto pb-24">
        <div className="flex flex-col items-center pt-4 pb-5 px-4">
          <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-5xl mb-3 overflow-hidden">
            {profile?.avatar ? <img src={profile.avatar} alt="" className="w-full h-full object-cover" /> : "👤"}
          </div>

          <div className="flex items-center gap-1.5 mb-1">
            <span className="font-bold text-[18px]">{profile?.displayName}</span>
          </div>
          <p className="text-white/60 text-[13px] mb-3">@{profile?.username}</p>

          <div className="flex items-center gap-8 mb-5">
            {[
              { label: "Following", value: formatCount(followingCount) },
              { label: "Followers", value: formatCount(followerCount) },
              { label: "Likes", value: formatCount(likesCount) },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center gap-0.5">
                <span className="font-bold text-[18px]">{s.value}</span>
                <span className="text-white/50 text-[12px]">{s.label}</span>
              </div>
            ))}
          </div>

          {profile?.bio && (
            <p className="mb-3 text-center max-w-xs text-white/80 text-[13px] leading-relaxed">{profile.bio}</p>
          )}

          {isOwn ? (
            <div className="flex gap-2 w-full max-w-xs">
              <button onClick={() => setShowEdit(true)} className="flex-1 py-2 rounded-lg border border-white/20 text-white font-semibold text-[14px]">Edit profile</button>
              <button onClick={() => navigate("/etok/settings")} className="w-10 h-10 rounded-lg border border-white/20 flex items-center justify-center">
                <Settings className="h-4 w-4 text-white" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2 w-full max-w-xs">
              <button onClick={handleFollow}
                className={cn("flex-1 py-2.5 rounded-lg font-bold text-[14px] transition-colors", following ? "border border-white/20 text-white" : "bg-[#ff0050] text-white")}>
                {following ? "Following" : "Follow"}
              </button>
              <button onClick={() => navigate("/chats")}
                className="flex-1 py-2.5 rounded-lg border border-white/20 text-white font-semibold text-[14px] flex items-center justify-center gap-1.5">
                <MessageSquare className="h-4 w-4" /> Message
              </button>
              <button className="w-10 h-10 rounded-lg border border-white/20 flex items-center justify-center">
                <Share2 className="h-4 w-4 text-white" />
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {[
            { id: "videos" as ProfileTab, icon: Grid3X3 },
            { id: "likes" as ProfileTab, icon: Heart },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn("flex-1 flex items-center justify-center py-3 border-b-[2px] transition-colors", activeTab === tab.id ? "border-white" : "border-transparent")}>
              <tab.icon className={cn("h-5 w-5", activeTab === tab.id ? "text-white" : "text-white/40")} />
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-3 gap-[1.5px]">
          {activeTab === "videos" && <VideoGrid vids={videos} />}
          {activeTab === "likes" && (
            <div className="col-span-3 flex flex-col items-center justify-center py-20 text-white/40">
              <Lock className="h-8 w-8 mb-3" /><p className="text-sm">Liked videos are private</p>
            </div>
          )}
        </div>
      </div>

      {/* More options */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowMore(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] rounded-t-2xl z-50 pb-8">
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-4" />
              {isOwn ? (
                <>
                  <button onClick={() => { setShowEdit(true); setShowMore(false); }} className="flex items-center gap-4 w-full px-6 py-4">
                    <Edit3 className="h-5 w-5 text-white/70" /><span className="text-white text-[15px]">Edit profile</span>
                  </button>
                  <button onClick={() => { navigate("/etok/settings"); setShowMore(false); }} className="flex items-center gap-4 w-full px-6 py-4">
                    <Settings className="h-5 w-5 text-white/70" /><span className="text-white text-[15px]">Privacy settings</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setShowMore(false); setShowBlockConfirm(true); }}
                    className="flex items-center gap-4 w-full px-6 py-4"
                  >
                    <span className="text-red-400 text-[15px]">Block @{profile?.username}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMore(false);
                      setReportReason("");
                      setReportDetails("");
                      setReportError("");
                      setShowReport(true);
                    }}
                    className="flex items-center gap-4 w-full px-6 py-4"
                  >
                    <span className="text-red-400 text-[15px]">Report</span>
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit profile sheet */}
      <AnimatePresence>
        {showEdit && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 z-50" onClick={() => setShowEdit(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 bg-[#111] rounded-t-2xl z-50 pb-8" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                <button onClick={() => setShowEdit(false)} className="text-white/60 text-[15px]">Cancel</button>
                <span className="text-white font-bold text-[16px]">Edit profile</span>
                <button
                  disabled={saving}
                  onClick={async () => {
                    const parsed = profileSchema.safeParse({ name: editName, username: editUsername, bio: editBio });
                    if (!parsed.success) {
                      const errs: any = {};
                      for (const issue of parsed.error.issues) errs[issue.path[0] as string] = issue.message;
                      setEditErrors(errs);
                      return;
                    }
                    setEditErrors({});
                    setSaving(true);
                    try {
                      const updated = await updateEtokProfileAsync(currentUserId, parsed.data);
                      if (updated) setProfile(updated);
                      toast.success("Profile updated!");
                      setShowEdit(false);
                    } catch (e: any) {
                      toast.error(e?.message ?? "Update failed");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="text-[#ff0050] font-bold text-[15px] disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save
                </button>
              </div>
              <div className="flex justify-center py-5">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-5xl overflow-hidden">
                    {profile?.avatar ? <img src={profile.avatar} alt="" className="w-full h-full object-cover" /> : "👤"}
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#ff0050] text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">Change</div>
                </div>
              </div>
              <div className="px-4 space-y-0 divide-y divide-white/10">
                {[
                  { key: "name", label: "Name", value: editName, setter: setEditName, placeholder: "Add name", maxLength: 50 },
                  { key: "username", label: "Username", value: editUsername, setter: setEditUsername, placeholder: "Add username", maxLength: 24 },
                  { key: "bio", label: "Bio", value: editBio, setter: setEditBio, placeholder: "Add bio", maxLength: 160 },
                ].map(field => (
                  <div key={field.label} className="py-3.5">
                    <div className="flex items-center gap-4">
                      <span className="text-white/50 text-[14px] w-20 flex-shrink-0">{field.label}</span>
                      <input
                        value={field.value}
                        onChange={e => { field.setter(e.target.value); if (editErrors[field.key]) setEditErrors(prev => ({ ...prev, [field.key]: undefined })); }}
                        placeholder={field.placeholder}
                        maxLength={field.maxLength}
                        disabled={saving}
                        className="flex-1 bg-transparent text-white text-[14px] outline-none placeholder:text-white/20 disabled:opacity-50"
                      />
                    </div>
                    {editErrors[field.key] && (
                      <p className="text-red-400 text-[12px] mt-1 ml-24">{editErrors[field.key]}</p>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Block confirmation */}
      <AlertDialog open={showBlockConfirm} onOpenChange={(o) => !blocking && setShowBlockConfirm(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block @{profile?.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              They won't be able to find your profile, videos, or messages on Etok. They won't be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={blocking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={blocking}
              onClick={async (e) => {
                e.preventDefault();
                setBlocking(true);
                try {
                  await blockUserAsync(currentUserId, resolvedId);
                  toast.success("User blocked");
                  setShowBlockConfirm(false);
                } catch (err: any) {
                  toast.error(err?.message ?? "Failed to block");
                } finally {
                  setBlocking(false);
                }
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              {blocking ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Blocking…</> : "Block"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report dialog */}
      <Dialog open={showReport} onOpenChange={(o) => !reporting && setShowReport(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report @{profile?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Reason</Label>
              <RadioGroup
                value={reportReason}
                onValueChange={(v) => { setReportReason(v); setReportError(""); }}
                disabled={reporting}
              >
                {REPORT_REASONS.map(r => (
                  <div key={r.value} className="flex items-center gap-2">
                    <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
                    <Label htmlFor={`reason-${r.value}`} className="text-sm font-normal">{r.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="report-details" className="text-sm font-medium mb-2 block">
                Additional details <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="report-details"
                value={reportDetails}
                onChange={(e) => { setReportDetails(e.target.value); setReportError(""); }}
                placeholder="Add any context that helps us review…"
                maxLength={500}
                rows={3}
                disabled={reporting}
              />
              <p className="text-xs text-muted-foreground mt-1">{reportDetails.length}/500</p>
            </div>
            {reportError && <p className="text-red-500 text-xs">{reportError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowReport(false)} disabled={reporting}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={reporting}
              onClick={async () => {
                const parsed = reportSchema.safeParse({ reason: reportReason, details: reportDetails });
                if (!parsed.success) {
                  setReportError(parsed.error.issues[0]?.message ?? "Invalid input");
                  return;
                }
                if (!confirm(`Submit report for @${profile?.username}?`)) return;
                setReporting(true);
                try {
                  const reasonLabel = REPORT_REASONS.find(r => r.value === parsed.data.reason)?.label ?? parsed.data.reason;
                  const fullReason = parsed.data.details ? `${reasonLabel}: ${parsed.data.details}` : reasonLabel;
                  await reportContentAsync(currentUserId, "user", resolvedId, fullReason);
                  toast.success("Report submitted. Thank you.");
                  setShowReport(false);
                } catch (err: any) {
                  toast.error(err?.message ?? "Failed to submit report");
                } finally {
                  setReporting(false);
                }
              }}
            >
              {reporting ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Submitting…</> : "Submit report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EtokBottomNav />
    </div>
  );
};

export default EtokProfile;
