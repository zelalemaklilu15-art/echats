// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Phone, MessageSquare, MoreVertical, Images, Edit2, Camera, Loader2, QrCode, Share2, Music, Play, Pause, Cake, BadgeCheck, Gift, Star, Plus, Trash2 } from "lucide-react";
import { getMyStatus, setMyStatus, STATUS_CONFIG, type AvailabilityStatus } from "@/lib/availabilityService";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChatAvatar } from "@/components/ui/chat-avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { getProfile, updateProfile, Profile as ProfileType } from "@/lib/supabaseService";
import { isUsernameUnique } from "@/lib/supabaseAuth";
import { getSessionUserSafe } from "@/lib/authSession";
import { QRCodeSVG } from "qrcode.react";
import { getProfileMusic, setProfileMusic, removeProfileMusic, toggleProfileMusic } from "@/lib/profileMusicService";
import { getVerification, getBadgeConfig } from "@/lib/verificationService";
import { getStarsBalance, refreshStarsBalance } from "@/lib/giftsService";
import { Switch } from "@/components/ui/switch";
import {
  getHighlights,
  createHighlight,
  deleteHighlight,
  PRESET_HIGHLIGHT_COLORS,
  type StoryHighlight,
} from "@/lib/storyHighlightService";

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [myStatus, setMyStatusState] = useState<AvailabilityStatus>(getMyStatus());

  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editBirthday, setEditBirthday] = useState("");

  const [showMusicDialog, setShowMusicDialog] = useState(false);
  const [musicTitle, setMusicTitle] = useState("");
  const [musicArtist, setMusicArtist] = useState("");
  const [musicUrl, setMusicUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [starsBalance, setStarsBalance] = useState(0);
  const [highlights, setHighlights] = useState<StoryHighlight[]>([]);
  const [showHighlightDialog, setShowHighlightDialog] = useState(false);
  const [newHighlightName, setNewHighlightName] = useState("");
  const [selectedHighlightColor, setSelectedHighlightColor] = useState(PRESET_HIGHLIGHT_COLORS[0]);

  useEffect(() => {
    loadProfile();
    refreshStarsBalance().then(setStarsBalance).catch(() => setStarsBalance(getStarsBalance()));
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const { user } = await getSessionUserSafe();
    if (user) {
      setCurrentUserId(user.id);
      const userProfile = await getProfile(user.id);
      if (userProfile) {
        setProfile(userProfile);
        setEditName(userProfile.name || "");
        setEditUsername(userProfile.username || "");
        setEditBio(userProfile.bio || "");
        setEditAvatarUrl(userProfile.avatar_url || "");
        setEditBirthday((userProfile as any).birthday || "");
      }
    }
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!currentUserId) { toast.error("Not authenticated"); return; }
    if (!editName.trim()) { toast.error("Name cannot be empty"); return; }
    if (!editUsername.trim()) { toast.error("Username cannot be empty"); return; }
    if (editUsername.trim().length < 3) { toast.error("Username must be at least 3 characters"); return; }

    setSaving(true);
    try {
      const normalizedUsername = editUsername.toLowerCase().trim().replace(/\s/g, '');
      if (normalizedUsername !== profile?.username) {
        const isUnique = await isUsernameUnique(normalizedUsername);
        if (!isUnique) { toast.error("Username already taken."); setSaving(false); return; }
      }
      const updatedProfile = await updateProfile(currentUserId, {
        name: editName.trim(),
        username: normalizedUsername,
        bio: editBio.trim(),
        avatar_url: editAvatarUrl.trim(),
      });
      if (updatedProfile) setProfile(updatedProfile);
      setEditDialogOpen(false);
      toast.success("Profile updated!");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (currentUserId) {
      setHighlights(getHighlights(currentUserId));
    }
  }, [currentUserId]);

  const handleCreateHighlight = () => {
    if (!newHighlightName.trim() || !currentUserId) return;
    createHighlight(currentUserId, newHighlightName.trim(), selectedHighlightColor, []);
    setHighlights(getHighlights(currentUserId));
    setNewHighlightName("");
    setShowHighlightDialog(false);
  };

  const handleDeleteHighlight = (id: string) => {
    deleteHighlight(id);
    if (currentUserId) setHighlights(getHighlights(currentUserId));
  };

  const music = currentUserId ? getProfileMusic(currentUserId) : null;
  const verification = currentUserId ? getVerification(currentUserId) : null;

  const handlePlayMusic = () => {
    if (!music?.audioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(music.audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => toast.error("Could not play audio"));
      setIsPlaying(true);
    }
  };

  const handleSaveMusic = () => {
    if (!currentUserId) return;
    if (!musicTitle.trim()) return toast.error("Enter a title");
    if (!musicUrl.trim()) return toast.error("Enter an audio URL");
    setProfileMusic({ userId: currentUserId, title: musicTitle, artist: musicArtist, audioUrl: musicUrl, enabled: true });
    toast.success("Music added to profile!");
    setShowMusicDialog(false);
  };

  const handleRemoveMusic = () => {
    if (!currentUserId) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setIsPlaying(false);
    removeProfileMusic(currentUserId);
    toast.success("Music removed");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayName = profile?.name || "User";
  const displayUsername = profile?.username || "user";
  const displayEmail = profile?.email || "";
  const displayBio = profile?.bio || "Welcome to Echat! 🚀";
  const displayAvatar = profile?.avatar_url || "";

  return (
    <div className="min-h-screen bg-background pb-24">
      <div
        className="sticky top-0 z-20"
        style={{
          background: "hsl(var(--background) / 0.97)",
          backdropFilter: "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
          borderBottom: "1px solid hsl(var(--border) / 0.4)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/chats")} className="p-2 -ml-2 rounded-xl hover:bg-muted/60 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-black text-[18px] gradient-text">Profile</h1>
          </div>
          <button onClick={() => navigate("/settings")} className="p-2.5 rounded-xl hover:bg-muted/60 transition-colors">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative">
        {/* Animated gradient hero banner */}
        <div className="h-56 relative overflow-hidden">
          <motion.div
            className="absolute inset-0"
            animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            style={{
              background: "linear-gradient(135deg, hsl(338 90% 55%), hsl(280 80% 60%), hsl(210 90% 60%), hsl(260 85% 55%))",
              backgroundSize: "300% 300%",
            }}
          />
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(circle at 25% 40%, rgba(255,255,255,0.4) 0%, transparent 45%), radial-gradient(circle at 75% 70%, rgba(255,255,255,0.25) 0%, transparent 40%)" }} />
          {/* Floating orbs */}
          <motion.div
            className="absolute w-32 h-32 rounded-full"
            style={{ background: "rgba(255,255,255,0.08)", top: "-20px", right: "-20px" }}
            animate={{ y: [0, -12, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-20 h-20 rounded-full"
            style={{ background: "rgba(255,255,255,0.06)", bottom: "10px", left: "30px" }}
            animate={{ y: [0, 10, 0], scale: [1, 0.95, 1] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          <div className="absolute bottom-0 left-0 right-0 h-16" style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }} />
        </div>

        <div className="absolute -bottom-14 left-1/2 transform -translate-x-1/2">
          <div className="relative">
            <motion.div
              className="absolute inset-0 rounded-full blur-xl"
              style={{ background: "var(--gradient-primary)", opacity: 0.5, transform: "scale(1.2)" }}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            {displayAvatar ? (
              <Avatar className="relative w-28 h-28 shadow-2xl" style={{ boxShadow: "0 0 0 4px hsl(var(--background)), 0 8px 40px hsl(338 90% 67% / 0.4)" }}>
                <AvatarImage src={displayAvatar} alt={displayName} className="object-cover" />
                <AvatarFallback className="text-3xl font-black" style={{ background: "var(--gradient-primary)", color: "white" }}>
                  {displayName.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="relative w-28 h-28 rounded-full flex items-center justify-center" style={{ background: "var(--gradient-primary)", boxShadow: "0 0 0 4px hsl(var(--background)), 0 8px 40px hsl(338 90% 67% / 0.4)" }}>
                <span className="text-3xl font-black text-white">{displayName.slice(0, 1).toUpperCase()}</span>
              </div>
            )}

            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button size="icon" className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-primary hover:bg-primary/90 border-2 border-background shadow-lg">
                  <Edit2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit Profile</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex justify-center">
                    <div className="relative">
                      {editAvatarUrl ? (
                        <Avatar className="w-24 h-24">
                          <AvatarImage src={editAvatarUrl} alt="Preview" />
                          <AvatarFallback className="text-2xl bg-primary/20 text-primary">
                            {editName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                          <Camera className="h-8 w-8 text-primary" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Profile Photo URL</Label>
                    <Input placeholder="https://example.com/photo.jpg" value={editAvatarUrl} onChange={(e) => setEditAvatarUrl(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input placeholder="Your name" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={50} />
                  </div>
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <div className="flex items-center">
                      <span className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-l-lg border border-r-0 border-border h-10 flex items-center">@</span>
                      <Input placeholder="username" value={editUsername} onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} className="rounded-l-none" maxLength={30} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Bio</Label>
                    <Textarea placeholder="Tell us about yourself..." value={editBio} onChange={(e) => setEditBio(e.target.value)} maxLength={150} rows={3} />
                    <p className="text-xs text-muted-foreground text-right">{editBio.length}/150</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Cake className="h-3.5 w-3.5 text-pink-500" />
                      Birthday
                    </Label>
                    <Input type="date" value={editBirthday} onChange={e => setEditBirthday(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Your birthday is shown to your contacts</p>
                  </div>
                  <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
                    {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="pt-16 pb-6 text-center space-y-2 px-4">
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-2xl font-bold text-foreground">{displayName}</h2>
          {verification && (
            <BadgeCheck className={`h-6 w-6 ${getBadgeConfig(verification.badge).color}`} />
          )}
        </div>
        {verification && (
          <Badge variant="outline" className={`${getBadgeConfig(verification.badge).color} text-xs`}>
            {getBadgeConfig(verification.badge).icon} {getBadgeConfig(verification.badge).label}
          </Badge>
        )}
        <p className="text-muted-foreground font-medium">@{displayUsername}</p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">{displayBio}</p>

        {music?.enabled && (
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-primary/10 text-primary text-sm max-w-xs">
              <Music className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{music.title} {music.artist && `— ${music.artist}`}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handlePlayMusic}>
                {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 mt-1">
          <button
            onClick={() => navigate("/gifts")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-600 text-sm font-semibold hover:bg-yellow-500/20 transition-colors"
          >
            <Star className="h-3.5 w-3.5" />
            {starsBalance} Stars
          </button>
        </div>
      </div>

      <div className="px-4 pb-6">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => navigate("/chats")}
            className="h-12 rounded-2xl font-bold text-[13px] text-white flex items-center justify-center gap-2 shadow-primary"
            style={{ background: "var(--gradient-primary)" }}
            data-testid="button-profile-chats"
          >
            <MessageSquare className="h-4 w-4" />Chats
          </button>
          <button
            onClick={() => navigate("/calls")}
            className="h-12 rounded-2xl font-bold text-[13px] border-2 border-border text-foreground bg-card hover:bg-muted transition-colors flex items-center justify-center gap-2"
            data-testid="button-profile-call"
          >
            <Phone className="h-4 w-4" />Call
          </button>
          <Dialog>
            <DialogTrigger asChild>
              <button className="h-12 rounded-2xl font-bold text-[13px] border-2 border-border text-foreground bg-card hover:bg-muted transition-colors flex items-center justify-center gap-2" data-testid="button-profile-qr">
                <QrCode className="h-4 w-4" />QR
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xs">
              <DialogHeader>
                <DialogTitle className="text-center">My QR Code</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center space-y-4 py-4">
                <div className="p-4 bg-white rounded-2xl">
                  <QRCodeSVG value={`${window.location.origin}?add=@${displayUsername}`} size={200} fgColor="#000000" bgColor="#ffffff" level="M" includeMargin={false} />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Scan to add <span className="text-primary font-semibold">@{displayUsername}</span>
                </p>
                <Button variant="outline" className="w-full" onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}?add=@${displayUsername}`).then(() => toast.success("Link copied!"));
                }}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Story Highlights */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">Highlights</p>
          <button
            onClick={() => setShowHighlightDialog(true)}
            className="text-xs text-primary font-semibold"
            data-testid="button-add-highlight"
          >
            + New
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
          {/* Add New Button */}
          <button
            onClick={() => setShowHighlightDialog(true)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0"
            data-testid="button-add-highlight-circle"
          >
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-border/60 flex items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <span className="text-[11px] text-muted-foreground font-medium max-w-[64px] text-center truncate">New</span>
          </button>

          {/* Highlight Circles */}
          {highlights.map((h) => (
            <div
              key={h.id}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 relative group"
            >
              <button
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-lg font-bold ring-2 ring-border/30 shadow-md"
                style={{ background: h.coverColor }}
                data-testid={`highlight-${h.id}`}
              >
                {h.name.slice(0, 1).toUpperCase()}
              </button>
              <span className="text-[11px] text-foreground font-medium max-w-[64px] text-center truncate">{h.name}</span>
              <button
                onClick={() => handleDeleteHighlight(h.id)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`button-delete-highlight-${h.id}`}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add Highlight Dialog */}
      <Dialog open={showHighlightDialog} onOpenChange={setShowHighlightDialog}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>New Highlight</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Travel, Friends, Work…"
                value={newHighlightName}
                onChange={(e) => setNewHighlightName(e.target.value)}
                maxLength={20}
                data-testid="input-highlight-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Cover Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_HIGHLIGHT_COLORS.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedHighlightColor(color)}
                    className="w-8 h-8 rounded-full transition-transform"
                    style={{
                      background: color,
                      transform: selectedHighlightColor === color ? "scale(1.2)" : "scale(1)",
                      outline: selectedHighlightColor === color ? "2px solid white" : "none",
                      outlineOffset: "2px",
                    }}
                    data-testid={`color-option-${i}`}
                  />
                ))}
              </div>
              <div
                className="w-full h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                style={{ background: selectedHighlightColor }}
              >
                {newHighlightName || "Preview"}
              </div>
            </div>
            <Button
              onClick={handleCreateHighlight}
              disabled={!newHighlightName.trim()}
              className="w-full"
              data-testid="button-create-highlight"
            >
              Create Highlight
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="px-4 space-y-3 pb-6">
        {/* Info Card */}
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <h3 className="font-bold text-[15px]">Info</h3>
            <button onClick={() => setEditDialogOpen(true)} className="flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:underline">
              <Edit2 className="h-3.5 w-3.5" />Edit
            </button>
          </div>
          <div className="divide-y divide-border/40">
            {[
              { label: "Email",    value: displayEmail },
              { label: "Username", value: `@${displayUsername}` },
              { label: "Bio",      value: displayBio },
              ...(editBirthday ? [{ label: "🎂 Birthday", value: new Date(editBirthday).toLocaleDateString("en-US", { month: "long", day: "numeric" }) }] : []),
              { label: "Status", value: `${STATUS_CONFIG[myStatus].label}`, className: STATUS_CONFIG[myStatus].color },
            ].map(({ label, value, className }) => (
              <div key={label} className="flex items-center justify-between px-5 py-3.5">
                <span className="text-[13px] text-muted-foreground flex-shrink-0">{label}</span>
                <span className={`text-[13px] font-semibold text-right max-w-[55%] truncate ml-4 ${className || "text-foreground"}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status Selector Card */}
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50">
            <h3 className="font-bold text-[15px]">Availability</h3>
          </div>
          <div className="grid grid-cols-4 gap-3 px-5 py-4">
            {(Object.entries(STATUS_CONFIG) as [AvailabilityStatus, typeof STATUS_CONFIG[AvailabilityStatus]][]).map(([key, cfg]) => (
              <button key={key} onClick={async () => {
                await setMyStatus(key);
                setMyStatusState(key);
                toast.success(`Status: ${cfg.label}`);
              }}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${myStatus === key ? "border-primary bg-primary/10" : "border-border/40 bg-muted/30"}`}
                data-testid={`status-${key}`}
              >
                <div className={`w-4 h-4 rounded-full ${cfg.dot}`} />
                <span className="text-[11px] font-semibold text-foreground">{cfg.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Music Card */}
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <h3 className="font-bold text-[15px] flex items-center gap-2">
              <Music className="h-4 w-4 text-primary" />Profile Music
            </h3>
            {music ? (
              <div className="flex items-center gap-2">
                <Switch checked={music.enabled} onCheckedChange={() => { if (currentUserId) toggleProfileMusic(currentUserId); }} />
                <button onClick={handleRemoveMusic} className="text-[11px] font-semibold text-red-400 hover:underline">Remove</button>
              </div>
            ) : (
              <button onClick={() => setShowMusicDialog(true)} className="text-[12px] font-bold text-primary hover:underline">Add Music</button>
            )}
          </div>
          {music ? (
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Music className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[13px] truncate">{music.title}</p>
                {music.artist && <p className="text-[12px] text-muted-foreground">{music.artist}</p>}
              </div>
              <button onClick={handlePlayMusic} className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground px-5 py-4">Add a song to your profile to share your vibe.</p>
          )}
        </div>

        {/* Media Card */}
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <h3 className="font-bold text-[15px]">Shared Media</h3>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[1, 2, 3].map(i => <div key={i} className="aspect-square bg-muted rounded-xl hover:bg-muted/70 transition-colors cursor-pointer" />)}
            </div>
            <button onClick={() => navigate("/saved-messages")} className="w-full text-[13px] font-semibold text-primary hover:underline flex items-center justify-center gap-1.5 py-1">
              <Images className="h-4 w-4" />View all media
            </button>
          </div>
        </div>
      </div>

      <Dialog open={showMusicDialog} onOpenChange={setShowMusicDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              Add Profile Music
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Song Title</Label>
              <Input value={musicTitle} onChange={e => setMusicTitle(e.target.value)} placeholder="e.g. Blinding Lights" className="mt-1" />
            </div>
            <div>
              <Label>Artist</Label>
              <Input value={musicArtist} onChange={e => setMusicArtist(e.target.value)} placeholder="e.g. The Weeknd" className="mt-1" />
            </div>
            <div>
              <Label>Audio URL</Label>
              <Input value={musicUrl} onChange={e => setMusicUrl(e.target.value)} placeholder="https://example.com/song.mp3" className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Link to an MP3 or audio file</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowMusicDialog(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSaveMusic}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
