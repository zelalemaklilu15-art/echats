import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Check, ArrowRight, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { fetchEtokProfile, type EtokUser } from "@/lib/etokService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Step = "welcome" | "account_type" | "new_account" | "terms";
type AccountType = "echat" | "new" | null;

const AVATARS = ["🧑‍🎤", "👩‍🎨", "🧑‍💻", "👨‍🍳", "🧕", "👩‍🦱", "🧔", "👩‍🦰", "🧑‍🎨", "👩‍💻", "🧑‍🦳", "👩‍🔬", "🎭", "🌟", "🦋", "🔥", "💫", "🌈", "🎵", "💎"];

const TERMS_TEXT = `**Terms of Service — Etok**
Last updated: March 2026

**1. Acceptance of Terms**
By creating an Etok account or accessing Etok services, you confirm that you are at least 13 years of age and agree to these Terms of Service and our Privacy Policy. If you are under 18, you need parental or guardian consent.

**2. Your Account**
You are responsible for maintaining the security of your account credentials. You must not use another person's account or share your password. Etok reserves the right to terminate accounts that violate these terms.

**3. Content & Conduct**
You are solely responsible for the content you create, upload, or share. You must not post content that is illegal, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable. Etok has a zero-tolerance policy for content that exploits or harms minors.

**4. Intellectual Property**
By posting content on Etok, you grant Etok a worldwide, non-exclusive, royalty-free license to use, display, reproduce, and distribute your content on the platform. You retain all ownership rights to your original content.

**5. Prohibited Activities**
You may not: impersonate any person or entity; spam or send unsolicited messages; use automated tools to scrape or interact with the platform; attempt to hack, disrupt, or damage Etok systems; engage in any illegal activity using Etok.

**6. Termination**
Etok reserves the right to suspend or terminate your account at any time for violation of these terms, without prior notice. You may also delete your account at any time from Settings.

**7. Limitation of Liability**
Etok is provided "as is" without any warranties. Etok shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service.

**8. Changes to Terms**
Etok may modify these Terms at any time. Continued use of the service after changes constitutes acceptance of the new Terms.

---

**Privacy Policy — Etok**
Last updated: March 2026

**1. Information We Collect**
We collect information you provide when creating an account (name, username, date of birth, email). We also collect usage data, device information, location data (if permitted), and content you create or interact with.

**2. How We Use Your Information**
We use your data to: provide and improve Etok services; personalize your experience and content recommendations; show relevant advertising (if applicable); ensure platform safety and security; communicate with you about your account.

**3. Data Sharing**
We do not sell your personal information. We may share data with service providers who help us operate Etok, law enforcement when required by law, or other users when you choose to make your content public.

**4. Your Rights**
You have the right to: access your personal data; correct inaccurate data; delete your account and associated data; opt-out of personalized advertising; download a copy of your data.

**5. Data Security**
We use industry-standard security measures to protect your data, including encryption, secure servers, and regular security audits. However, no method of transmission over the internet is 100% secure.

**6. Cookies & Tracking**
Etok uses cookies and similar technologies to improve user experience, analyze usage patterns, and deliver personalized content. You can control cookie settings through your browser.

**7. Children's Privacy**
Etok is not intended for children under 13. We take extra precautions for users under 18, including additional privacy protections and parental controls.

**8. Contact Us**
For privacy-related questions, contact us at privacy@etok.app or through the in-app Settings > Data & Privacy section.`;

function formatTermsText(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**")) {
      return <p key={i} className="font-bold text-white text-[14px] mt-4 mb-1">{line.replace(/\*\*/g, "")}</p>;
    }
    if (line.startsWith("---")) {
      return <div key={i} className="border-t border-white/20 my-5" />;
    }
    if (!line) return <div key={i} className="h-1" />;
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-white/70 text-[13px] leading-relaxed mb-1">
        {parts.map((p, j) =>
          p.startsWith("**") ? <strong key={j} className="text-white font-semibold">{p.replace(/\*\*/g, "")}</strong> : p
        )}
      </p>
    );
  });
}

const ONBOARDING_KEY = "etok_onboarded";

/** Local (fast) cache check — used only as an optimistic hint. */
export function isEtokOnboarded(userId: string): boolean {
  try {
    const data = localStorage.getItem(`${ONBOARDING_KEY}_${userId}`);
    if (!data) return false;
    const parsed = JSON.parse(data);
    return parsed?.acceptedTerms === true;
  } catch {
    return false;
  }
}

/** Source of truth: server record. Falls back to local cache when offline. */
export async function isEtokOnboardedAsync(userId: string): Promise<boolean> {
  if (!userId) return true; // don't bounce while auth is still resolving
  try {
    const { data, error } = await supabase
      .from("etok_onboarding")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return isEtokOnboarded(userId);
    if (data) {
      localStorage.setItem(`${ONBOARDING_KEY}_${userId}`, JSON.stringify({ acceptedTerms: true }));
      return true;
    }
    return false;
  } catch {
    return isEtokOnboarded(userId);
  }
}

export async function markEtokOnboarded(userId: string, data: Record<string, unknown>): Promise<void> {
  localStorage.setItem(`${ONBOARDING_KEY}_${userId}`, JSON.stringify({ ...data, acceptedTerms: true, createdAt: new Date().toISOString() }));
  try {
    await supabase.from("etok_onboarding").upsert({
      user_id: userId,
      account_type: (data as { accountType?: string }).accountType ?? null,
      details: data as never,
    }, { onConflict: "user_id" });
  } catch (e) {
    console.warn("[etok] onboarding save failed", e);
  }
}

const EtokOnboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";
  const [echatProfile, setEchatProfile] = useState<EtokUser | null>(null);

  useEffect(() => {
    if (currentUserId) {
      fetchEtokProfile(currentUserId).then(p => setEchatProfile(p));
    }
  }, [currentUserId]);

  const [step, setStep] = useState<Step>("welcome");
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [birthYear, setBirthYear] = useState("");
  const [termsRead, setTermsRead] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const termsRef = useRef<HTMLDivElement>(null);

  const handleTermsScroll = () => {
    const el = termsRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      setTermsRead(true);
    }
  };

  const canProceedTerms = termsAccepted && privacyAccepted;

  const handleComplete = async () => {
    if (!canProceedTerms) return;

    const etokUsername = accountType === "echat"
      ? (echatProfile?.username ?? currentUserId)
      : newUsername.trim() || `user_${currentUserId.slice(0, 6)}`;

    await markEtokOnboarded(currentUserId, {
      accountType,
      etokUsername,
      displayName: accountType === "echat" ? echatProfile?.displayName : newDisplayName,
      avatar: accountType === "echat" ? echatProfile?.avatar : selectedAvatar,
      birthYear: birthYear || null,
    });

    toast.success("Etok account created! Welcome! 🎉");
    navigate("/etok", { replace: true });
  };

  const goBack = () => {
    if (step === "account_type") setStep("welcome");
    else if (step === "new_account") setStep("account_type");
    else if (step === "terms") {
      setStep(accountType === "new" ? "new_account" : "account_type");
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden" style={{ zIndex: 200 }}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 6, repeat: Infinity }}
          className="absolute w-80 h-80 rounded-full blur-3xl"
          style={{ background: "#ff0050", top: "-10%", right: "-20%" }}
        />
        <motion.div
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 8, repeat: Infinity, delay: 2 }}
          className="absolute w-72 h-72 rounded-full blur-3xl"
          style={{ background: "#20d5ec", bottom: "0%", left: "-15%" }}
        />
      </div>

      {/* Back button */}
      {step !== "welcome" && (
        <button onClick={goBack} className="absolute top-14 left-5 z-10 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>
      )}

      {/* Step indicator */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {(["welcome", "account_type", "terms"] as Step[]).map((s, i) => {
          const stepOrder = { welcome: 0, account_type: 1, new_account: 1, terms: 2 };
          const current = stepOrder[step];
          return (
            <div
              key={s}
              className={cn("h-1 rounded-full transition-all", current === i ? "w-6 bg-white" : current > i ? "w-3 bg-white/60" : "w-3 bg-white/20")}
            />
          );
        })}
      </div>

      {/* ─── WELCOME ─────────────────────────── */}
      <AnimatePresence mode="wait" custom={1}>
        {step === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
          >
            {/* Logo area */}
            <div className="relative mb-8">
              <div className="w-24 h-24 rounded-3xl bg-black border border-white/10 flex items-center justify-center shadow-2xl" style={{ boxShadow: "0 0 40px #ff005050" }}>
                <span className="text-5xl font-black" style={{ background: "linear-gradient(135deg,#ff0050,#20d5ec)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>E</span>
              </div>
              <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#ff0050] flex items-center justify-center">
                <Sparkles className="h-3 w-3 text-white" />
              </motion.div>
            </div>

            <h1 className="text-white font-black text-[36px] tracking-tight mb-2">Etok</h1>
            <p className="text-white/50 text-[16px] mb-2">by Echat</p>
            <p className="text-white/70 text-[15px] leading-relaxed mb-12">
              Share your moments. Discover amazing content. Connect with the world.
            </p>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setStep("account_type")}
              className="w-full max-w-xs py-4 rounded-2xl font-bold text-[16px] text-white flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg,#ff0050,#ff4d80)" }}
              data-testid="button-etok-get-started"
            >
              Get Started
              <ArrowRight className="h-5 w-5" />
            </motion.button>

            <p className="text-white/30 text-[12px] mt-4">Available to all Echat users</p>
          </motion.div>
        )}

        {/* ─── ACCOUNT TYPE ─────────────────────── */}
        {step === "account_type" && (
          <motion.div
            key="account_type"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="absolute inset-0 flex flex-col px-6 pt-28 pb-10"
          >
            <h2 className="text-white font-black text-[28px] mb-2">How do you want to join Etok?</h2>
            <p className="text-white/50 text-[14px] mb-8">
              Choose how to set up your Etok account
            </p>

            {/* Option 1 — Echat */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => { setAccountType("echat"); }}
              className={cn(
                "w-full rounded-2xl p-5 mb-4 border-2 transition-colors text-left",
                accountType === "echat"
                  ? "border-[#ff0050] bg-[#ff0050]/10"
                  : "border-white/15 bg-white/5"
              )}
              data-testid="button-use-echat-account"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff0050] to-[#ff4d80] flex items-center justify-center text-3xl flex-shrink-0">
                  {echatProfile?.avatar ?? "👤"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-white font-bold text-[16px]">Continue with Echat</p>
                    {accountType === "echat" && (
                      <div className="w-6 h-6 rounded-full bg-[#ff0050] flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-white/60 text-[13px] mt-1">
                    Use <span className="text-white font-semibold">@{echatProfile?.username ?? currentUserId.slice(0, 8)}</span> as your Etok identity
                  </p>
                  <p className="text-white/40 text-[12px] mt-1">Your profile picture and name carry over</p>
                </div>
              </div>
            </motion.button>

            {/* Option 2 — New account */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => { setAccountType("new"); }}
              className={cn(
                "w-full rounded-2xl p-5 border-2 transition-colors text-left",
                accountType === "new"
                  ? "border-[#20d5ec] bg-[#20d5ec]/10"
                  : "border-white/15 bg-white/5"
              )}
              data-testid="button-create-new-etok-account"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#20d5ec] to-[#0099bb] flex items-center justify-center">
                  <User className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-white font-bold text-[16px]">Create a new Etok account</p>
                    {accountType === "new" && (
                      <div className="w-6 h-6 rounded-full bg-[#20d5ec] flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-white/60 text-[13px] mt-1">Start fresh with a unique Etok identity</p>
                  <p className="text-white/40 text-[12px] mt-1">Choose a new username and avatar</p>
                </div>
              </div>
            </motion.button>

            <div className="flex-1" />

            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={!accountType}
              onClick={() => {
                if (accountType === "new") setStep("new_account");
                else setStep("terms");
              }}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-[16px] text-white flex items-center justify-center gap-2 transition-opacity",
                !accountType ? "opacity-40" : ""
              )}
              style={{ background: "linear-gradient(135deg,#ff0050,#ff4d80)" }}
              data-testid="button-account-type-continue"
            >
              Continue
              <ChevronRight className="h-5 w-5" />
            </motion.button>
          </motion.div>
        )}

        {/* ─── NEW ACCOUNT DETAILS ──────────────── */}
        {step === "new_account" && (
          <motion.div
            key="new_account"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="absolute inset-0 flex flex-col px-6 pt-28 pb-10 overflow-y-auto"
          >
            <h2 className="text-white font-black text-[28px] mb-1">Create your Etok profile</h2>
            <p className="text-white/50 text-[14px] mb-6">Choose how you'll appear on Etok</p>

            {/* Avatar picker */}
            <div className="mb-5">
              <p className="text-white/60 text-[12px] uppercase tracking-wide mb-3">Profile Picture</p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {AVATARS.map(av => (
                  <button
                    key={av}
                    onClick={() => setSelectedAvatar(av)}
                    className={cn(
                      "flex-shrink-0 w-14 h-14 rounded-2xl text-3xl flex items-center justify-center transition-all border-2",
                      selectedAvatar === av ? "border-[#ff0050] bg-[#ff0050]/15 scale-110" : "border-white/10 bg-white/5"
                    )}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            {/* Display name */}
            <div className="mb-4">
              <p className="text-white/60 text-[12px] uppercase tracking-wide mb-2">Display Name</p>
              <input
                value={newDisplayName}
                onChange={e => setNewDisplayName(e.target.value.slice(0, 30))}
                placeholder="Your display name"
                className="w-full bg-white/10 rounded-xl px-4 py-3.5 text-white text-[15px] outline-none placeholder:text-white/25 border border-white/10 focus:border-[#ff0050]"
                data-testid="input-etok-displayname"
              />
            </div>

            {/* Username */}
            <div className="mb-4">
              <p className="text-white/60 text-[12px] uppercase tracking-wide mb-2">Username</p>
              <div className="flex items-center bg-white/10 rounded-xl border border-white/10 focus-within:border-[#ff0050] overflow-hidden">
                <span className="text-white/50 text-[15px] pl-4 pr-1">@</span>
                <input
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase().slice(0, 24))}
                  placeholder="username"
                  className="flex-1 bg-transparent py-3.5 pr-4 text-white text-[15px] outline-none placeholder:text-white/25"
                  data-testid="input-etok-username"
                />
              </div>
              {newUsername.length > 0 && newUsername.length < 3 && (
                <p className="text-red-400 text-[11px] mt-1">Username must be at least 3 characters</p>
              )}
            </div>

            {/* Birth year */}
            <div className="mb-6">
              <p className="text-white/60 text-[12px] uppercase tracking-wide mb-2">Year of Birth <span className="text-white/30 normal-case">(optional, for age verification)</span></p>
              <input
                value={birthYear}
                onChange={e => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="e.g. 2000"
                type="number"
                min="1900"
                max={new Date().getFullYear() - 13}
                className="w-full bg-white/10 rounded-xl px-4 py-3.5 text-white text-[15px] outline-none placeholder:text-white/25 border border-white/10 focus:border-[#ff0050]"
                data-testid="input-etok-birthyear"
              />
            </div>

            <div className="flex-1" />

            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={newUsername.length > 0 && newUsername.length < 3}
              onClick={() => setStep("terms")}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-[16px] text-white flex items-center justify-center gap-2 transition-opacity",
                newUsername.length > 0 && newUsername.length < 3 ? "opacity-40" : ""
              )}
              style={{ background: "linear-gradient(135deg,#ff0050,#ff4d80)" }}
              data-testid="button-new-account-continue"
            >
              Continue
              <ChevronRight className="h-5 w-5" />
            </motion.button>
          </motion.div>
        )}

        {/* ─── TERMS & CONDITIONS ───────────────── */}
        {step === "terms" && (
          <motion.div
            key="terms"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="absolute inset-0 flex flex-col pt-24"
          >
            <div className="px-6 mb-3 flex-shrink-0">
              <h2 className="text-white font-black text-[26px] mb-1">Terms & Privacy Policy</h2>
              <p className="text-white/50 text-[13px]">
                Please read and scroll to the bottom to accept
              </p>
            </div>

            {/* Scrollable terms */}
            <div
              ref={termsRef}
              onScroll={handleTermsScroll}
              className="flex-1 overflow-y-auto px-6 pb-4"
              style={{ scrollbarWidth: "none" }}
            >
              <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                {formatTermsText(TERMS_TEXT)}
              </div>
              {!termsRead && (
                <p className="text-white/30 text-[11px] text-center mt-3 animate-pulse">↓ Scroll to read all</p>
              )}
            </div>

            {/* Accept checkboxes + button */}
            <div className="flex-shrink-0 px-6 pb-8 pt-4 border-t border-white/10 bg-black space-y-3">
              {/* Terms checkbox */}
              <button
                onClick={() => setTermsAccepted(!termsAccepted)}
                className="flex items-start gap-3 text-left w-full"
                data-testid="checkbox-terms"
              >
                <div className={cn("w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors", termsAccepted ? "bg-[#ff0050] border-[#ff0050]" : "border-white/30")}>
                  {termsAccepted && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>
                <span className="text-white/70 text-[13px] leading-relaxed">
                  I have read and agree to Etok's <span className="text-[#ff0050] font-semibold">Terms of Service</span>
                </span>
              </button>

              {/* Privacy checkbox */}
              <button
                onClick={() => setPrivacyAccepted(!privacyAccepted)}
                className="flex items-start gap-3 text-left w-full"
                data-testid="checkbox-privacy"
              >
                <div className={cn("w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors", privacyAccepted ? "bg-[#ff0050] border-[#ff0050]" : "border-white/30")}>
                  {privacyAccepted && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>
                <span className="text-white/70 text-[13px] leading-relaxed">
                  I have read and agree to Etok's <span className="text-[#ff0050] font-semibold">Privacy Policy</span>
                </span>
              </button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={!canProceedTerms}
                onClick={handleComplete}
                className={cn(
                  "w-full py-4 mt-1 rounded-2xl font-bold text-[16px] text-white flex items-center justify-center gap-2 transition-all",
                  canProceedTerms ? "opacity-100" : "opacity-30"
                )}
                style={{ background: "linear-gradient(135deg,#ff0050,#ff4d80)" }}
                data-testid="button-accept-and-join"
              >
                <Sparkles className="h-5 w-5" />
                Create My Etok Account
              </motion.button>

              <p className="text-white/25 text-[11px] text-center">
                By joining, you confirm you are 13 years or older
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EtokOnboarding;
