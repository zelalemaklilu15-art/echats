import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";

/** Blocks the whole app until the user's TOTP code is verified (aal1 -> aal2). */
export function MfaChallengeScreen({ onVerified }: { onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) { setError("Enter the 6-digit code"); return; }
    setBusy(true); setError(null);
    try {
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
        <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
        <Input
          inputMode="numeric" autoFocus maxLength={6} value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && verify()}
          className="text-center text-2xl tracking-[0.5em]" aria-label="Verification code"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" onClick={verify} disabled={busy}>{busy ? "Checking…" : "Verify"}</Button>
        <button className="text-sm text-muted-foreground underline" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </div>
  );
}
