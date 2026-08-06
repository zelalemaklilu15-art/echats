// @ts-nocheck
import { useState, useEffect } from "react";
import { ArrowLeft, MessageSquare, Phone, Video, BellOff, Bell, MoreVertical, Loader2, QrCode, FileIcon, UserX, StickyNote, Cake, Gift, Star, BadgeCheck, Search, Copy, Link2, Flag, ShieldOff } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { reportContentAsync } from "@/lib/etokPrivacyService";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCall } from "@/contexts/CallContext";
import { formatLastSeen, isUserOnline } from "@/lib/formatLastSeen";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isUserBlocked, blockUser, unblockUser as unblockUserService } from "@/lib/blockService";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getContactNote, saveContactNote } from "@/lib/contactNotesService";
import { getVerification, getBadgeConfig } from "@/lib/verificationService";
import { getProfileMusic } from "@/lib/profileMusicService";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { GiftPicker } from "@/components/chat/GiftPicker";
import { sendGift, getStarsBalance, refreshStarsBalance } from "@/lib/giftsService";

interface ProfileData {
  id: string;
  name: string | null;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  phone_number: string | null;
  is_online: boolean | null;
  last_seen: string | null;
  email: string | null;
  birthday?: string | null;
}

interface SharedMedia {
  id: string;
  media_url: string | null;
  message_type: string | null;
  created_at: string | null;
}

const ContactProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { startCall } = useCall();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState<"media" | "files" | "notes">("media");
  const [sharedMedia, setSharedMedia] = useState<SharedMedia[]>([]);
  const [sharedFiles, setSharedFiles] = useState<{id: string; file_name: string | null; media_url: string | null; created_at: string | null}[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);


  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [starsBalance, setStarsBalance] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setSharedMedia([]);
    setSharedFiles([]);
    setChatId(null);
    setIsBlocked(isUserBlocked(userId));
    setNote(getContactNote(userId));
    refreshStarsBalance().then(setStarsBalance).catch(() => setStarsBalance(getStarsBalance()));
    loadProfile();
    loadChatId();
  }, [userId]);

  const loadProfile = async () => {
    if (!userId) return;
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.rpc("get_public_profile", { profile_id: userId });

    if (error) {
      setProfile(null);
      setLoadError(error.message || "Failed to load profile");
    } else {
      const row = Array.isArray(data) ? data[0] : data;
      setProfile((row as ProfileData) || null);
    }
    setLoading(false);
  };

  const loadChatId = async () => {
    if (!userId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("chats")
      .select("id")
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${userId}),and(participant_1.eq.${userId},participant_2.eq.${user.id})`)
      .maybeSingle();


    if (data) {
      setChatId(data.id);
      loadSharedMedia(data.id);
      loadSharedFiles(data.id);
    }
  };

  const loadSharedMedia = async (cId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("id, media_url, message_type, created_at")
      .eq("chat_id", cId)
      .in("message_type", ["image", "video"])
      .not("media_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setSharedMedia(data as SharedMedia[]);
  };

  const loadSharedFiles = async (cId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("id, file_name, media_url, created_at")
      .eq("chat_id", cId)
      .eq("message_type", "file")
      .not("media_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setSharedFiles(data);
  };

  useEffect(() => {
    if (chatId) {
      try {
        const mutedChats = JSON.parse(localStorage.getItem("echat_muted_chats") || "[]");
        setIsMuted(mutedChats.includes(chatId));
      } catch {}
    }
  }, [chatId]);

  const handleToggleMute = () => {
    if (!chatId) return;
    try {
      const mutedChats = JSON.parse(localStorage.getItem("echat_muted_chats") || "[]") as string[];
      let updated: string[];
      if (mutedChats.includes(chatId)) {
        updated = mutedChats.filter((id: string) => id !== chatId);
        setIsMuted(false);
        toast.success("Chat unmuted");
      } else {
        updated = [...mutedChats, chatId];
        setIsMuted(true);
        toast.success("Chat muted");
      }
      localStorage.setItem("echat_muted_chats", JSON.stringify(updated));
    } catch {}
  };

  const handleMessage = () => {
    if (chatId) navigate(`/chat/${chatId}`);
    else navigate("/new-message");
  };

  const handleCall = (type: "voice" | "video") => {
    if (!userId || !profile) return;
    startCall(userId, profile.name || "User", type, profile.avatar_url || undefined);
  };

  const handleBlockToggle = () => {
    if (!userId) return;
    if (isBlocked) {
      unblockUserService(userId);
      setIsBlocked(false);
      toast.success(`${profile?.name || profile?.username || "User"} unblocked`);
    } else {
      setShowBlockDialog(true);
    }
  };

  const confirmBlock = () => {
    if (!userId) return;
    blockUser(userId);
    setIsBlocked(true);
    setShowBlockDialog(false);
    toast.success(`${profile?.name || profile?.username || "User"} blocked`);
  };

  const handleSaveNote = () => {
    if (!userId) return;
    setSavingNote(true);
    saveContactNote(userId, note);
    setSavingNote(false);
    toast.success("Note saved");
  };

  const handleSendGift = async (giftId: string, message?: string) => {
    if (!currentUser || !userId || !chatId) {
      toast.error("Open a chat first to send a gift");
      return;
    }
    const result = await sendGift(giftId, currentUser.id, userId, chatId, message);
    if (result) {
      toast.success("Gift sent! 🎁");
      setStarsBalance(getStarsBalance());
    } else {
      toast.error("Not enough Stars or gift not found");
    }
  };

  const runFromMenu = (fn: () => void) => {
    setShowMenu(false);
    setTimeout(fn, 160);
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const handleSearchInChat = () => {
    if (chatId) navigate(`/chat/${chatId}?search=1`);
    else toast.error("No chat with this user yet");
  };

  const handleSubmitReport = async () => {
    if (!currentUser || !userId) return;
    setReporting(true);
    try {
      const reason = reportDetails.trim() ? `${reportReason}: ${reportDetails.trim()}` : reportReason;
      await reportContentAsync(currentUser.id, "user", userId, reason);
      toast.success("Report submitted. Thank you.");
      setShowReportDialog(false);
      setReportDetails("");
      setReportReason("spam");
    } catch {
      toast.error("Couldn't submit report");
    } finally {
      setReporting(false);
    }
  };



  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-foreground font-medium">Couldn't load this profile</p>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <div className="flex gap-2">
          <Button onClick={loadProfile}>Retry</Button>
          <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">User not found</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }


  const displayName = profile.name || profile.username;
  const effectiveOnline = isUserOnline(profile.last_seen, profile.is_online || false);
  const lastSeenText = formatLastSeen(profile.last_seen, effectiveOnline);
  const verification = getVerification(userId || "");
  const music = getProfileMusic(userId || "");

  const birthdayFormatted = profile.birthday
    ? (() => {
        try {
          const d = new Date(profile.birthday!);
          return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
        } catch { return null; }
      })()
    : null;

  const todayIsBirthday = (() => {
    if (!profile.birthday) return false;
    try {
      const d = new Date(profile.birthday);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    } catch { return false; }
  })();

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <div className="flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="button-back-contact-profile">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGiftPicker(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-600 text-xs font-semibold hover:bg-yellow-500/20 transition-colors"
              data-testid="button-send-gift"
            >
              <Star className="h-3 w-3" />
              {starsBalance} · Gift
            </button>
            <Button variant="ghost" size="icon" data-testid="button-contact-menu" onClick={() => setShowMenu(true)}>
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center pt-6 pb-4 px-4">
          <div className="relative">
            <Avatar className="w-28 h-28 mb-4">
              <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
              <AvatarFallback className="text-4xl bg-primary/20 text-primary">
                {displayName.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {todayIsBirthday && (
              <div className="absolute -top-2 -right-2 text-2xl animate-bounce">🎂</div>
            )}
          </div>

          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-foreground" data-testid="text-contact-name">{displayName}</h2>
            {verification && (
              <BadgeCheck className={`h-5 w-5 ${getBadgeConfig(verification.badge).color}`} />
            )}
          </div>

          {verification && (
            <Badge variant="outline" className={`${getBadgeConfig(verification.badge).color} text-xs mb-1`}>
              {getBadgeConfig(verification.badge).icon} {getBadgeConfig(verification.badge).label}
            </Badge>
          )}

          <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-contact-status">
            {lastSeenText || "offline"}
          </p>

          {todayIsBirthday && (
            <div className="mt-2 px-3 py-1.5 rounded-full bg-pink-500/10 text-pink-500 text-sm font-semibold flex items-center gap-1.5">
              <Cake className="h-4 w-4" />
              🎉 Today is {displayName}'s birthday!
            </div>
          )}

          {music?.enabled && (
            <div className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs max-w-[240px]">
              <span className="text-xs">🎵</span>
              <span className="truncate">{music.title} {music.artist && `— ${music.artist}`}</span>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-3 px-6 pb-6 flex-wrap">
          {[
            { label: "Message", icon: MessageSquare, action: handleMessage },
            { label: isMuted ? "Unmute" : "Mute", icon: isMuted ? Bell : BellOff, action: handleToggleMute },
            { label: "Call", icon: Phone, action: () => handleCall("voice") },
            { label: "Video", icon: Video, action: () => handleCall("video") },
            { label: isBlocked ? "Unblock" : "Block", icon: UserX, action: handleBlockToggle, destructive: !isBlocked || isBlocked },
          ].map(({ label, icon: Icon, action, destructive }) => (
            <button
              key={label}
              onClick={action}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors min-w-[64px]",
                label === "Block" && !isBlocked ? "bg-muted/50 hover:bg-muted" :
                label === "Unblock" ? "bg-destructive/10 hover:bg-destructive/20" :
                "bg-muted/50 hover:bg-muted"
              )}
              data-testid={`button-contact-${label.toLowerCase()}`}
            >
              <Icon className={cn("h-5 w-5", (label === "Block" && !isBlocked) || label === "Unblock" ? "text-destructive" : "text-muted-foreground")} />
              <span className={cn("text-xs", (label === "Block" && !isBlocked) || label === "Unblock" ? "text-destructive" : "text-muted-foreground")}>{label}</span>
            </button>
          ))}
        </div>

        <div className="px-4 pb-4 space-y-1">
          {profile.phone_number && (
            <div className="py-3 px-1">
              <p className="text-sm font-medium text-foreground">{profile.phone_number}</p>
              <p className="text-xs text-muted-foreground">Mobile</p>
            </div>
          )}
          {profile.bio && (
            <div className="py-3 px-1">
              <p className="text-sm text-foreground">{profile.bio}</p>
              <p className="text-xs text-muted-foreground">Bio</p>
            </div>
          )}
          <div className="py-3 px-1 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">@{profile.username}</p>
              <p className="text-xs text-muted-foreground">Username</p>
            </div>
            <QrCode className="h-5 w-5 text-muted-foreground" />
          </div>
          {birthdayFormatted && (
            <div className="py-3 px-1 flex items-center gap-2">
              <Cake className="h-4 w-4 text-pink-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{birthdayFormatted}</p>
                <p className="text-xs text-muted-foreground">Birthday</p>
              </div>
              {todayIsBirthday && <span className="text-lg ml-1">🎂</span>}
            </div>
          )}
        </div>

        <div className="border-t border-border">
          <div className="flex overflow-x-auto">
            {(["media", "files", "notes"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 capitalize min-w-[80px]",
                  activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                )}
                data-testid={`tab-${tab}`}
              >
                {tab === "notes" ? (
                  <span className="flex items-center justify-center gap-1">
                    <StickyNote className="h-3.5 w-3.5" />
                    Notes
                  </span>
                ) : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === "media" && (
            <div className="grid grid-cols-3 gap-0.5 p-0.5">
              {sharedMedia.length > 0 ? (
                sharedMedia.map((item) => (
                  <div
                    key={item.id}
                    className="aspect-square bg-muted relative overflow-hidden cursor-pointer"
                    onClick={() => item.media_url && window.open(item.media_url, "_blank")}
                    data-testid={`media-item-${item.id}`}
                  >
                    <img src={item.media_url || ""} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))
              ) : (
                <div className="col-span-3 py-12 text-center">
                  <p className="text-sm text-muted-foreground">No shared media yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "files" && (
            <div className="px-4 py-2">
              {sharedFiles.length > 0 ? (
                sharedFiles.map((file) => (
                  <a
                    key={file.id}
                    href={file.media_url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors rounded-md px-2"
                    data-testid={`file-item-${file.id}`}
                  >
                    <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.file_name || "File"}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.created_at ? new Date(file.created_at).toLocaleDateString() : ""}
                      </p>
                    </div>
                  </a>
                ))
              ) : (
                <div className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No shared files yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "notes" && (
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
                <StickyNote className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
                <p>Private notes about {displayName}. Only you can see these.</p>
              </div>
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={`Add a private note about ${displayName}...`}
                rows={5}
                className="resize-none"
              />
              <Button onClick={handleSaveNote} disabled={savingNote} className="w-full">
                {savingNote ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Note
              </Button>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to block {profile?.name || profile?.username}? They won't be able to message you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBlock} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={showMenu} onOpenChange={setShowMenu}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0 pb-[calc(env(safe-area-inset-bottom)+12px)] max-h-[85vh] overflow-y-auto">
          <SheetHeader className="px-5 pb-2 text-left">
            <SheetTitle className="text-base">{profile?.name || `@${profile?.username}`}</SheetTitle>
          </SheetHeader>
          <div className="px-3 space-y-1">
            {[
              { label: "Message", icon: MessageSquare, action: handleMessage, testid: "menu-message" },
              { label: "Voice call", icon: Phone, action: () => handleCall("voice"), testid: "menu-voice" },
              { label: "Video call", icon: Video, action: () => handleCall("video"), testid: "menu-video" },
              { label: isMuted ? "Unmute notifications" : "Mute notifications", icon: isMuted ? Bell : BellOff, action: handleToggleMute, testid: "menu-mute" },
              { label: "Send a gift", icon: Gift, action: () => setShowGiftPicker(true), testid: "menu-gift" },
              { label: "Search in chat", icon: Search, action: handleSearchInChat, testid: "menu-search" },
              { label: "Copy username", icon: Copy, action: () => handleCopy(`@${profile?.username}`, "Username"), testid: "menu-copy-username" },
              { label: "Copy profile link", icon: Link2, action: () => handleCopy(`${window.location.origin}/profile/${userId}`, "Profile link"), testid: "menu-copy-link" },
              { label: "Share via QR", icon: QrCode, action: () => navigate(`/wallet-qr?user=${userId}`), testid: "menu-qr" },
            ].map(({ label, icon: Icon, action, testid }) => (
              <button
                key={label}
                onClick={() => runFromMenu(action)}
                data-testid={testid}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left hover:bg-muted/70 active:scale-[0.99] transition-all"
              >
                <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-[15px] text-foreground">{label}</span>
              </button>
            ))}

            <div className="my-2 h-px bg-border mx-4" />

            <button
              onClick={() => runFromMenu(() => setShowReportDialog(true))}
              data-testid="menu-report"
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left hover:bg-destructive/10 active:scale-[0.99] transition-all"
            >
              <Flag className="h-5 w-5 text-destructive shrink-0" />
              <span className="text-[15px] text-destructive">Report user</span>
            </button>
            <button
              onClick={() => runFromMenu(handleBlockToggle)}
              data-testid="menu-block"
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left hover:bg-destructive/10 active:scale-[0.99] transition-all"
            >
              {isBlocked ? <ShieldOff className="h-5 w-5 text-destructive shrink-0" /> : <UserX className="h-5 w-5 text-destructive shrink-0" />}
              <span className="text-[15px] text-destructive">{isBlocked ? "Unblock user" : "Block user"}</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Report user</DialogTitle>
            <DialogDescription>Tell us what's wrong. Reports are reviewed confidentially.</DialogDescription>
          </DialogHeader>
          <RadioGroup value={reportReason} onValueChange={setReportReason} className="gap-2">
            {[
              { value: "spam", label: "Spam or scam" },
              { value: "harassment", label: "Harassment or bullying" },
              { value: "abuse", label: "Abusive or hateful content" },
              { value: "impersonation", label: "Impersonation / fake account" },
              { value: "other", label: "Something else" },
            ].map(({ value, label }) => (
              <div key={value} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                <RadioGroupItem value={value} id={`report-${value}`} />
                <Label htmlFor={`report-${value}`} className="text-sm font-normal cursor-pointer flex-1">{label}</Label>
              </div>
            ))}
          </RadioGroup>
          <Textarea
            value={reportDetails}
            onChange={e => setReportDetails(e.target.value)}
            placeholder="Add details (optional)"
            maxLength={500}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportDialog(false)} disabled={reporting}>Cancel</Button>
            <Button onClick={handleSubmitReport} disabled={reporting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {reporting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <GiftPicker
        open={showGiftPicker}
        onClose={() => setShowGiftPicker(false)}
        onSend={handleSendGift}
      />
    </div>
  );
};

export default ContactProfile;
