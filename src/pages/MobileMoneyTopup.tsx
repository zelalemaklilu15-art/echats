import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Copy, Loader2, Phone, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { newIdempotencyKey, getDeviceId } from "@/lib/walletSecurity";

const RECEIVER = "0953002993";
// USSD templates still need confirmation on a real SIM before launch.
const ussd = (p: string, amt: number) => p === "telebirr" ? `*127*2*${RECEIVER}*${amt}#` : `*681*${RECEIVER}*${amt}#`;

type Status = "starting" | "pending" | "completed" | "review" | "expired" | "rejected" | "error";

export default function MobileMoneyTopup() {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: { amount?: number; provider?: string } };
  const amount = Number(state?.amount) || 0;
  const provider = state?.provider === "ebirr" ? "ebirr" : "telebirr";
  const label = provider === "ebirr" ? "eBirr" : "Telebirr";
  const [status, setStatus] = useState<Status>("starting");
  const [err, setErr] = useState("");
  const [depId, setDepId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [since, setSince] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [txid, setTxid] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey("mm"));

  useEffect(() => {
    if (amount < 10) { navigate("/add-money", { replace: true }); return; }
    let live = true;
    (async () => {
      const { data, error } = await supabase.rpc("mm_deposit_open" as never, {
        p_amount: amount, p_provider: provider, p_key: key.current, p_device: await getDeviceId(),
      } as never);
      if (!live) return;
      const r = data as { success?: boolean; error?: string; deposit_id?: string; phone?: string } | null;
      if (error || !r?.success || !r.deposit_id) {
        setErr(r?.error === "PHONE_REQUIRED" ? "Add your phone number in your profile first. Payments are matched to that number."
          : r?.error === "STEP_UP_REQUIRED" ? "Please verify this device first." : (r?.error || "Could not start top-up."));
        setStatus("error"); return;
      }
      setDepId(r.deposit_id); setPhone(r.phone ?? ""); setStatus("pending"); setSince(Date.now());
    })();
    return () => { live = false; };
  }, [amount, provider, navigate]);

  useEffect(() => {
    if (!depId || status !== "pending") return;
    const t = setInterval(async () => {
      setNow(Date.now());
      const { data } = await supabase.from("mm_deposits" as never).select("status").eq("id", depId).maybeSingle();
      const s = (data as { status?: Status } | null)?.status;
      if (s && s !== "pending") setStatus(s);
    }, 4000);
    return () => clearInterval(t);
  }, [depId, status]);

  const claim = async () => {
    if (!depId || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("mm_deposit_claim_txid" as never, { p_deposit: depId, p_txid: txid } as never);
    setBusy(false);
    const r = data as { success?: boolean; error?: string; status?: Status } | null;
    if (error || !r?.success) { toast.error(r?.error || "Could not verify"); return; }
    if (r.status) setStatus(r.status);
  };

  const code = ussd(provider, amount);
  const showFallback = now - since > 3 * 60_000;

  return (
    <div className="min-h-screen bg-background text-foreground px-5 pt-5 pb-10">
      <button onClick={() => navigate("/wallet")} className="flex items-center gap-2 text-muted-foreground mb-6"><ArrowLeft className="h-5 w-5" /> Wallet</button>
      <h1 className="text-2xl font-semibold mb-1">Top up with {label}</h1>
      <p className="text-muted-foreground mb-6">{amount.toLocaleString()} ETB</p>

      {status === "starting" && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
      {status === "error" && <div className="rounded-2xl bg-card p-5 text-destructive">{err}</div>}

      {status === "pending" && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-card p-5 space-y-3">
            <p className="text-sm text-muted-foreground">1. Pay from your registered number <b className="text-foreground">{phone}</b></p>
            <Button className="w-full" onClick={() => { window.location.href = `tel:${code.replace(/#/g, "%23")}`; }}><Phone className="h-4 w-4 mr-2" />Pay {amount} ETB with {label}</Button>
            <div className="flex items-center justify-between text-sm rounded-xl bg-muted px-3 py-2">
              <span>Or send manually to <b>{RECEIVER}</b></span>
              <button aria-label="Copy number" onClick={() => { navigator.clipboard?.writeText(RECEIVER); toast.success("Copied"); }}><Copy className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">Enter your {label} PIN only inside {label}. Echats never asks for it.</p>
          </div>
          <div className="rounded-2xl bg-card p-5 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div><p className="font-medium">2. Waiting for your payment…</p><p className="text-xs text-muted-foreground">Your balance updates automatically within seconds of payment.</p></div>
          </div>
          {showFallback && (
            <div className="rounded-2xl bg-card p-5 space-y-3">
              <p className="font-medium flex items-center gap-2"><Clock className="h-4 w-4" />Payment delayed? Enter the transaction ID</p>
              <p className="text-xs text-muted-foreground">Use this if you paid from another phone or the confirmation is slow.</p>
              <Input value={txid} onChange={e => setTxid(e.target.value.toUpperCase())} placeholder="e.g. DB12AB34CD" maxLength={20} />
              <Button className="w-full" disabled={busy || txid.length < 6} onClick={claim}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}</Button>
            </div>
          )}
        </div>
      )}

      {status === "completed" && (
        <div className="rounded-2xl bg-card p-6 text-center space-y-3">
          <Check className="h-10 w-10 mx-auto text-primary" /><p className="text-lg font-semibold">{amount.toLocaleString()} ETB added</p>
          <Button className="w-full" onClick={() => navigate("/wallet")}>Back to wallet</Button>
        </div>
      )}
      {status === "review" && (
        <div className="rounded-2xl bg-card p-6 text-center space-y-3">
          <ShieldCheck className="h-10 w-10 mx-auto text-primary" /><p className="font-semibold">Payment received — under review</p>
          <p className="text-sm text-muted-foreground">It was paid from a different number or amount. Our team will confirm it shortly.</p>
          <Button className="w-full" onClick={() => navigate("/wallet")}>Back to wallet</Button>
        </div>
      )}
      {(status === "expired" || status === "rejected") && (
        <div className="rounded-2xl bg-card p-6 text-center space-y-3"><p className="font-semibold">This top-up was {status}.</p>
          <Button className="w-full" onClick={() => navigate("/add-money")}>Try again</Button></div>
      )}
    </div>
  );
}
