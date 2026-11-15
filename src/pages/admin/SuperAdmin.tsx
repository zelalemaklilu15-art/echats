import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import NotFound from "@/pages/NotFound";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const SENDERS = ["support", "info", "contact", "admin"] as const;

type Overview = Record<string, number>;
type Row = Record<string, any>;
const rpc = (fn: string, args?: object): Promise<{ data: any; error: any }> =>
  (supabase.rpc as any).call(supabase, fn, args) as Promise<{ data: any; error: any }>;

const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : "—");
const money = (n?: number | null) => (n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }));

export default function SuperAdmin() {
  const { user } = useAuth();
  const [state, setState] = useState<"checking" | "denied" | "ok" | "login">("checking");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<Row[]>([]);
  const [txs, setTxs] = useState<Row[]>([]);
  const [reports, setReports] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [tickets, setTickets] = useState<Row[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const [adj, setAdj] = useState({ amount: "", reason: "", dir: "credit" as "credit" | "debit" });
  const [busy, setBusy] = useState(false);
  const [mail, setMail] = useState({ from: "support" as (typeof SENDERS)[number], to: "", subject: "", message: "" });

  const openUser = async (id: string) => {
    const { data, error } = await rpc("admin_user_detail", { p_user: id });
    if (error) { toast.error("Could not load user"); return; }
    setDetail(data); setAdj({ amount: "", reason: "", dir: "credit" });
  };
  const userAction = async (action: "ban" | "unban") => {
    if (!detail || !confirm(`${action === "ban" ? "Ban" : "Unban"} ${detail.email}?`)) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-user-action", { body: { action, user_id: detail.id } });
    setBusy(false);
    if (error || data?.error) { toast.error(data?.error || "Action failed"); return; }
    toast.success(action === "ban" ? "User banned" : "User unbanned"); openUser(detail.id); load();
  };
  const walletStatus = async (st: "active" | "suspended") => {
    if (!detail) return;
    const { error } = await rpc("admin_set_wallet_status", { p_user: detail.id, p_status: st });
    if (error) { toast.error(error.message); return; }
    toast.success(`Wallet ${st}`); openUser(detail.id); load();
  };
  const adjust = async () => {
    if (!detail) return;
    const amount = Number(adj.amount);
    if (!(amount > 0) || adj.reason.trim().length < 3) { toast.error("Enter amount and reason"); return; }
    if (!confirm(`${adj.dir === "credit" ? "Add" : "Remove"} ${money(amount)} ${adj.dir === "credit" ? "to" : "from"} ${detail.email}?`)) return;
    setBusy(true);
    const { error } = await rpc("admin_wallet_adjust", { p_user: detail.id, p_amount: amount, p_direction: adj.dir, p_reason: adj.reason, p_key: crypto.randomUUID() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Wallet updated"); openUser(detail.id); load();
  };
  const sendMail = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-send-email", { body: mail });
    setBusy(false);
    if (error || data?.error) { toast.error(typeof data?.error === "string" ? data.error : "Send failed"); return; }
    toast.success("Email sent"); setMail((m) => ({ ...m, to: "", subject: "", message: "" }));
  };

  useEffect(() => {
    let alive = true;
    setState("checking");
    if (!user) { setState("login"); return; }
    rpc("is_super_admin").then(({ data, error }) => {
      if (alive) setState(!error && data === true ? "ok" : "denied");
    });
    return () => { alive = false; };
  }, [user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, u, t, r, s] = await Promise.all([
      rpc("admin_overview"),
      rpc("admin_list_users", { p_search: search || null, p_limit: 100 }),
      rpc("admin_recent_transactions", { p_limit: 100 }),
      rpc("admin_list_reports", { p_limit: 100 }),
      rpc("admin_list_tickets", { p_limit: 200 }),
    ]);
    if (o.error) { setState("denied"); setLoading(false); return; }
    setOverview(o.data); setUsers(u.data ?? []); setTxs(t.data ?? []); setReports(r.data ?? []); setTickets(s.data ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => { if (state === "ok") load(); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === "checking") return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (state === "denied") return <NotFound />;
  if (state === "login") return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form className="w-full max-w-sm space-y-3" onSubmit={async (e) => {
        e.preventDefault(); setErr("");
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) setErr("Sign-in failed");
      }}>
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full">Sign in</Button>
      </form>
    </div>
  );

  const stats: [string, string][] = overview ? [
    ["Total users", String(overview.users)], ["New (7 days)", String(overview.users_7d)], ["Online now", String(overview.online)],
    ["Wallets", String(overview.wallets)], ["Wallet balances", money(overview.wallet_total)], ["Transactions (24h)", String(overview.tx_24h)],
    ["Messages (24h)", String(overview.messages_24h)], ["Groups", String(overview.groups)], ["Channels", String(overview.channels)],
    ["eTok videos", String(overview.videos)], ["Reports", String(overview.reports)],
  ] : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur px-4 py-3 flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="font-semibold">Echat Super Admin</h1>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </header>
      <main className="p-4 max-w-6xl mx-auto">
        <Tabs defaultValue="overview">
          <TabsList className="w-full overflow-x-auto justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="wallet">Wallet</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="support">Support{tickets.filter((x) => x.status === "open").length ? ` (${tickets.filter((x) => x.status === "open").length})` : ""}</TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="mt-4">
            <Card className="p-4 space-y-3 max-w-2xl">
              <div className="flex flex-wrap gap-2">
                {SENDERS.map((f) => (
                  <Button key={f} size="sm" variant={mail.from === f ? "default" : "outline"} onClick={() => setMail((m) => ({ ...m, from: f }))}>{f}@echats.site</Button>
                ))}
              </div>
              <Input type="email" placeholder="To (email address)" value={mail.to} onChange={(e) => setMail((m) => ({ ...m, to: e.target.value }))} />
              <Input placeholder="Subject" value={mail.subject} onChange={(e) => setMail((m) => ({ ...m, subject: e.target.value }))} />
              <Textarea rows={10} placeholder="Message" value={mail.message} onChange={(e) => setMail((m) => ({ ...m, message: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Replies go to {mail.from}@echats.site and arrive in your Gmail.</p>
              <Button disabled={busy || !mail.to.trim() || !mail.subject.trim() || !mail.message.trim()} onClick={sendMail}>
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Send email
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="support" className="mt-4 space-y-3">
            {tickets.length === 0 && <p className="text-sm text-muted-foreground">No support requests.</p>}
            {tickets.map((t) => (
              <Card key={t.id} className="p-4 text-sm space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{t.subject}</span>
                  <Badge variant={t.status === "open" ? "destructive" : "secondary"}>{t.status}</Badge>
                  <Badge variant="outline">{t.category}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">{fmt(t.created_at)}</span>
                </div>
                <p className="text-muted-foreground break-all">{t.user_name || "—"} · {t.user_email}</p>
                <p className="whitespace-pre-wrap">{t.message}</p>
                {t.admin_reply && <div className="rounded-lg border border-primary/30 bg-primary/10 p-3"><p className="text-xs text-primary mb-1">Your reply · {fmt(t.replied_at)}</p><p className="whitespace-pre-wrap">{t.admin_reply}</p></div>}
                <Textarea rows={3} placeholder="Write a reply" value={replies[t.id] ?? ""} onChange={(e) => setReplies((p) => ({ ...p, [t.id]: e.target.value }))} />
                <div className="flex gap-2">
                  {(["replied", "resolved"] as const).map((st) => (
                    <Button key={st} size="sm" variant={st === "replied" ? "default" : "outline"} disabled={!(replies[t.id] ?? "").trim()} onClick={async () => {
                      const { error } = await rpc("admin_reply_ticket", { p_id: t.id, p_reply: replies[t.id], p_status: st });
                      if (error) { alert("Reply failed"); return; }
                      supabase.functions.invoke("support-email", { body: { event: "replied", ticket_id: t.id } }).catch(() => {});
                      setReplies((p) => ({ ...p, [t.id]: "" })); load();
                    }}>{st === "replied" ? "Send reply" : "Reply & close"}</Button>
                  ))}
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="overview" className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {stats.map(([k, v]) => (
              <Card key={k} className="p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-bold mt-1">{v}</p></Card>
            ))}
          </TabsContent>

          <TabsContent value="users" className="mt-4 space-y-3">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); load(); }}>
              <Input placeholder="Search name, username, email, phone" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button type="submit">Search</Button>
            </form>
            {users.map((u) => (
              <Card key={u.id} className="p-3 text-sm cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openUser(u.id)}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{u.name || u.username || "—"}</span>
                  {u.username && <span className="text-muted-foreground">@{u.username}</span>}
                  {u.is_online && <Badge>online</Badge>}
                  {u.is_banned && <Badge variant="destructive">banned</Badge>}
                  {u.wallet_status && u.wallet_status !== "active" && <Badge variant="secondary">wallet {u.wallet_status}</Badge>}
                </div>
                <p className="text-muted-foreground break-all">{u.email} {u.phone ? `· ${u.phone}` : ""}</p>
                <p className="text-xs text-muted-foreground">Joined {fmt(u.created_at)} · Last sign-in {fmt(u.last_sign_in_at)} · Balance {money(u.wallet_balance)}</p>
              </Card>
            ))}
            {!users.length && <p className="text-muted-foreground text-sm">No users found.</p>}
          </TabsContent>

          <TabsContent value="wallet" className="mt-4 space-y-2">
            {txs.map((t) => (
              <Card key={t.id} className="p-3 text-sm flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{t.type} <Badge variant="secondary" className="ml-1">{t.status}</Badge></p>
                  <p className="text-muted-foreground truncate">{t.user_email} {t.counterparty_name ? `→ ${t.counterparty_name}` : ""}</p>
                  <p className="text-xs text-muted-foreground">{fmt(t.created_at)}</p>
                </div>
                <div className="text-right font-semibold whitespace-nowrap">{money(t.amount)}{Number(t.fee) > 0 && <p className="text-xs text-muted-foreground">fee {money(t.fee)}</p>}</div>
              </Card>
            ))}
            {!txs.length && <p className="text-muted-foreground text-sm">No transactions yet.</p>}
          </TabsContent>

          <TabsContent value="reports" className="mt-4 space-y-2">
            {reports.map((r) => (
              <Card key={r.id} className="p-3 text-sm">
                <p className="font-medium">{r.content_type}: {r.reason}</p>
                <p className="text-muted-foreground break-all">By {r.reporter_email} · {r.content_id}</p>
                <p className="text-xs text-muted-foreground">{fmt(r.reported_at)}</p>
              </Card>
            ))}
            {!reports.length && <p className="text-muted-foreground text-sm">No reports.</p>}
          </TabsContent>
        </Tabs>
      </main>
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {detail && (<>
            <DialogHeader><DialogTitle>{detail.name || detail.username || detail.email}</DialogTitle></DialogHeader>
            <div className="text-sm space-y-1">
              <p className="break-all">{detail.email}{detail.username ? ` · @${detail.username}` : ""}</p>
              {detail.phone && <p>{detail.phone}</p>}
              <p className="text-xs text-muted-foreground">Joined {fmt(detail.created_at)} · Last sign-in {fmt(detail.last_sign_in_at)}</p>
              <div className="flex gap-2 pt-1">
                {detail.is_banned ? <Badge variant="destructive">banned</Badge> : <Badge variant="secondary">active</Badge>}
                {detail.is_online && <Badge>online</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={detail.is_banned ? "outline" : "destructive"} disabled={busy} onClick={() => userAction(detail.is_banned ? "unban" : "ban")}>{detail.is_banned ? "Unban user" : "Ban user"}</Button>
              <Button size="sm" variant="outline" onClick={() => { setMail((m) => ({ ...m, to: detail.email })); setDetail(null); toast("Open the Compose tab to write your email"); }}>Email user</Button>
            </div>
            <Card className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <p className="font-semibold">Wallet</p>
                {detail.wallet ? <>
                  <span className="ml-auto text-lg font-bold">{money(detail.wallet.balance)} {detail.wallet.currency}</span>
                </> : <span className="ml-auto text-xs text-muted-foreground">No wallet yet</span>}
              </div>
              {detail.wallet && <div className="flex gap-2 items-center">
                <Badge variant={detail.wallet.status === "active" ? "secondary" : "destructive"}>{detail.wallet.status}</Badge>
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => walletStatus(detail.wallet.status === "suspended" ? "active" : "suspended")}>{detail.wallet.status === "suspended" ? "Activate wallet" : "Suspend wallet"}</Button>
              </div>}
              <div className="flex gap-2">
                {(["credit", "debit"] as const).map((d) => <Button key={d} size="sm" variant={adj.dir === d ? "default" : "outline"} onClick={() => setAdj((a) => ({ ...a, dir: d }))}>{d === "credit" ? "Add money" : "Remove money"}</Button>)}
              </div>
              <Input type="number" min="0" step="0.01" placeholder="Amount" value={adj.amount} onChange={(e) => setAdj((a) => ({ ...a, amount: e.target.value }))} />
              <Input placeholder="Reason (shown in the user's history)" value={adj.reason} onChange={(e) => setAdj((a) => ({ ...a, reason: e.target.value }))} />
              <Button size="sm" disabled={busy} onClick={adjust}>Apply adjustment</Button>
            </Card>
            <div className="space-y-1">
              <p className="font-semibold text-sm">Recent transactions</p>
              {(detail.transactions ?? []).map((t: Row) => (
                <div key={t.id} className="flex justify-between text-xs border-b border-border py-1 gap-2">
                  <span className="truncate">{t.type} · {t.description || "—"} · {fmt(t.created_at)}</span>
                  <span className="font-medium whitespace-nowrap">{money(t.amount)}</span>
                </div>
              ))}
              {!(detail.transactions ?? []).length && <p className="text-xs text-muted-foreground">None</p>}
            </div>
            {(detail.tickets ?? []).length > 0 && <div className="space-y-1">
              <p className="font-semibold text-sm">Support tickets</p>
              {detail.tickets.map((t: Row) => <p key={t.id} className="text-xs">{t.subject} · {t.status} · {fmt(t.created_at)}</p>)}
            </div>}
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
