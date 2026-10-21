import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Smartphone, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import PinConfirmSheet from "@/components/wallet/PinConfirmSheet";
import PinResetFlow from "@/components/wallet/PinResetFlow";
import PinSetupSheet from "@/components/wallet/PinSetupSheet";
import { AIRTIME_MAX_ETB, AIRTIME_MIN_ETB, buyAirtime, newIdempotencyKey, normalizeEthiopianPhone } from "@/lib/walletSecurity";
import { walletService } from "@/lib/walletService";

const PRESETS = [10, 25, 50, 100, 250, 500];

export default function Airtime() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  const [setup, setSetup] = useState(false);
  const [key, setKey] = useState(() => newIdempotencyKey("airtime"));
  const [newBalance, setNewBalance] = useState<number | null>(null);

  const normalized = normalizeEthiopianPhone(phone);
  const value = Number(amount);
  const amountOk = value >= AIRTIME_MIN_ETB && value <= AIRTIME_MAX_ETB;

  const submit = async (pin: string) => {
    setBusy(true); setPinError("");
    const r = await buyAirtime(normalized!, value, pin, key);
    setBusy(false);
    if (r.success) {
      walletService.invalidateCache();
      setNewBalance(r.balance ?? null);
      setPinOpen(false); setStep("done");
      return;
    }
    if (r.error === "PIN_NOT_SET") { setPinOpen(false); setSetup(true); return; }
    if (r.error === "Incorrect PIN" || r.error?.startsWith("Too many")) { setPinError(r.error); return; }
    setPinOpen(false); toast.error(r.error || "Top-up failed");
    setKey(newIdempotencyKey("airtime"));
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-background/90 backdrop-blur border-b border-border"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
        <button aria-label="Back" onClick={() => (step === "confirm" ? setStep("form") : navigate("/wallet"))}
          className="h-10 w-10 rounded-full bg-foreground/5 flex items-center justify-center"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="font-display text-lg">Mobile Airtime</h1>
      </header>

      <main className="px-5 pt-6 max-w-md mx-auto">
        {step === "form" && (
          <div className="flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">Mobile number</span>
              <Input inputMode="tel" placeholder="09XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
              {phone && !normalized && <span className="text-xs text-destructive">Enter a valid Ethiopian mobile number</span>}
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">Amount (ETB)</span>
              <Input inputMode="decimal" placeholder={`${AIRTIME_MIN_ETB} – ${AIRTIME_MAX_ETB}`} value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
              {amount && !amountOk && <span className="text-xs text-destructive">Amount must be between {AIRTIME_MIN_ETB} and {AIRTIME_MAX_ETB} ETB</span>}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <Button key={p} variant={value === p ? "default" : "outline"} onClick={() => setAmount(String(p))}>{p}</Button>
              ))}
            </div>
            <Button disabled={!normalized || !amountOk} onClick={() => setStep("confirm")}>Continue</Button>
          </div>
        )}

        {step === "confirm" && (
          <div className="flex flex-col gap-5">
            <div className="rounded-3xl border border-primary/30 bg-card p-6 text-center">
              <Smartphone className="mx-auto h-8 w-8 text-primary mb-3" />
              <p className="text-muted-foreground text-sm">Top up</p>
              <p className="font-display text-3xl text-primary my-1">{value.toLocaleString()} ETB</p>
              <p className="text-foreground">{normalized}</p>
            </div>
            <Button onClick={() => { setPinError(""); setPinOpen(true); }}>Confirm & enter PIN</Button>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-4 text-center pt-10">
            <CheckCircle2 className="h-14 w-14 text-cosmic-mint" />
            <h2 className="font-display text-2xl">Top-up submitted</h2>
            <p className="text-muted-foreground">{value.toLocaleString()} ETB for {normalized} is pending delivery.</p>
            {newBalance !== null && <p className="text-sm">New balance: <span className="text-primary">{Number(newBalance).toLocaleString()} ETB</span></p>}
            <Button className="w-full" onClick={() => navigate("/wallet")}>Back to wallet</Button>
          </div>
        )}
      </main>

      <PinConfirmSheet open={pinOpen} onOpenChange={setPinOpen} busy={busy} error={pinError}
        summary={`${value.toLocaleString()} ETB airtime to ${normalized ?? ""}`}
        onSubmit={submit} onForgot={() => { setPinOpen(false); setReset(true); }} />
      <PinResetFlow open={reset} onClose={() => setReset(false)} />
      <PinSetupSheet open={setup} onOpenChange={setSetup} onDone={() => { setSetup(false); setPinOpen(true); }} />
    </div>
  );
}
