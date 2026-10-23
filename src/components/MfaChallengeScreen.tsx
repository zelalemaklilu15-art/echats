import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";
import { callEmailTwoStep, twoStepMessage } from "@/lib/emailTwoStep";

/** Blocks the whole app until this sign-in is confirmed with an email code (or legacy authenticator code). */
export function MfaChallengeScreen({ onVerified, mode = "email", email }: { onVerified: () => void; mode?: "email" | "totp"; email?: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const sent = useRef(false);

  const send = async () => {
    setError(null);
    const r = await callEmailTwoStep({ action: "send" });
    if (r.ok) { setInfo(`We sent a code to ${email ?? "your email"}.`); setCooldown(60); }
    else setError(twoStepMessage(r.error));
  };

  useEffect(() => { if (mode === "email" && !sent.current) { sent.current = true; void send(); } }, [mode]);
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);

  const verify = async () => {
    if (!/^\d{6,8}$/.test(code)) { setError("Enter the code from your email"); return; }
    setBusy(true); setError(null);
    try {
      if (mode === "email") {
        const r = await callEmailTwoStep({ action: "verify", purpose: "login", code });
        if (!r.ok) { setError(twoStepMessage(r.error, r.remaining)); return; }
        onVerified(); return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.find((f) => f.status === "verified");
      if (!factor) throw new Error("No authenticator found");
      const ch = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (ch.error) throw ch.error;
      const vr = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: ch.data.id, code });
      if (vr.error) throw vr.error;
      onVerified();
    } catch {
      setError("Wrong code. Try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Two-step verification</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "email" ? (info ?? "Sending a code to your email…") : "Enter the 6-digit code from your authenticator app."}
        </p>
        <Input
          inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={8} value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && verify()}
          className="text-center text-2xl tracking-[0.4em]" aria-label="Verification code"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" onClick={verify} disabled={busy}>{busy ? "Checking…" : "Verify"}</Button>
        {mode === "email" && (
          <button className="text-sm text-primary disabled:text-muted-foreground" disabled={cooldown > 0} onClick={send}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        )}
        <div><button className="text-sm text-muted-foreground underline" onClick={() => supabase.auth.signOut()}>Sign out</button></div>
      </div>
    </div>
  );
}
