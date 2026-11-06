import { useState, useEffect } from "react";
import { ArrowLeft, Briefcase, Clock, MapPin, Phone, Globe, MessageSquare, Moon, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getBusinessProfile, saveBusinessProfile, isBusinessOpen, isAway, type BusinessProfile } from "@/lib/businessProfileService";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { PhoneInput } from "@/components/ui/phone-input";
import { defaultCountry, splitInternational, toInternational } from "@/lib/countries";

const BusinessPhone = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const init = splitInternational(value);
  const [country, setCountry] = useState(() => init.country ?? defaultCountry());
  const [local, setLocal] = useState(init.local);
  const emit = (c: typeof country, l: string) => onChange(l.trim() ? toInternational(c, l) ?? `${c.dial} ${l.trim()}` : "");
  return <PhoneInput country={country} value={local}
    onCountryChange={c => { setCountry(c); emit(c, local); }}
    onChange={l => { setLocal(l); emit(country, l); }} />;
};

const SectionTitle = ({ label }: { label: string }) => (
  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 mt-5">{label}</p>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">{children}</p>
);

const Input = ({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type}
    className="w-full bg-muted rounded-2xl px-4 py-3 text-[14px] outline-none border border-border/50 focus:border-primary/50 transition-colors placeholder:text-muted-foreground/60" />
);

const Textarea = ({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) => (
  <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    className="w-full bg-muted rounded-2xl px-4 py-3 text-[14px] outline-none resize-none border border-border/50 focus:border-primary/50 transition-colors placeholder:text-muted-foreground/60" />
);

const BusinessProfileSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

  useEffect(() => { if (user) setProfile(getBusinessProfile(user.id)); }, [user]);

  if (!profile) return null;

  const update = (changes: Partial<BusinessProfile>) => setProfile(prev => prev ? { ...prev, ...changes } : prev);

  const updateHours = (day: string, field: string, value: string | boolean) => {
    if (!profile) return;
    update({ hours: profile.hours.map(h => h.day === day ? { ...h, [field]: value } : h) });
  };

  const handleSave = () => {
    if (profile) { saveBusinessProfile(profile); toast.success("Business profile saved!"); }
  };

  const open = isBusinessOpen(profile);
  const away = isAway(profile);

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-card border border-border/50 flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <h1 className="font-bold text-[17px]">Business Profile</h1>
            <p className={cn("text-[11px] font-semibold",
              !profile.isEnabled ? "text-muted-foreground" :
              open ? "text-emerald-500" : away ? "text-orange-500" : "text-red-400")}>
              {!profile.isEnabled ? "Disabled" : open ? "Currently Open" : away ? "Away Mode" : "Currently Closed"}
            </p>
          </div>
          <motion.button whileTap={{ scale: 0.94 }} onClick={handleSave}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-md shadow-primary/25" data-testid="button-save">
            <Check className="h-4 w-4 text-primary-foreground" />
          </motion.button>
        </div>
      </div>

      <div className="px-4">
        {/* Business Mode toggle */}
        <SectionTitle label="Status" />
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <div className="flex items-center gap-3.5 px-4 py-4">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <Briefcase className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[14px]">Business Mode</p>
              <p className="text-[12px] text-muted-foreground">Enable business features</p>
            </div>
            <Switch checked={profile.isEnabled} onCheckedChange={v => update({ isEnabled: v })} />
          </div>
        </div>

        {profile.isEnabled && (
          <>
            {/* Business Info */}
            <SectionTitle label="Business Info" />
            <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3.5">
              <div>
                <FieldLabel>Business Name</FieldLabel>
                <Input value={profile.businessName} onChange={v => update({ businessName: v })} placeholder="Your business name" />
              </div>
              <div>
                <FieldLabel><span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />Address</span></FieldLabel>
                <Input value={profile.address} onChange={v => update({ address: v })} placeholder="123 Main St, City" />
              </div>
              <div>
                <FieldLabel><span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />Phone</span></FieldLabel>
                <BusinessPhone value={profile.phone} onChange={v => update({ phone: v })} />
              </div>
              <div>
                <FieldLabel><span className="flex items-center gap-1.5"><Globe className="h-3 w-3" />Website</span></FieldLabel>
                <Input value={profile.website} onChange={v => update({ website: v })} placeholder="https://example.com" />
              </div>
            </div>

            {/* Auto Messages */}
            <SectionTitle label="Auto Messages" />
            <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3.5">
              <div>
                <FieldLabel><span className="flex items-center gap-1.5"><MessageSquare className="h-3 w-3" />Welcome Message</span></FieldLabel>
                <Textarea value={profile.welcomeMessage} onChange={v => update({ welcomeMessage: v })} placeholder="Sent when someone starts a chat…" />
              </div>
            </div>

            {/* Away Mode */}
            <SectionTitle label="Away Mode" />
            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
              <div className="flex items-center gap-3.5 px-4 py-4 border-b border-border/50">
                <div className="w-9 h-9 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center">
                  <Moon className="h-4 w-4 text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[14px]">Away Mode</p>
                  <p className="text-[12px] text-muted-foreground">Auto-reply when unavailable</p>
                </div>
                <Switch checked={profile.awayEnabled} onCheckedChange={v => update({ awayEnabled: v })} />
              </div>
              {profile.awayEnabled && (
                <div className="p-4 space-y-3.5">
                  <div>
                    <FieldLabel>Away Message</FieldLabel>
                    <Textarea value={profile.awayMessage} onChange={v => update({ awayMessage: v })} placeholder="We're away right now…" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Away from</FieldLabel>
                      <input type="time" value={profile.awayStartTime} onChange={e => update({ awayStartTime: e.target.value })}
                        className="w-full bg-muted rounded-2xl px-4 py-3 text-[14px] outline-none border border-border/50 focus:border-primary/50" />
                    </div>
                    <div>
                      <FieldLabel>Away until</FieldLabel>
                      <input type="time" value={profile.awayEndTime} onChange={e => update({ awayEndTime: e.target.value })}
                        className="w-full bg-muted rounded-2xl px-4 py-3 text-[14px] outline-none border border-border/50 focus:border-primary/50" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Working Hours */}
            <SectionTitle label="Working Hours" />
            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/40">
              {profile.hours.map(h => (
                <div key={h.day} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[13px] font-semibold w-10 flex-shrink-0 text-muted-foreground">{h.day.slice(0, 3)}</span>
                  <Switch checked={!h.closed} onCheckedChange={v => updateHours(h.day, "closed", !v)} />
                  {!h.closed ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input type="time" value={h.open} onChange={e => updateHours(h.day, "open", e.target.value)}
                        className="flex-1 bg-muted rounded-xl px-3 py-1.5 text-[12px] outline-none border border-border/50 focus:border-primary/50" />
                      <span className="text-[11px] text-muted-foreground">to</span>
                      <input type="time" value={h.close} onChange={e => updateHours(h.day, "close", e.target.value)}
                        className="flex-1 bg-muted rounded-xl px-3 py-1.5 text-[12px] outline-none border border-border/50 focus:border-primary/50" />
                    </div>
                  ) : (
                    <span className="text-[12px] text-muted-foreground flex-1">Closed</span>
                  )}
                </div>
              ))}
            </div>

            {/* Save CTA */}
            <motion.button whileTap={{ scale: 0.98 }} onClick={handleSave}
              className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-[15px] shadow-lg shadow-primary/20 mt-5">
              Save Business Profile
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
};

export default BusinessProfileSettings;
