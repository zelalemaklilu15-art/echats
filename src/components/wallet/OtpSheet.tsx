import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MailCheck } from "lucide-react";
import { sendStepUpCode, verifyStepUpCode } from "@/lib/walletSecurity";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; reason: string; onVerified: () => void; }

/** Email one-time code — used ONLY for high-risk actions. */
export default function OtpSheet({ open, onOpenChange, reason, onVerified }: Props) {
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    setBusy(true); setError("");
    try { setEmail(await sendStepUpCode()); }
    catch (e) { setError((e as Error).message || "Could not send code"); }
    finally { setBusy(false); }
  };

  useEffect(() => { if (open) { setCode(""); setEmail(null); void send(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = async () => {
    if (!email) return;
    setBusy(true); setError("");
    try { await verifyStepUpCode(email, code); onVerified(); }
    catch { setError("Wrong or expired code"); }
    finally { setBusy(false); }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DrawerContent className="bg-card border-border pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <DrawerHeader className="text-center">
          <MailCheck className="mx-auto h-8 w-8 text-primary" />
          <DrawerTitle className="font-display text-foreground">Extra security check</DrawerTitle>
          <DrawerDescription className="text-muted-foreground">
            {reason}{email ? ` We sent a code to ${email}.` : ""}
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-6 flex flex-col gap-3">
          <Input inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="Email code"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center text-lg tracking-widest" />
          {error && <p className="text-sm text-destructive text-center" role="alert">{error}</p>}
          <Button disabled={busy || code.length < 6 || !email} onClick={verify}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
          </Button>
          <button type="button" disabled={busy} onClick={send} className="text-sm text-primary">Resend code</button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
