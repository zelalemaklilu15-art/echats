import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import PinConfirmSheet from "@/components/wallet/PinConfirmSheet";
import PinResetFlow from "@/components/wallet/PinResetFlow";
import PinSetupSheet from "@/components/wallet/PinSetupSheet";
import { newIdempotencyKey, normalizeEthiopianPhone } from "@/lib/walletSecurity";
import { walletService } from "@/lib/walletService";
import { listWithdrawals, requestWithdrawal, validWithdrawalAmount, withdrawalPayload, WITHDRAWAL_MIN_ETB, WITHDRAWAL_MAX_ETB, WITHDRAWAL_FEE_ETB, type Withdrawal, type WithdrawalProvider } from "@/lib/withdrawalService";
import { toast } from "sonner";

export default function WithdrawMoney() {
  const { user } = useAuth();
  const owner = user?.id ?? "";
  const navigate = useNavigate();
  const [provider, setProvider] = useState<WithdrawalProvider>("telebirr");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [receipt, setReceipt] = useState<string>();
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  const [setup, setSetup] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const operations = useRef(new Map<string, string>());
  useEffect(() => {
    mounted.current = true;
    let active = true;
    void listWithdrawals(owner).then(data => { if (active) setRows(data); }).catch(() => { if (active) toast.error("Could not load withdrawal history."); });
    return () => { active = false; mounted.current = false; };
  }, [owner]);
  const normalized = normalizeEthiopianPhone(phone);
  const value = Number(amount);
  const valid = Boolean(normalized) && validWithdrawalAmount(value);
  const providerName = provider === "telebirr" ? "Telebirr" : "eBirr";

  const submit = async (pin: string) => {
    if (pending.current || !valid || !owner) return;
    pending.current = true; setBusy(true); setPinError("");
    const payload = withdrawalPayload(provider, phone, value);
    const key = operations.current.get(payload) ?? newIdempotencyKey("withdrawal");
    operations.current.set(payload, key);
    try {
      const result = await requestWithdrawal(owner, provider, phone, value, pin, key);
      if (!mounted.current) return;
      if (result.success && result.withdrawal_id) {
        walletService.invalidateCache();
        setReceipt(result.withdrawal_id); setPinOpen(false); setStep("done");
        const data = await listWithdrawals(owner);
        if (mounted.current) setRows(data);
      } else if (result.error === "PIN_NOT_SET") { setPinOpen(false); setSetup(true); }
      else if (/pin|too many/i.test(result.error ?? "")) { setPinError(result.error ?? "Incorrect PIN"); }
      else { setPinOpen(false); toast.error(result.error === "STEP_UP_REQUIRED" ? "Confirm this device from the wallet page before retrying." : result.error ?? "Withdrawal failed."); }
    } catch { if (mounted.current) toast.error("Could not refresh the request. Check your history before retrying."); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const submitted = rows.find(row => row.id === receipt);

  return <div className="min-h-dvh bg-background text-foreground pb-10">
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
      <Button variant="ghost" size="icon" aria-label="Back" disabled={busy} onClick={() => step === "confirm" ? setStep("form") : navigate("/wallet")}><ArrowLeft className="h-5 w-5" /></Button>
      <h1 className="font-display text-lg">Withdraw</h1>
    </header>
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 pt-6">
      {step === "form" && <>
        <RadioGroup value={provider} onValueChange={v => { if (v === "telebirr" || v === "ebirr") setProvider(v); }} className="grid grid-cols-2 gap-3" aria-label="Payment provider">
          {(["telebirr", "ebirr"] as const).map(p => <label key={p} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-4"><RadioGroupItem value={p} />{p === "telebirr" ? "Telebirr" : "eBirr"}</label>)}
        </RadioGroup>
        <label className="flex flex-col gap-2"><span className="text-sm text-muted-foreground">Receiving mobile number</span><Input type="tel" autoComplete="tel" placeholder="+251 9XXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} />{phone && !normalized && <span className="text-xs text-destructive">Enter a valid Telebirr or eBirr mobile number.</span>}</label>
        <label className="flex flex-col gap-2"><span className="text-sm text-muted-foreground">Amount (ETB)</span><Input inputMode="decimal" placeholder={`${WITHDRAWAL_MIN_ETB} – ${WITHDRAWAL_MAX_ETB}`} value={amount} onChange={e => setAmount(e.target.value)} />{amount && !validWithdrawalAmount(value) && <span className="text-xs text-destructive">Enter 50–5,000 ETB, with up to two decimal places.</span>}</label>
        <dl className="space-y-3 border-y border-border py-4 text-sm"><div className="flex justify-between"><dt className="text-muted-foreground">Minimum withdrawal</dt><dd>{WITHDRAWAL_MIN_ETB} ETB</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Service fee</dt><dd>{WITHDRAWAL_FEE_ETB} ETB</dd></div></dl>
        <Button disabled={!valid} onClick={() => setStep("confirm")}><ArrowUpRight className="mr-2 h-4 w-4" />Continue</Button>
        {rows.length > 0 && <section className="border-t border-border pt-5"><h2 className="mb-3 font-semibold">Recent withdrawals</h2>{rows.map(row => <div key={row.id} className="flex justify-between gap-3 border-b border-border py-3 text-sm"><div><p>{row.provider === "telebirr" ? "Telebirr" : "eBirr"} · {row.phone}</p><p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleDateString()} · {row.status === "pending" ? "Awaiting review" : row.status === "sent" ? "Sent" : "Rejected & refunded"}</p></div><span className="whitespace-nowrap">{Number(row.amount).toLocaleString()} ETB</span></div>)}</section>}
      </>}
      {step === "confirm" && <>
        <div className="flex flex-col items-center gap-3 py-6 text-center"><ArrowUpRight className="h-10 w-10 text-primary" /><p className="font-display text-3xl">{value.toLocaleString()} ETB</p><p>{providerName} · {normalized}</p></div>
        <dl className="space-y-3 border-y border-border py-4 text-sm"><div className="flex justify-between"><dt>Service fee</dt><dd>0 ETB</dd></div><div className="flex justify-between font-semibold"><dt>Total debit</dt><dd>{value.toLocaleString()} ETB</dd></div></dl>
        <p className="text-sm text-muted-foreground">The amount is deducted when submitted. Your payout awaits admin review; rejected requests are refunded.</p>
        <Button disabled={busy} onClick={() => { setPinError(""); setPinOpen(true); }}>Confirm & enter PIN</Button>
      </>}
      {step === "done" && <div className="flex flex-col items-center gap-4 pt-8 text-center"><CheckCircle2 className="h-14 w-14 text-cosmic-mint" /><h2 className="font-display text-2xl">Withdrawal submitted</h2><p className="text-muted-foreground">{value.toLocaleString()} ETB to {providerName} · {normalized}</p><p className="text-sm">{submitted?.status === "sent" ? "Sent" : submitted?.status === "rejected" ? "Rejected & refunded" : "Awaiting admin review"}</p>{receipt && <p className="w-full break-all text-xs text-muted-foreground">Request: {receipt}</p>}<Button className="w-full" onClick={() => navigate("/wallet")}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Back to wallet</Button></div>}
    </main>
    <PinConfirmSheet open={pinOpen} onOpenChange={setPinOpen} busy={busy} error={pinError} summary={`${value.toLocaleString()} ETB to ${providerName} · ${normalized ?? ""}`} onSubmit={submit} onForgot={() => { setPinOpen(false); setReset(true); }} />
    <PinResetFlow open={reset} onClose={() => setReset(false)} />
    <PinSetupSheet open={setup} onOpenChange={setSetup} onDone={() => { setSetup(false); setPinOpen(true); }} />
  </div>;
}