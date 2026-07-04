// @ts-nocheck
import { useState, useRef } from "react";
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { signUpWithEmail, signInWithEmail, isUsernameUnique } from "@/lib/supabaseAuth";
import { toast } from "sonner";
import logoImage from "@/assets/echat-logo.jpg";

const FloatingBlob = ({ className, delay = 0 }: { className: string; delay?: number }) => (
  <motion.div
    className={`absolute rounded-full pointer-events-none ${className}`}
    animate={{ scale: [1, 1.15, 0.95, 1], x: [0, 20, -10, 0], y: [0, -25, 15, 0] }}
    transition={{ duration: 9 + delay, repeat: Infinity, ease: "easeInOut", delay }}
  />
);

const FieldWrap = ({ children, icon: Icon, label }: { children: React.ReactNode; icon: React.ComponentType<any>; label: string }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider pl-1">{label}</label>
    <div className="relative flex items-center group input-glow rounded-2xl">
      <Icon className="absolute left-4 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10 pointer-events-none" />
      {children}
    </div>
  </div>
);

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get("next");
  const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/chats";
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [username, setUsername] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [isSignUp, setIsSignUp] = useState(true);
  const [loading, setLoading]   = useState(false);
  const submitting = useRef(false);

  const ic = "w-full bg-muted/60 border border-border/50 rounded-2xl pl-11 pr-4 py-3.5 text-[14px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/60 focus:bg-muted transition-all";

  const handleAuth = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    try {
      if (!email.trim() || !password.trim()) { toast.error("Please enter email and password"); return; }
      if (isSignUp) {
        if (!username.trim()) { toast.error("Please enter a username"); return; }
        if (username.trim().length < 3) { toast.error("Username must be at least 3 characters"); return; }
        if (password !== confirm) { toast.error("Passwords do not match"); return; }
        if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
        const n = username.toLowerCase().trim().replace(/\s/g, "");
        if (!(await isUsernameUnique(n))) { toast.error("Username already taken"); return; }
        const { user, error } = await signUpWithEmail(email, password, n, email.split("@")[0]);
        if (error) throw error;
        if (user) { toast.success("Account created!"); navigate(safeNext, { replace: true }); }
      } else {
        const { user, error } = await signInWithEmail(email, password);
        if (error) throw error;
        if (user) { toast.success("Welcome back!"); navigate(safeNext, { replace: true }); }
      }
    } catch (err: any) {
      const m = err?.message || "Authentication failed";
      if (m.includes("already registered")) toast.error("Email already in use. Sign in instead.");
      else if (m.includes("Invalid login")) toast.error("Invalid email or password");
      else toast.error(m);
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden px-5 py-10">
      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none" />

      {/* Background blobs */}
      <FloatingBlob className="w-80 h-80 bg-primary/18 blur-[90px] top-[-80px] left-[-80px]" delay={0} />
      <FloatingBlob className="w-64 h-64 bg-purple-600/15 blur-[70px] top-1/3 right-[-60px]" delay={2.5} />
      <FloatingBlob className="w-56 h-56 bg-pink-500/14 blur-[80px] bottom-[60px] left-[10px]" delay={5} />
      <FloatingBlob className="w-44 h-44 bg-primary/10 blur-[60px] bottom-[-20px] right-[60px]" delay={1.5} />

      {/* Back */}
      <div className="absolute top-12 left-5 z-20">
        <button onClick={() => navigate("/")} className="p-2.5 rounded-2xl transition-colors" style={{ background: "hsl(var(--card) / 0.7)", backdropFilter: "blur(12px)", border: "1px solid hsl(var(--border) / 0.5)" }}>
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Glass card */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-sm relative z-10 shimmer-card"
        style={{
          background: "hsl(222 20% 10% / 0.88)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          border: "1px solid hsl(338 90% 67% / 0.15)",
          borderRadius: 32,
          padding: "32px 28px 28px",
          boxShadow: "0 30px 90px hsl(222 22% 0% / 0.55), 0 0 0 1px hsl(338 90% 67% / 0.1), inset 0 1px 0 rgba(255,255,255,0.05)"
        }}
      >
        {/* Top gradient line */}
        <div className="absolute top-0 left-8 right-8 h-px rounded-full" style={{ background: "var(--gradient-primary)", opacity: 0.6 }} />

        {/* Logo + heading */}
        <div className="flex flex-col items-center mb-7">
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.1 }}
            className="relative mb-4"
          >
            <motion.div
              className="absolute inset-0 rounded-[20px] blur-2xl"
              style={{ background: "var(--gradient-primary)", opacity: 0.5 }}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <div className="relative w-[68px] h-[68px] rounded-[20px] overflow-hidden" style={{ boxShadow: "0 8px 40px hsl(338 90% 67% / 0.45)" }}>
              <img src={logoImage} alt="Echat" className="w-full h-full object-cover" />
            </div>
          </motion.div>
          <h1 className="text-[24px] font-black gradient-text tracking-tight">Echat</h1>
          <p className="text-muted-foreground/80 text-[13px] mt-1 font-medium">
            {isSignUp ? "Create your free account" : "Welcome back 👋"}
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-2xl p-1 mb-6" style={{ background: "hsl(var(--muted) / 0.6)", border: "1px solid hsl(var(--border) / 0.4)" }}>
          {[{ v: true, l: "Sign Up" }, { v: false, l: "Sign In" }].map(t => (
            <motion.button
              key={String(t.v)}
              onClick={() => setIsSignUp(t.v)}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all relative overflow-hidden"
              style={isSignUp === t.v ? {
                background: "var(--gradient-primary)",
                color: "white",
                boxShadow: "var(--shadow-primary)",
              } : {
                color: "hsl(var(--muted-foreground))",
              }}
              data-testid={`tab-${t.v ? "signup" : "signin"}`}
              whileTap={{ scale: 0.97 }}
            >
              {t.l}
            </motion.button>
          ))}
        </div>

        {/* Form fields */}
        <div className="space-y-4 mb-5">
          <AnimatePresence>
            {isSignUp && (
              <motion.div key="username-field" initial={{ opacity: 0, height: 0, marginBottom: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}>
                <FieldWrap icon={User} label="Username">
                  <input value={username} onChange={e => setUsername(e.target.value)} placeholder="@username" autoComplete="username" className={ic} data-testid="input-username" />
                </FieldWrap>
              </motion.div>
            )}
          </AnimatePresence>

          <FieldWrap icon={Mail} label="Email">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" className={ic} data-testid="input-email" onKeyDown={e => e.key === "Enter" && handleAuth()} />
          </FieldWrap>

          <FieldWrap icon={Lock} label="Password">
            <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete={isSignUp ? "new-password" : "current-password"} className={`${ic} pr-11`} data-testid="input-password" onKeyDown={e => e.key === "Enter" && handleAuth()} />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 text-muted-foreground hover:text-foreground transition-colors z-10">
              {showPw ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </FieldWrap>

          <AnimatePresence>
            {isSignUp && (
              <motion.div key="confirm-field" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}>
                <FieldWrap icon={Lock} label="Confirm Password">
                  <input type={showPw ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" className={ic} data-testid="input-confirm-password" onKeyDown={e => e.key === "Enter" && handleAuth()} />
                </FieldWrap>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!isSignUp && (
          <div className="text-right -mt-2 mb-4">
            <button onClick={() => navigate("/forgot-password")} className="text-[12px] text-primary hover:underline font-semibold">Forgot password?</button>
          </div>
        )}

        {/* Submit button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleAuth}
          disabled={!email.trim() || !password.trim() || (isSignUp && !username.trim()) || loading}
          className="w-full py-4 rounded-2xl font-black text-[15px] text-white flex items-center justify-center gap-2 disabled:opacity-50 relative overflow-hidden btn-glow"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-primary)" }}
          data-testid="button-auth-submit"
        >
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" />{isSignUp ? "Creating account…" : "Signing in…"}</>
            : <><Sparkles className="h-4 w-4" />{isSignUp ? "Create Account" : "Sign In"}</>
          }
        </motion.button>

        <p className="text-center text-[11px] text-muted-foreground/70 mt-5 leading-relaxed">
          {isSignUp ? <>By signing up you agree to our <span className="text-primary cursor-pointer hover:underline font-semibold">Terms of Service</span></> : <><span className="inline-flex items-center gap-1">🔒 End-to-end encrypted · Your data stays private</span></>}
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
