import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Row = Record<string, any>;
const rpc = (fn: string, args?: object): Promise<{ data: any; error: any }> =>
  (supabase.rpc as any).call(supabase, fn, args) as Promise<{ data: any; error: any }>;
const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : "—");
const money = (n?: number | null) => (n == null ? "—" : `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })} ETB`);

export default function MobileMoneyAdmin() {
  const [deps, setDeps] = useState<Row[]>([]);
  const [wds, setWds] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [refs, setRefs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [d, w] = await Promise.all([rpc("admin_list_mm_deposits"), rpc("admin_list_withdrawals")]);
    setLoading(false);
    if (d.error || w.error) { toast.error("Could not load payments"); return; }
    setDeps(d.data ?? []); setWds(w.data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const resolveDep = async (id: string, approve: boolean) => {
    if (!confirm(approve ? "Approve and credit this deposit?" : "Reject this deposit?")) return;
    setBusy(id);
    const { data, error } = await rpc("admin_resolve_mm_deposit", { p_deposit: id, p_approve: approve });
    setBusy(null);
    if (error || !data?.success) { toast.error(data?.error || "Action failed"); return; }
    toast.success(approve ? "Deposit credited" : "Deposit rejected"); load();
  };
  const resolveWd = async (r: Row, approve: boolean) => {
    const ref = (refs[r.id] ?? "").trim();
    if (approve && ref.length < 6) { toast.error("Enter the Telebirr/eBirr receipt number first"); return; }
    if (!confirm(approve ? `Mark ${money(r.amount)} to ${r.phone} as sent?` : `Reject and refund ${money(r.amount)} to @${r.username ?? "user"}?`)) return;
    setBusy(r.id);
    const { data, error } = await rpc("admin_resolve_withdrawal", { p_id: r.id, p_approve: approve, p_ref: ref, p_note: "" });
    setBusy(null);
    if (error || !data?.success) { toast.error(data?.error || "Action failed"); return; }
    toast.success(approve ? "Marked as sent" : "Rejected and refunded"); load();
  };

  const tone = (s: string) => (s === "settled" || s === "sent" ? "default" : s === "rejected" || s === "expired" ? "destructive" : "secondary");

  return (
    <div className="space-y-6">
      <div className="flex justify-end"><Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh</Button></div>

      <section className="space-y-2">
        <h3 className="font-semibold">Withdrawals ({wds.filter((x) => x.status === "pending").length} waiting)</h3>
        {wds.map((r) => (
          <Card key={r.id} className="p-3 text-sm space-y-2">
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">@{r.username ?? "user"} <Badge variant={tone(r.status)} className="ml-1">{r.status}</Badge></p>
                <p className="text-muted-foreground">{r.provider === "ebirr" ? "eBirr" : "Telebirr"} → <span className="font-mono text-foreground">{r.phone}</span></p>
                <p className="text-xs text-muted-foreground">{fmt(r.created_at)}{r.payout_ref ? ` · Ref ${r.payout_ref}` : ""}</p>
              </div>
              <p className="font-semibold whitespace-nowrap">{money(r.amount)}</p>
            </div>
            {r.status === "pending" && (
              <div className="flex flex-wrap gap-2">
                <Input className="h-9 flex-1 min-w-[160px]" placeholder="Receipt number after you send" value={refs[r.id] ?? ""} onChange={(e) => setRefs((p) => ({ ...p, [r.id]: e.target.value }))} />
                <Button size="sm" disabled={busy === r.id} onClick={() => resolveWd(r, true)}>Mark as sent</Button>
                <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => resolveWd(r, false)}>Reject & refund</Button>
              </div>
            )}
          </Card>
        ))}
        {!wds.length && <p className="text-muted-foreground text-sm">No withdrawals yet.</p>}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Deposits ({deps.filter((x) => x.status === "review").length} need review)</h3>
        {deps.map((r) => (
          <Card key={r.id} className="p-3 text-sm space-y-2">
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">@{r.username ?? "user"} <Badge variant={tone(r.status)} className="ml-1">{r.status}</Badge></p>
                <p className="text-muted-foreground">{r.provider === "ebirr" ? "eBirr" : "Telebirr"} · from {r.payer_phone}</p>
                {r.sms_txid && <p className="text-xs">SMS: {r.sms_txid} · {money(r.sms_amount)} · {r.sms_phone ?? "—"}</p>}
                {r.review_reason && <p className="text-xs text-muted-foreground">Reason: {r.review_reason}</p>}
                <p className="text-xs text-muted-foreground">{fmt(r.created_at)}</p>
              </div>
              <p className="font-semibold whitespace-nowrap">{money(r.amount)}</p>
            </div>
            {r.status === "review" && (
              <div className="flex gap-2">
                <Button size="sm" disabled={busy === r.id || !r.sms_txid} onClick={() => resolveDep(r.id, true)}>Approve{r.sms_amount ? ` ${money(r.sms_amount)}` : ""}</Button>
                <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => resolveDep(r.id, false)}>Reject</Button>
              </div>
            )}
          </Card>
        ))}
        {!deps.length && <p className="text-muted-foreground text-sm">No mobile money deposits yet.</p>}
      </section>
    </div>
  );
}
