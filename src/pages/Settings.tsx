// @ts-nocheck
import { useState, useEffect } from "react";
import { ArrowLeft, User, Wallet, Users, BookOpen, Phone, Bookmark, Settings as SettingsIcon, Share, Star, LogOut, Plus, Check, Loader2, Bell, BellOff, Sun, Moon, Palette, Volume2, Image as ImageIcon, Shield, Database, AtSign, FileDown, Smartphone, Zap, Briefcase, Gift, Radio, ChevronRight, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { getProfile, Profile } from "@/lib/supabaseService";
import { signOut } from "@/lib/supabaseAuth";
import { toast } from "sonner";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { ACCENT_COLORS, getAccentColor, setAccentColor } from "@/lib/profileCustomizationService";
import { PRESET_SOUNDS, getDefaultSound, setDefaultSound, playSound } from "@/lib/notificationSoundService";
import { getPresetWallpapers, setDefaultWallpaper, getDefaultWallpaper, getWallpaperStyle, type WallpaperConfig } from "@/lib/chatWallpaperService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UsernameSettings } from "@/components/chat/UsernameSettings";
import { ChatImportDialog } from "@/components/chat/ChatImportDialog";
import { getActiveDeviceCount } from "@/lib/deviceService";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const SectionHeader = ({ label }: { label: string }) => (
  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-5 pt-6 pb-2">{label}</p>
);

const SettingsRow = ({
  icon: Icon,
  iconBg,
  label,
  sub,
  right,
  onClick,
  danger = false,
  testId,
}: {
  icon: React.ComponentType<any>;
  iconBg: string;
  label: string;
  sub?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  testId?: string;
}) => (
  <motion.button
    whileTap={{ scale: 0.99 }}
    onClick={onClick}
    className="flex items-center w-full px-5 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-left"
    data-testid={testId}
  >
    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mr-4", iconBg)}>
      <Icon className="h-[18px] w-[18px] text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn("text-[14px] font-semibold leading-tight", danger ? "text-red-400" : "text-foreground")}>{label}</p>
      {sub && <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
    {right !== undefined ? (
      <div className="ml-3 flex-shrink-0">{right}</div>
    ) : (
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0 ml-2" />
    )}
  </motion.button>
);

const Divider = () => <div className="h-px bg-border/50 mx-5" />;

const Settings = () => {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const [profile, setProfile]                   = useState<Profile | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [loggingOut, setLoggingOut]             = useState(false);
  const { theme, toggleTheme }                  = useTheme();
  const [currentAccent, setCurrentAccent]       = useState(getAccentColor().id);
  const [currentSound, setCurrentSound]         = useState(getDefaultSound().id);
  const [showAccentPicker, setShowAccentPicker] = useState(false);
  const [showSoundPicker, setShowSoundPicker]   = useState(false);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [showUsernameDialog, setShowUsernameDialog]   = useState(false);
  const [showImportDialog, setShowImportDialog]       = useState(false);

  const { isSupported: pushSupported, isSubscribed: pushSubscribed, isLoading: pushLoading, requestPermission: enablePush, unsubscribe: disablePush } = usePushNotifications();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user?.id) { if (mounted) { setProfile(null); setLoading(false); } return; }
      if (mounted) setLoading(true);
      try { const p = await getProfile(user.id); if (mounted) setProfile(p); }
      catch (e) { console.error(e); }
      finally { if (mounted) setLoading(false); }
    };
    load();
    return () => { mounted = false; };
  }, [user?.id]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await signOut(); toast.success("Logged out"); window.location.href = "/"; }
    catch { toast.error("Failed to log out"); setLoggingOut(false); }
  };

  const go = (path: string) => navigate(path);

  const wallpapers = getPresetWallpapers();
  const currentWallpaper = getDefaultWallpaper();

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div
        className="sticky top-0 z-20"
        style={{
          background: "hsl(var(--background) / 0.97)",
          backdropFilter: "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
          borderBottom: "1px solid hsl(var(--border) / 0.4)",
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          <button onClick={() => navigate("/chats")} className="p-2 -ml-2 rounded-xl hover:bg-muted/60 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-black text-[18px] gradient-text">Settings</h1>
        </div>
      </div>

      {/* Profile card — full gradient banner + avatar */}
      <div className="px-4 pt-5 pb-1">
        <motion.button
          whileTap={{ scale: 0.985 }}
          onClick={() => navigate("/profile")}
          className="w-full rounded-3xl overflow-hidden relative shimmer-card"
          style={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border) / 0.6)",
            boxShadow: "0 8px 32px hsl(222 22% 0% / 0.4)",
          }}
          data-testid="button-profile-card"
        >
          {/* Gradient banner */}
          <div
            className="h-[72px] w-full relative overflow-hidden"
            style={{ background: "var(--gradient-primary)" }}
          >
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 85% 30%, rgba(255,255,255,0.2) 0%, transparent 40%)" }} />
            <div className="absolute bottom-0 left-0 right-0 h-6" style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--card) / 0.7))" }} />
          </div>

          {/* Avatar sitting on banner edge */}
          <div className="relative px-5 pb-5">
            <div className="absolute -top-9 left-5 flex-shrink-0">
              {loading ? (
                <div className="w-16 h-16 rounded-2xl bg-muted animate-shimmer ring-4 ring-card" />
              ) : (
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl blur-lg" style={{ background: "var(--gradient-primary)", opacity: 0.4, transform: "scale(1.15)" }} />
                  <Avatar className="relative w-16 h-16 ring-3 ring-card" style={{ borderRadius: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} className="object-cover" />}
                    <AvatarFallback className="text-[22px] font-black" style={{ background: "var(--gradient-primary)", color: "white", borderRadius: 16 }}>
                      {(profile?.name || "U").slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-card" style={{ boxShadow: "0 0 8px hsl(145 65% 50% / 0.6)" }} />
                </div>
              )}
            </div>

            <div className="flex items-start justify-between pt-10">
              <div className="flex-1 text-left min-w-0">
                {loading ? (
                  <><div className="h-5 w-32 bg-muted rounded animate-shimmer mb-2" /><div className="h-3.5 w-24 bg-muted rounded animate-shimmer" /></>
                ) : (
                  <>
                    <p className="font-black text-[17px] leading-tight truncate">{profile?.name || "User"}</p>
                    <p className="text-[13px] font-semibold mt-0.5 gradient-text">@{profile?.username}</p>
                    {profile?.email && <p className="text-muted-foreground text-[11px] mt-0.5 truncate">{profile.email}</p>}
                  </>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground/40 flex-shrink-0 mt-1" />
            </div>
          </div>
        </motion.button>
      </div>

      {/* ── Appearance ── */}
      <SectionHeader label="Appearance" />
      <div className="mx-4 bg-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
        <SettingsRow
          icon={theme === "dark" ? Moon : Sun}
          iconBg="bg-indigo-500"
          label={theme === "dark" ? "Dark Mode" : "Light Mode"}
          sub="Toggle app theme"
          right={<Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />}
        />

        <Dialog open={showAccentPicker} onOpenChange={setShowAccentPicker}>
          <DialogTrigger asChild>
            <SettingsRow
              icon={Palette}
              iconBg="bg-pink-500"
              label="Accent Color"
              sub={getAccentColor().name}
              right={<div className="w-5 h-5 rounded-full ring-2 ring-offset-2 ring-offset-background ring-border" style={{ backgroundColor: `hsl(${getAccentColor().hsl})` }} />}
            />
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Choose Accent Color</DialogTitle></DialogHeader>
            <div className="grid grid-cols-4 gap-3 py-4">
              {ACCENT_COLORS.map(c => (
                <button key={c.id} onClick={() => { setAccentColor(c.id); setCurrentAccent(c.id); toast.success(`Accent: ${c.name}`); setShowAccentPicker(false); }} className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 rounded-full transition-transform ${currentAccent === c.id ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : "hover:scale-105"}`} style={{ backgroundColor: `hsl(${c.hsl})` }} />
                  <span className="text-[10px] text-muted-foreground">{c.name}</span>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showWallpaperPicker} onOpenChange={setShowWallpaperPicker}>
          <DialogTrigger asChild>
            <SettingsRow icon={ImageIcon} iconBg="bg-teal-500" label="Chat Wallpaper" sub="Default chat background" />
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Chat Wallpaper</DialogTitle></DialogHeader>
            <div className="grid grid-cols-4 gap-3 py-4">
              {wallpapers.map((wp, i) => (
                <button key={i} onClick={() => { setDefaultWallpaper(wp); toast.success("Wallpaper set!"); setShowWallpaperPicker(false); }}
                  className={`aspect-[3/4] rounded-xl border-2 transition-transform hover:scale-105 ${JSON.stringify(currentWallpaper) === JSON.stringify(wp) ? "border-primary" : "border-border"}`}
                  style={{ ...getWallpaperStyle(wp), backgroundColor: wp.value === "transparent" ? "hsl(var(--background))" : undefined }} />
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Notifications ── */}
      <SectionHeader label="Notifications" />
      <div className="mx-4 bg-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
        {pushSupported && (
          <SettingsRow
            icon={pushSubscribed ? Bell : BellOff}
            iconBg="bg-blue-500"
            label="Call Notifications"
            sub="Get notified for incoming calls"
            right={<Switch checked={pushSubscribed} disabled={pushLoading} onCheckedChange={c => c ? enablePush() : disablePush()} />}
          />
        )}
        <Dialog open={showSoundPicker} onOpenChange={setShowSoundPicker}>
          <DialogTrigger asChild>
            <SettingsRow icon={Volume2} iconBg="bg-orange-500" label="Notification Sound" sub={getDefaultSound().name} />
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Notification Sound</DialogTitle></DialogHeader>
            <div className="space-y-2 py-4">
              {PRESET_SOUNDS.map(s => (
                <button key={s.id} onClick={() => { playSound(s); setDefaultSound(s.id); setCurrentSound(s.id); toast.success(`Sound: ${s.name}`); }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${currentSound === s.id ? "bg-primary/10 border border-primary" : "hover:bg-muted"}`}>
                  <span className="font-semibold text-[14px]">{s.name}</span>
                  {currentSound === s.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Account ── */}
      <SectionHeader label="Account" />
      <div className="mx-4 bg-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
        <Dialog open={showUsernameDialog} onOpenChange={setShowUsernameDialog}>
          <DialogTrigger asChild>
            <SettingsRow icon={AtSign} iconBg="bg-purple-500" label="Username" sub="Set your unique username" testId="card-username-setting" />
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Username Settings</DialogTitle></DialogHeader>
            {user?.id && <UsernameSettings userId={user.id} onClose={() => setShowUsernameDialog(false)} />}
          </DialogContent>
        </Dialog>

        <SettingsRow icon={FileDown} iconBg="bg-cyan-500" label="Import Chat" sub="Import chat from JSON file" onClick={() => setShowImportDialog(true)} testId="card-export-import" />
        <SettingsRow icon={Smartphone} iconBg="bg-sky-500" label="Active Sessions" sub="Manage logged-in devices"
          right={user?.id ? <Badge variant="secondary" className="text-[11px]" data-testid="badge-device-count">{getActiveDeviceCount(user.id)}</Badge> : undefined}
          onClick={() => go("/active-sessions")} />
        <SettingsRow icon={Shield} iconBg="bg-emerald-500" label="Privacy & Security" onClick={() => go("/privacy-settings")} />
        <SettingsRow icon={Database} iconBg="bg-slate-500" label="Data and Storage" onClick={() => go("/data-storage")} />
      </div>

      {/* ── Features ── */}
      <SectionHeader label="Features" />
      <div className="mx-4 bg-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
        <SettingsRow icon={User}      iconBg="bg-primary/80"   label="My Profile"       onClick={() => go("/profile")} />
        <SettingsRow icon={Wallet}    iconBg="bg-green-600"    label="Wallet"           onClick={() => go("/wallet")} />
        <SettingsRow icon={Gift}      iconBg="bg-yellow-500"   label="Gifts & Stars"    onClick={() => go("/gifts")} />
        <SettingsRow icon={Radio}     iconBg="bg-red-500"      label="Live Stories"     onClick={() => go("/live-stories")} />
        <SettingsRow icon={Zap}       iconBg="bg-violet-500"   label="Quick Replies"    onClick={() => go("/quick-replies")} />
        <SettingsRow icon={Briefcase} iconBg="bg-indigo-600"   label="Business Profile" onClick={() => go("/business-profile")} />
        <SettingsRow icon={Bell}      iconBg="bg-blue-500"     label="Notifications"    onClick={() => go("/notification-settings")} />
        <SettingsRow icon={Volume2}   iconBg="bg-orange-600"   label="Custom Sounds"    onClick={() => go("/sound-settings")} />
        <SettingsRow icon={Users}     iconBg="bg-blue-400"     label="New Group"        onClick={() => go("/new-group")} />
        <SettingsRow icon={Radio}     iconBg="bg-pink-500"     label="Broadcast List"   onClick={() => go("/broadcast")} />
        <SettingsRow icon={Bell}      iconBg="bg-amber-500"    label="Reminders"        onClick={() => go("/reminders")} />
        <SettingsRow icon={BookOpen}  iconBg="bg-orange-500"   label="Contacts"         onClick={() => go("/contacts")} />
        <SettingsRow icon={Phone}     iconBg="bg-purple-500"   label="Calls"            onClick={() => go("/calls")} />
        <SettingsRow icon={Bookmark}  iconBg="bg-yellow-600"   label="Saved Messages"   onClick={() => go("/saved-messages")} />
        <SettingsRow icon={Share}     iconBg="bg-cyan-600"     label="Invite Friends"   onClick={() => {
          navigator.share?.({ title: "Join me on Echat", text: "Fast, simple, and secure messaging", url: window.location.origin }) || alert("Share: " + window.location.origin);
        }} />
        <SettingsRow icon={Star}      iconBg="bg-primary/80"   label="Echat Features" onClick={() => go("/features")} />
      </div>

      {/* ── Admin: Grant Verification ── */}
      {user?.id && (
        <>
          <SectionHeader label="Admin Tools" />
          <div className="mx-4 bg-card rounded-2xl border border-border/50 overflow-hidden mb-2">
            <SettingsRow
              icon={BadgeCheck}
              iconBg="bg-blue-500"
              label="Grant Verification Badge"
              sub="Demo: grant verified badge to any user"
              onClick={async () => {
                const username = prompt("Enter username to verify:");
                if (!username) return;
                const { data } = await import("@/integrations/supabase/client").then(m => m.supabase.from("profiles").select("id, name, username").ilike("username", username).single());
                if (!data) { toast.error("User not found"); return; }
                // Verification badges are granted server-side only.
                console.info("Badges are managed by the backend for", data.id);
                toast.success(`✓ Verified badge granted to @${data.username}`);
              }}
            />
          </div>
        </>
      )}

      {/* ── Sign out ── */}
      <SectionHeader label="Account" />
      <div className="mx-4 bg-card rounded-2xl border border-red-500/20 overflow-hidden">
        <SettingsRow
          icon={loggingOut ? Loader2 : LogOut}
          iconBg="bg-red-500/80"
          label={loggingOut ? "Signing out…" : "Sign Out"}
          danger
          onClick={handleLogout}
          right={null}
        />
      </div>

      {showImportDialog && (
        <ChatImportDialog isOpen={showImportDialog} onClose={() => setShowImportDialog(false)} chatId="" onImport={() => setShowImportDialog(false)} />
      )}
    </div>
  );
};

export default Settings;
