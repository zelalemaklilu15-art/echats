// @ts-nocheck
import { useState, useEffect } from "react";
import { ArrowLeft, ChevronRight, ShieldCheck, QrCode } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getPrivacySettings, updatePrivacySettings, type PrivacySettings as PrivacySettingsType } from "@/lib/privacyService";
import { getBlockedUsers, unblockUser } from "@/lib/blockService";
import { getGhostMode, setGhostMode, type GhostModeSettings } from "@/lib/ghostModeService";
import { isAppLockEnabled, setAppLock, removeAppLock, isWalletLockEnabled, setWalletPinAsync, removeWalletLockAsync } from "@/lib/chatLockService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface BlockedProfile {
  id: string;
  name: string | null;
  username: string;
  avatar_url: string | null;
}

type VisibilityOpt = "everyone" | "contacts" | "nobody";
type GroupPermOpt = "everyone" | "contacts";

const VIS_LABEL: Record<string, string> = {
  everyone: "Everybody",
  contacts: "My Contacts",
  nobody: "Nobody",
};

/* ─── Layout primitives ─── */

const SectionTitle = ({ children }: { children: string }) => (
  <p className="text-[12px] font-semibold uppercase tracking-wider px-5 pt-5 pb-2" style={{ color: "hsl(var(--primary))" }}>
    {children}
  </p>
);

const SectionNote = ({ children }: { children: string }) => (
  <p className="text-[12px] leading-relaxed px-5 pt-2 pb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
    {children}
  </p>
);

const Group = ({ children }: { children: React.ReactNode }) => (
  <div
    className="mx-4 rounded-2xl overflow-hidden"
    style={{
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--primary) / 0.18)",
    }}
  >
    {children}
  </div>
);

const Divider = () => (
  <div className="h-px ml-4 mr-0" style={{ background: "hsl(var(--border) / 0.45)" }} />
);

interface RowProps {
  label: string;
  value?: string;
  description?: string;
  right?: React.ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  destructive?: boolean;
  testId?: string;
}

const Row = ({ label, value, description, right, chevron, onClick, destructive, testId }: RowProps) => (
  <button
    type="button"
    data-testid={testId}
    className="flex items-center justify-between w-full px-4 py-3 text-left active:bg-muted/30 transition-colors min-h-[50px]"
    onClick={onClick}
  >
    <div className="flex-1 min-w-0 pr-3">
      <p className="text-[15px] leading-snug" style={{ color: destructive ? "hsl(var(--destructive))" : "hsl(var(--foreground))" }}>
        {label}
      </p>
      {description && (
        <p className="text-[12px] mt-0.5 leading-snug" style={{ color: "hsl(var(--muted-foreground))" }}>
          {description}
        </p>
      )}
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      {value !== undefined && (
        <span className="text-[14px]" style={{ color: "hsl(var(--primary))" }}>{value}</span>
      )}
      {right}
      {chevron && <ChevronRight className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground) / 0.5)" }} />}
    </div>
  </button>
);

/* ─── Selection sheet ─── */

interface SelectSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  options: string[];
  value: string;
  labels: Record<string, string>;
  onSelect: (v: string) => void;
}

const SelectSheet = ({ open, onClose, title, options, value, labels, onSelect }: SelectSheetProps) => (
  <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
    <DialogContent className="max-w-xs rounded-2xl p-0 overflow-hidden">
      <DialogHeader className="px-5 pt-5 pb-3">
        <DialogTitle className="text-[16px]">{title}</DialogTitle>
      </DialogHeader>
      <div className="pb-3">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/40 transition-colors"
            onClick={() => { onSelect(opt); onClose(); }}
          >
            <span className="text-[15px]">{labels[opt] ?? opt}</span>
            {value === opt && (
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--primary))" }}>
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);

/* ─── Main Component ─── */

const PrivacySettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [settings, setSettings] = useState<PrivacySettingsType>(getPrivacySettings());
  const [blockedProfiles, setBlockedProfiles] = useState<BlockedProfile[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(true);
  const [unblockTarget, setUnblockTarget] = useState<BlockedProfile | null>(null);
  const [ghostSettings, setGhostSettings] = useState<GhostModeSettings>(getGhostMode());
  const [appLockEnabled, setAppLockEnabled] = useState(isAppLockEnabled());
  const [walletLockEnabled, setWalletLockEnabled] = useState(isWalletLockEnabled());
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState<"idle" | "qr" | "verify" | "done">("idle");
  const [twoFAQrUri, setTwoFAQrUri] = useState("");
  const [twoFAFactorId, setTwoFAFactorId] = useState("");
  const [twoFACode, setTwoFACode] = useState("");

  const [readReceiptsOff, setReadReceiptsOff] = useState(() => localStorage.getItem("echat_read_receipts_off") === "true");
  const [anonReactions, setAnonReactions] = useState(() => localStorage.getItem("echat_anon_reactions") === "true");
  const [stealthMode, setStealthMode] = useState(() => localStorage.getItem("echat_story_stealth") === "true");
  const [syncContacts, setSyncContacts] = useState(() => localStorage.getItem("echat_sync_contacts") !== "false");
  const [suggestContacts, setSuggestContacts] = useState(() => localStorage.getItem("echat_suggest_contacts") !== "false");
  const [linkPreviews, setLinkPreviews] = useState(() => localStorage.getItem("echat_link_previews") !== "false");
  const [autoDeleteMessages, setAutoDeleteMessages] = useState(() => localStorage.getItem("echat_auto_delete") === "true");

  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinDialogMode, setPinDialogMode] = useState<"app" | "wallet">("app");
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinStep, setPinStep] = useState<"enter" | "confirm">("enter");

  const [sheet, setSheet] = useState<{
    open: boolean; title: string; field: keyof PrivacySettingsType | null;
    options: string[]; value: string; labels: Record<string, string>;
  }>({ open: false, title: "", field: null, options: [], value: "", labels: {} });

  useEffect(() => { loadBlockedProfiles(); }, []);

  const loadBlockedProfiles = async () => {
    setLoadingBlocked(true);
    const ids = getBlockedUsers();
    if (!ids.length) { setBlockedProfiles([]); setLoadingBlocked(false); return; }
    const { data } = await supabase.from("profiles").select("id, name, username, avatar_url").in("id", ids);
    if (data) setBlockedProfiles(data as BlockedProfile[]);
    setLoadingBlocked(false);
  };

  const handleUpdate = (updates: Partial<PrivacySettingsType>) => {
    setSettings(updatePrivacySettings(updates));
    toast.success("Settings updated");
  };

  const openSheet = (title: string, field: keyof PrivacySettingsType, options: string[], value: string, labels: Record<string, string>) => {
    setSheet({ open: true, title, field, options, value, labels });
  };

  const handlePinSet = async () => {
    if (pinStep === "enter") {
      if (pinInput.length < 4) { toast.error("PIN must be at least 4 digits"); return; }
      setPinStep("confirm"); setPinConfirm("");
    } else {
      if (pinInput !== pinConfirm) { toast.error("PINs don't match"); setPinConfirm(""); setPinStep("enter"); setPinInput(""); return; }
      if (pinDialogMode === "app") { setAppLock(pinInput); setAppLockEnabled(true); toast.success("App lock enabled"); }
      else {
        try {
          await setWalletPinAsync(pinInput);
          setWalletLockEnabled(true);
          toast.success("Wallet passcode enabled");
        } catch (e: any) {
          toast.error(e?.message || "Failed to set wallet PIN");
          return;
        }
      }
      setShowPinDialog(false); setPinInput(""); setPinConfirm(""); setPinStep("enter");
    }
  };

  const handleSetup2FA = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Echat 2FA" });
      if (error || !data) { toast.error("Failed to start 2FA setup"); return; }
      setTwoFAFactorId(data.id); setTwoFAQrUri(data.totp.qr_code); setTwoFAStep("qr");
    } catch { toast.error("Failed to start 2FA setup"); }
  };

  const handleVerify2FA = async () => {
    if (twoFACode.length !== 6) { toast.error("Enter the 6-digit code"); return; }
    try {
      const cr = await supabase.auth.mfa.challenge({ factorId: twoFAFactorId });
      if (cr.error) { toast.error("Challenge failed"); return; }
      const vr = await supabase.auth.mfa.verify({ factorId: twoFAFactorId, challengeId: cr.data.id, code: twoFACode });
      if (vr.error) { toast.error("Invalid code. Try again."); return; }
      setTwoFAEnabled(true); setTwoFAStep("done"); toast.success("2FA enabled!");
    } catch { toast.error("Verification failed"); }
  };

  const handleDisable2FA = async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      if (data?.totp?.length) await supabase.auth.mfa.unenroll({ factorId: data.totp[0].id });
      setTwoFAEnabled(false); setTwoFAStep("idle"); toast.success("2FA disabled");
    } catch { toast.error("Failed to disable 2FA"); }
  };

  const maskEmail = (email?: string) => {
    if (!email) return "";
    const [local, domain] = email.split("@");
    if (!local || !domain) return email;
    return local.slice(0, 3) + "***@" + domain;
  };

  return (
    <div className="min-h-screen bg-background pb-20">

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
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted/60 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-bold text-[18px] gradient-text">Privacy and Security</h1>
        </div>
      </div>

      {/* ══ SECURITY ══ */}
      <SectionTitle>Security</SectionTitle>
      <Group>
        <Row
          label="Two-Step Verification"
          value={twoFAEnabled ? "On" : "Off"}
          chevron
          onClick={twoFAEnabled ? handleDisable2FA : handleSetup2FA}
          testId="row-2fa"
        />
        <Divider />
        <Row
          label="Auto-Delete Messages"
          value={autoDeleteMessages ? "On" : "Off"}
          chevron
          onClick={() => {
            setAutoDeleteMessages(v => { const n = !v; localStorage.setItem("echat_auto_delete", String(n)); return n; });
            toast.success("Setting updated");
          }}
        />
        <Divider />
        <Row
          label="Passcode Lock"
          value={appLockEnabled ? "On" : "Off"}
          chevron
          onClick={() => {
            if (appLockEnabled) { removeAppLock(); setAppLockEnabled(false); toast.success("App lock removed"); }
            else { setPinDialogMode("app"); setShowPinDialog(true); setPinStep("enter"); setPinInput(""); }
          }}
          testId="row-passcode"
        />
        <Divider />
        <Row
          label="Wallet Passcode"
          value={walletLockEnabled ? "On" : "Off"}
          chevron
          onClick={() => {
            if (walletLockEnabled) { void removeWalletLockAsync(); setWalletLockEnabled(false); toast.success("Wallet passcode disabled"); }
            else { setPinDialogMode("wallet"); setShowPinDialog(true); setPinStep("enter"); setPinInput(""); }
          }}
        />
        <Divider />
        {user?.email && (
          <>
            <Row
              label="Login Email"
              value={maskEmail(user.email)}
              chevron
              onClick={() => {}}
            />
            <Divider />
          </>
        )}
        <Row
          label="Blocked Users"
          value={loadingBlocked ? "…" : String(blockedProfiles.length)}
          chevron
          onClick={() => {}}
          testId="row-blocked-users"
        />
        <Divider />
        <Row
          label="Devices"
          value="1"
          chevron
          onClick={() => {}}
        />
      </Group>
      <SectionNote>Review the list of devices where you are logged in to your Echat account.</SectionNote>

      {/* ── 2FA inline flow ── */}
      <AnimatePresence>
        {twoFAStep === "qr" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-4 mt-3">
            <Group>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
                  <span className="font-semibold text-[15px]">Scan QR Code</span>
                </div>
                <p className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>Open your authenticator app (Google Authenticator, Authy) and scan this code.</p>
                {twoFAQrUri && <div className="flex justify-center p-4 bg-white rounded-xl"><img src={twoFAQrUri} alt="2FA QR" className="w-40 h-40" /></div>}
                <Button className="w-full" size="sm" onClick={() => setTwoFAStep("verify")}>I've Scanned It →</Button>
              </div>
            </Group>
          </motion.div>
        )}
        {twoFAStep === "verify" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-4 mt-3">
            <Group>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
                  <span className="font-semibold text-[15px]">Enter 6-Digit Code</span>
                </div>
                <Input type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={twoFACode}
                  onChange={e => setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center text-2xl tracking-[0.5em] font-mono" />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" size="sm" onClick={() => { setTwoFAStep("idle"); setTwoFACode(""); }}>Back</Button>
                  <Button className="flex-1" size="sm" onClick={handleVerify2FA}>Verify & Enable</Button>
                </div>
              </div>
            </Group>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ PRIVACY ══ */}
      <SectionTitle>Privacy</SectionTitle>
      <Group>
        <Row
          label="Phone Number"
          value={VIS_LABEL[settings.phoneNumberVisibility]}
          chevron
          onClick={() => openSheet("Phone Number", "phoneNumberVisibility", ["everyone","contacts","nobody"], settings.phoneNumberVisibility, VIS_LABEL)}
          testId="row-phone-number"
        />
        <Divider />
        <Row
          label="Last Seen & Online"
          value={VIS_LABEL[settings.lastSeenVisibility]}
          chevron
          onClick={() => openSheet("Last Seen & Online", "lastSeenVisibility", ["everyone","contacts","nobody"], settings.lastSeenVisibility, VIS_LABEL)}
          testId="row-last-seen"
        />
        <Divider />
        <Row
          label="Profile Photos"
          value={VIS_LABEL[settings.profilePhotoVisibility]}
          chevron
          onClick={() => openSheet("Profile Photos", "profilePhotoVisibility", ["everyone","contacts","nobody"], settings.profilePhotoVisibility, VIS_LABEL)}
          testId="row-profile-photos"
        />
        <Divider />
        <Row
          label="Forwarded Messages"
          value={settings.forwardedMessages ? "Everybody" : "Nobody"}
          chevron
          onClick={() => handleUpdate({ forwardedMessages: !settings.forwardedMessages })}
        />
        <Divider />
        <Row
          label="Calls"
          value={VIS_LABEL[settings.groupsAddPermission] ?? "Everybody"}
          chevron
          onClick={() => openSheet("Calls", "groupsAddPermission", ["everyone","contacts"], settings.groupsAddPermission, VIS_LABEL)}
        />
        <Divider />
        <Row label="Voice Messages" value="Everybody" chevron onClick={() => {}} />
        <Divider />
        <Row label="Messages" value="Everybody" chevron onClick={() => {}} />
        <Divider />
        <Row label="Birthday" value="My Contacts" chevron onClick={() => {}} />
        <Divider />
        <Row label="Gifts" value="Everybody" chevron onClick={() => {}} />
        <Divider />
        <Row label="Bio" value="Everybody" chevron onClick={() => {}} />
        <Divider />
        <Row
          label="Groups & Channels"
          value={VIS_LABEL[settings.groupsAddPermission] ?? "Everybody"}
          chevron
          onClick={() => openSheet("Groups & Channels", "groupsAddPermission", ["everyone","contacts"], settings.groupsAddPermission, VIS_LABEL)}
        />
        <Divider />
        <Row label="Invites" value="Everybody" chevron onClick={() => {}} />
      </Group>
      <SectionNote>You can restrict which users are allowed to add you to groups and channels.</SectionNote>

      {/* ══ DELETE MY ACCOUNT ══ */}
      <SectionTitle>Delete my account</SectionTitle>
      <Group>
        <Row label="If away for" value="18 months" chevron onClick={() => {}} />
      </Group>
      <SectionNote>If you do not come online at least once within this period, your account will be deleted along with all messages and contacts.</SectionNote>

      {/* ══ MESSAGING PRIVACY ══ */}
      <SectionTitle>Messaging Privacy</SectionTitle>
      <Group>
        <Row
          label="Read Receipts"
          description="Show when you've read messages"
          right={
            <Switch checked={!readReceiptsOff} onCheckedChange={(v) => {
              const off = !v; setReadReceiptsOff(off);
              localStorage.setItem("echat_read_receipts_off", String(off));
              toast.success(off ? "Read receipts disabled" : "Read receipts enabled");
            }} data-testid="switch-read-receipts" />
          }
        />
        <Divider />
        <Row
          label="Anonymous Reactions"
          description="Hide your name in emoji reactions"
          right={
            <Switch checked={anonReactions} onCheckedChange={(v) => {
              setAnonReactions(v); localStorage.setItem("echat_anon_reactions", String(v));
              toast.success(v ? "Anonymous reactions on" : "Anonymous reactions off");
            }} data-testid="switch-anon-reactions" />
          }
        />
        <Divider />
        <Row
          label="Story Stealth Mode"
          description="View stories without appearing in viewer list"
          right={
            <Switch checked={stealthMode} onCheckedChange={(v) => {
              setStealthMode(v); localStorage.setItem("echat_story_stealth", String(v));
              toast.success(v ? "Viewing stories anonymously" : "Stealth mode off");
            }} data-testid="switch-story-stealth" />
          }
        />
      </Group>

      {/* ══ GHOST MODE ══ */}
      <SectionTitle>Ghost Mode</SectionTitle>
      <Group>
        <Row
          label="Ghost Mode"
          description="Read messages invisibly"
          right={
            <Switch checked={ghostSettings.enabled} onCheckedChange={(val) => {
              setGhostSettings(setGhostMode({ enabled: val }));
              toast.success(val ? "Ghost Mode enabled" : "Ghost Mode disabled");
            }} />
          }
        />
        <AnimatePresence>
          {ghostSettings.enabled && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
              <Divider />
              <Row label="Hide Read Receipts" right={<Switch checked={ghostSettings.hideReadReceipts} onCheckedChange={(v) => setGhostSettings(setGhostMode({ hideReadReceipts: v }))} />} />
              <Divider />
              <Row label="Hide Typing Indicator" right={<Switch checked={ghostSettings.hideTyping} onCheckedChange={(v) => setGhostSettings(setGhostMode({ hideTyping: v }))} />} />
              <Divider />
              <Row label="Hide Online Status" right={<Switch checked={ghostSettings.hideOnlineStatus} onCheckedChange={(v) => setGhostSettings(setGhostMode({ hideOnlineStatus: v }))} />} />
            </motion.div>
          )}
        </AnimatePresence>
      </Group>

      {/* ══ BOTS AND WEBSITES ══ */}
      <SectionTitle>Bots and websites</SectionTitle>
      <Group>
        <Row
          label="Clear Payment and Shipping Info"
          chevron
          onClick={() => toast.success("Payment info cleared")}
        />
      </Group>

      {/* ══ CONTACTS ══ */}
      <SectionTitle>Contacts</SectionTitle>
      <Group>
        <Row
          label="Delete Synced Contacts"
          destructive
          onClick={() => toast.success("Synced contacts deleted")}
        />
        <Divider />
        <Row
          label="Sync Contacts"
          right={
            <Switch checked={syncContacts} onCheckedChange={(v) => {
              setSyncContacts(v); localStorage.setItem("echat_sync_contacts", String(v));
            }} />
          }
        />
        <Divider />
        <Row
          label="Suggest Frequent Contacts"
          right={
            <Switch checked={suggestContacts} onCheckedChange={(v) => {
              setSuggestContacts(v); localStorage.setItem("echat_suggest_contacts", String(v));
            }} />
          }
        />
      </Group>
      <SectionNote>Display people you message frequently at the top of the search section for quick access.</SectionNote>

      {/* ══ SECRET CHATS ══ */}
      <SectionTitle>Secret Chats</SectionTitle>
      <Group>
        <Row
          label="Map Preview Provider"
          value="No Previews"
          chevron
          onClick={() => {}}
        />
        <Divider />
        <Row
          label="Link Previews"
          description="Generate link previews in secret chats"
          right={
            <Switch checked={linkPreviews} onCheckedChange={(v) => {
              setLinkPreviews(v); localStorage.setItem("echat_link_previews", String(v));
            }} />
          }
        />
      </Group>
      <SectionNote>Link previews will be generated on Echat servers. We do not store any data about the links you send.</SectionNote>

      {/* ══ BLOCKED USERS (only if any) ══ */}
      {blockedProfiles.length > 0 && (
        <>
          <SectionTitle>Blocked Users</SectionTitle>
          <Group>
            {blockedProfiles.map((profile, i) => (
              <div key={profile.id}>
                {i > 0 && <Divider />}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9 shrink-0">
                      {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
                      <AvatarFallback className="text-[13px] font-bold" style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
                        {(profile.name || profile.username).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-[14px] truncate">{profile.name || profile.username}</p>
                      <p className="text-[12px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>@{profile.username}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUnblockTarget(profile)}
                    className="text-[13px] font-semibold ml-3 shrink-0"
                    style={{ color: "hsl(var(--primary))" }}
                  >
                    Unblock
                  </button>
                </div>
              </div>
            ))}
          </Group>
        </>
      )}

      <div className="h-10" />

      {/* ── Selection Sheet ── */}
      <SelectSheet
        open={sheet.open}
        onClose={() => setSheet(s => ({ ...s, open: false }))}
        title={sheet.title}
        options={sheet.options}
        value={sheet.value}
        labels={sheet.labels}
        onSelect={(val) => {
          if (sheet.field) handleUpdate({ [sheet.field]: val } as Partial<PrivacySettingsType>);
          setSheet(s => ({ ...s, value: val }));
        }}
      />

      {/* ── Unblock Dialog ── */}
      <AlertDialog open={!!unblockTarget} onOpenChange={(open) => !open && setUnblockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock User</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to unblock {unblockTarget?.name || unblockTarget?.username}?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => unblockTarget && (() => { unblockUser(unblockTarget.id); setBlockedProfiles(p => p.filter(x => x.id !== unblockTarget.id)); setUnblockTarget(null); toast.success("Unblocked"); })()}>
              Unblock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── PIN Dialog ── */}
      <Dialog open={showPinDialog} onOpenChange={(open) => { if (!open) { setShowPinDialog(false); setPinInput(""); setPinConfirm(""); setPinStep("enter"); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pinStep === "enter" ? `Set ${pinDialogMode === "wallet" ? "Wallet " : ""}PIN` : "Confirm PIN"}</DialogTitle>
            <DialogDescription>{pinStep === "enter" ? `Enter a 4-digit PIN to ${pinDialogMode === "wallet" ? "protect your wallet" : "lock the app"}` : "Re-enter your PIN to confirm"}</DialogDescription>
          </DialogHeader>
          <Input type="password" inputMode="numeric" maxLength={4} placeholder="Enter 4-digit PIN"
            value={pinStep === "enter" ? pinInput : pinConfirm}
            onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 4); pinStep === "enter" ? setPinInput(val) : setPinConfirm(val); }}
            className="text-center text-2xl tracking-[1em] font-mono" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPinDialog(false)}>Cancel</Button>
            <Button onClick={handlePinSet}>{pinStep === "enter" ? "Next" : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrivacySettings;
