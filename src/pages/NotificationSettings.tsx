import { useState } from "react";
import { ArrowLeft, Bell, BellOff, Volume2, VolumeX, Vibrate, MessageSquare, Users, Phone, Check, Zap, X, Plus } from "lucide-react";
import { isSmartNotifEnabled, setSmartNotifEnabled, getKeywords, setKeywords } from "@/lib/smartNotifService";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PRESET_SOUNDS, playSound } from "@/lib/notificationSoundService";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const SETTINGS_KEY = "echat_notification_settings";

interface NotificationSettingsData {
  messageNotifications: boolean;
  messagePreview: boolean;
  messageSoundId: string;
  vibrate: boolean;
  groupNotifications: boolean;
  groupSoundId: string;
  callNotifications: boolean;
  ringtoneSoundId: string;
}

function getDefaults(): NotificationSettingsData {
  return { messageNotifications: true, messagePreview: true, messageSoundId: "default", vibrate: true, groupNotifications: true, groupSoundId: "default", callNotifications: true, ringtoneSoundId: "default" };
}

function loadSettings(): NotificationSettingsData {
  try { const s = localStorage.getItem(SETTINGS_KEY); if (s) return { ...getDefaults(), ...JSON.parse(s) }; } catch {}
  return getDefaults();
}

function saveSettings(s: NotificationSettingsData) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

const SectionTitle = ({ label }: { label: string }) => (
  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-2 mt-5">{label}</p>
);

const SettingRow = ({
  icon: Icon, iconBg, label, sub, right, testId, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>; iconBg: string; label: string; sub?: string;
  right?: React.ReactNode; testId?: string; onClick?: () => void;
}) => (
  <motion.button
    whileTap={{ scale: 0.99 }}
    onClick={onClick}
    className="flex items-center w-full px-4 py-3.5 hover:bg-muted/40 transition-colors text-left"
    data-testid={testId}
  >
    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mr-3.5", iconBg)}>
      <Icon className="h-[17px] w-[17px] text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[14px] font-semibold leading-tight">{label}</p>
      {sub && <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
    {right !== undefined && <div className="ml-3 flex-shrink-0">{right}</div>}
  </motion.button>
);

const Divider = () => <div className="h-px bg-border/50 mx-4" />;

const SoundSheet = ({
  open, onClose, selected, onSelect, title,
}: { open: boolean; onClose: () => void; selected: string; onSelect: (id: string) => void; title: string }) => (
  <AnimatePresence>
    {open && (
      <div className="fixed inset-0 z-50 flex items-end">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative w-full bg-card rounded-t-3xl border-t border-border/50 px-5 pt-5 pb-10">
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
          <h2 className="font-bold text-[17px] mb-4">{title}</h2>
          <div className="space-y-2">
            {PRESET_SOUNDS.map(s => (
              <motion.button key={s.id} whileTap={{ scale: 0.98 }}
                onClick={() => { playSound(s); onSelect(s.id); onClose(); toast.success(`Sound: ${s.name}`); }}
                className={cn("w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-colors border",
                  selected === s.id ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/50 border-transparent")}
              >
                <span className="font-semibold text-[14px]">{s.name}</span>
                {selected === s.id && <Check className="h-4 w-4 text-primary" />}
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

const NotificationSettings = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<NotificationSettingsData>(loadSettings);
  const [showMessageSound, setShowMessageSound] = useState(false);
  const [showGroupSound, setShowGroupSound]     = useState(false);
  const [showRingtone, setShowRingtone]         = useState(false);
  const [smartEnabled, setSmartEnabled]         = useState(isSmartNotifEnabled);
  const [keywords, setKw]                       = useState<string[]>(getKeywords);
  const [newKw, setNewKw]                       = useState("");

  const {
    isSupported: pushSupported,
    isSubscribed: pushSubscribed,
    isLoading: pushLoading,
    registrationStage: pushStage,
    registrationError: pushError,
    requestPermission: enablePush,
    unsubscribe: disablePush,
  } = usePushNotifications();

  const update = (partial: Partial<NotificationSettingsData>) => {
    setSettings(prev => { const next = { ...prev, ...partial }; saveSettings(next); return next; });
  };

  const getSoundName = (id: string) => PRESET_SOUNDS.find(s => s.id === id)?.name || "Default";

  const addKeyword = () => {
    if (!newKw.trim()) return;
    const updated = [...keywords, newKw.trim().toLowerCase()];
    setKw(updated); setKeywords(updated); setNewKw("");
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate("/settings")} className="w-9 h-9 rounded-full bg-card border border-border/50 flex items-center justify-center" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-bold text-[17px]">Notifications</h1>
        </div>
      </div>

      <div className="px-4 pb-6">
        {/* Messages */}
        <SectionTitle label="Messages" />
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
          <SettingRow icon={settings.messageNotifications ? Bell : BellOff} iconBg="bg-blue-500" label="Message Notifications"
            sub="Get notified for new messages" testId="switch-message-notifications"
            right={<Switch checked={settings.messageNotifications} onCheckedChange={v => update({ messageNotifications: v })} />} />
          <SettingRow icon={MessageSquare} iconBg="bg-sky-500" label="Message Preview"
            sub="Show content in notification" testId="switch-message-preview"
            right={<Switch checked={settings.messagePreview} onCheckedChange={v => update({ messagePreview: v })} />} />
          <SettingRow icon={Volume2} iconBg="bg-orange-500" label="Message Sound"
            sub={getSoundName(settings.messageSoundId)} testId="button-message-sound"
            onClick={() => setShowMessageSound(true)}
            right={<span className="text-[12px] text-primary font-semibold">{getSoundName(settings.messageSoundId)}</span>} />
          <SettingRow icon={Vibrate} iconBg="bg-violet-500" label="Vibrate"
            sub="Vibrate on new messages" testId="switch-vibrate"
            right={<Switch checked={settings.vibrate} onCheckedChange={v => update({ vibrate: v })} />} />
        </div>

        {/* Groups */}
        <SectionTitle label="Groups" />
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
          <SettingRow icon={Users} iconBg="bg-emerald-500" label="Group Notifications"
            sub="Notifications for group messages" testId="switch-group-notifications"
            right={<Switch checked={settings.groupNotifications} onCheckedChange={v => update({ groupNotifications: v })} />} />
          <SettingRow icon={Volume2} iconBg="bg-teal-500" label="Group Sound"
            sub={getSoundName(settings.groupSoundId)} testId="button-group-sound"
            onClick={() => setShowGroupSound(true)}
            right={<span className="text-[12px] text-primary font-semibold">{getSoundName(settings.groupSoundId)}</span>} />
        </div>

        {/* Calls */}
        <SectionTitle label="Calls" />
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
          {pushSupported && (
            <>
              <SettingRow icon={pushSubscribed ? Bell : BellOff} iconBg="bg-red-500" label="Call Notifications"
                sub={pushError ? `Stage: ${pushStage ?? "initialization"} — Error: ${pushError}` : pushLoading ? `Connecting: ${pushStage ?? "initialization"}` : "Get notified for incoming calls"} testId="switch-call-notifications"
                right={<Switch checked={pushSubscribed} disabled={pushLoading} onCheckedChange={c => c ? enablePush() : disablePush()} />} />
              <Divider />
            </>
          )}
          <SettingRow icon={Phone} iconBg="bg-rose-500" label="Ringtone"
            sub={getSoundName(settings.ringtoneSoundId)} testId="button-ringtone"
            onClick={() => setShowRingtone(true)}
            right={<span className="text-[12px] text-primary font-semibold">{getSoundName(settings.ringtoneSoundId)}</span>} />
        </div>

        {/* Smart Filter */}
        <SectionTitle label="Smart Notification Filter" />
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
          <SettingRow icon={Zap} iconBg="bg-amber-500" label="Smart Filter"
            sub="Only notify for important messages" testId="switch-smart-notif"
            right={<Switch checked={smartEnabled} onCheckedChange={v => { setSmartEnabled(v); setSmartNotifEnabled(v); toast.success(v ? "Smart filter on" : "Smart filter off"); }} />} />

          <AnimatePresence>
            {smartEnabled && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-4 py-3.5">
                  <p className="text-[12px] text-muted-foreground mb-2.5">Keyword triggers (tap to remove)</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {keywords.map(kw => (
                      <motion.button key={kw} whileTap={{ scale: 0.94 }}
                        onClick={() => { const u = keywords.filter(k => k !== kw); setKw(u); setKeywords(u); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[12px] font-semibold border border-primary/20"
                        data-testid={`keyword-chip-${kw}`}
                      >
                        {kw} <X className="h-3 w-3" />
                      </motion.button>
                    ))}
                    {keywords.length === 0 && <p className="text-[12px] text-muted-foreground/60 italic">No keywords yet</p>}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newKw} onChange={e => setNewKw(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addKeyword()}
                      placeholder="Add keyword…"
                      className="flex-1 bg-muted rounded-2xl px-3.5 py-2.5 text-[13px] outline-none border border-border/50 focus:border-primary/50"
                      data-testid="input-add-keyword"
                    />
                    <motion.button whileTap={{ scale: 0.9 }} onClick={addKeyword}
                      className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-sm shadow-primary/20"
                      data-testid="button-add-keyword">
                      <Plus className="h-4 w-4 text-primary-foreground" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <SoundSheet open={showMessageSound} onClose={() => setShowMessageSound(false)} selected={settings.messageSoundId} onSelect={id => update({ messageSoundId: id })} title="Message Sound" />
      <SoundSheet open={showGroupSound}   onClose={() => setShowGroupSound(false)}   selected={settings.groupSoundId}   onSelect={id => update({ groupSoundId: id })}   title="Group Sound" />
      <SoundSheet open={showRingtone}     onClose={() => setShowRingtone(false)}     selected={settings.ringtoneSoundId} onSelect={id => update({ ringtoneSoundId: id })} title="Ringtone" />
    </div>
  );
};

export default NotificationSettings;
