import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import NotFound from "@/pages/NotFound";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, Shield } from "lucide-react";

type Overview = Record<string, number>;
type Row = Record<string, any>;
const rpc = supabase.rpc as unknown as (fn: string, args?: object) => Promise<{ data: any; error: any }>;

const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : "—");
const money = (n?: number | null) => (n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }));

export default function SuperAdmin() {
  const { user } = useAuth();
  const [state, setState] = useState<"checking" | "denied" | "ok">("checking");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<Row[]>([]);
  const [txs, setTxs] = useState<Row[]>([]);
  const [reports, setReports] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setState("checking");
    if (!user) { setState("denied"); return; }
    rpc("is_super_admin").then(({ data, error }) => {
      if (alive) setState(!error && data === true ? "ok" : "denied");
    });
    return () => { alive = false; };
  }, [user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, u, t, r] = await Promise.all([
      rpc("admin_overview"),
      rpc("admin_list_users", { p_search: search || null, p_limit: 100 }),
      rpc("admin_recent_transactions", { p_limit: 100 }),
      rpc("admin_list_reports", { p_limit: 100 }),
    ]);
    if (o.error) { setState("denied"); setLoading(false); return; }
    setOverview(o.data); setUsers(u.data ?? []); setTxs(t.data ?? []); setReports(r.data ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => { if (state === "ok") load(); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === "checking") return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (state === "denied") return <NotFound />;

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
          </TabsList>

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
              <Card key={u.id} className="p-3 text-sm">
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
    </div>
  );
}
