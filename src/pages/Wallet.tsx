// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye, EyeOff, Plus, ArrowUpRight, ArrowDownLeft,
  RefreshCw, Loader2, Bell, QrCode,
  Copy, Check, Send, History, ArrowRightLeft,
  Clock, Star, Target, Link as LinkIcon, ChevronRight, Zap,
  TrendingUp, TrendingDown, ChevronDown,
  Home, Wallet as WalletIcon, BarChart2, User,
} from "lucide-react";
import { getStarsBalance, refreshStarsBalance } from "@/lib/giftsService";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { walletService, type WalletData, type WalletTransaction } from "@/lib/walletService";
import { getPaymentRequests, type PaymentRequest } from "./RequestMoney";
import { useAuth } from "@/contexts/AuthContext";
import WalletTerms from "@/components/WalletTerms";
import { toast } from "sonner";

/* ─── Design tokens ─── */
const P        = "#7C3AED";
const BG       = "#0D0A1A";
const CARD_BG  = "#150D28";
const CARD_BG2 = "#1C1130";

/* ─── Transaction type config ─── */
const TXN_CFG: Record<string, { label: string; color: string; bg: string; isIn: boolean; statusText: string }> = {
  transfer_in:  { label: "Received",    color: "#4ade80", bg: "rgba(74,222,128,0.15)",  isIn: true,  statusText: "Completed" },
  deposit:      { label: "Added Money", color: "#4ade80", bg: "rgba(74,222,128,0.15)",  isIn: true,  statusText: "Completed" },
  transfer_out: { label: "Sent",        color: "#f87171", bg: "rgba(248,113,113,0.15)", isIn: false, statusText: "Completed" },
  withdrawal:   { label: "Withdrawal",  color: "#fb923c", bg: "rgba(251,146,60,0.15)",  isIn: false, statusText: "Processing" },
  adjustment:   { label: "Adjustment",  color: "#60a5fa", bg: "rgba(96,165,250,0.15)",  isIn: true,  statusText: "Completed" },
};

const STATUS_COLOR: Record<string, string> = {
  completed: "#4ade80",
  pending:   "#fbbf24",
  failed:    "#f87171",
  reversed:  "#fb923c",
};

/* ─── Helpers ─── */
function formatETB(n: number) {
  return n.toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortNum(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(0);
}

function shortDate(s: string) {
  const d = new Date(s);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function cardLast4(id: string) {
  const h = Math.abs([...id].reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0));
  return String(h).padStart(4, "0").slice(-4);
}

function buildChartData(txns: WalletTransaction[]) {
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  const result: { day: string; income: number; expense: number; date: Date }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    result.push({ day: DAYS[d.getDay()], income: 0, expense: 0, date: d });
  }
  for (const t of txns) {
    const td = new Date(t.created_at); td.setHours(0, 0, 0, 0);
    const slot = result.find(r => r.date.getTime() === td.getTime());
    if (!slot) continue;
    if (["transfer_in", "deposit", "adjustment"].includes(t.type)) slot.income += t.amount;
    else if (["transfer_out", "withdrawal"].includes(t.type)) slot.expense += t.amount;
  }
  return result.map(({ day, income, expense }) => ({ day, income: Math.round(income), expense: Math.round(expense) }));
}

interface QuickContact { id: string; name: string; username: string; }

function buildQuickContacts(txns: WalletTransaction[]): QuickContact[] {
  const seen = new Map<string, QuickContact>();
  for (const t of txns) {
    if (t.type !== "transfer_out") continue;
    const m = t.metadata as Record<string, unknown>;
    const id = String(m.recipient_id ?? "");
    const name = String(m.recipient_name ?? m.recipient_username ?? "");
    const username = String(m.recipient_username ?? "");
    if (!id || !name || seen.has(id)) continue;
    seen.set(id, { id, name, username });
    if (seen.size >= 5) break;
  }
  return [...seen.values()];
}

/* ─── Wallet component ─── */
const Wallet = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";
  const firstName = (user as any)?.user_metadata?.name?.split(" ")[0]
    || user?.email?.split("@")[0] || "there";

  const [showBal, setShowBal]         = useState(true);
  const [wallet, setWallet]           = useState<WalletData | null>(null);
  const [txns, setTxns]               = useState<WalletTransaction[]>([]);
  const [stats, setStats]             = useState({ monthly_received: 0, monthly_sent: 0 });
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [needsAct, setNeedsAct]       = useState(false);
  const [showTerms, setShowTerms]     = useState(false);
  const [copied, setCopied]           = useState(false);
  const [pendingReqs, setPendingReqs] = useState<PaymentRequest[]>([]);
  const [stars, setStars]             = useState(getStarsBalance());

  const load = useCallback(async (force = false) => {
    try {
      const d = await walletService.getWalletBalance(force);
      setWallet(d.wallet);
      setTxns((d.transactions || []).slice(0, 50));
      setStats(d.stats || { monthly_received: 0, monthly_sent: 0 });
      setNeedsAct(d.needs_activation || !d.wallet);
    } catch { toast.error("Failed to load wallet"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { refreshStarsBalance().then(setStars).catch(() => {}); }, []);
  useEffect(() => {
    const fn = () => load(true);
    window.addEventListener("focus", fn); return () => window.removeEventListener("focus", fn);
  }, [load]);
  useEffect(() => {
    if (!currentUserId) return;
    setPendingReqs(getPaymentRequests(currentUserId).filter(r => r.status === "pending"));
  }, [currentUserId]);

  const doCopy = () => {
    if (!wallet) return;
    navigator.clipboard.writeText(wallet.id).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success("Wallet ID copied");
  };

  if (showTerms) return (
    <WalletTerms onAccepted={() => { setShowTerms(false); setNeedsAct(false); load(true); }} onCancel={() => setShowTerms(false)} />
  );

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: BG }}>
      <div className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
          <Loader2 style={{ color: P, width: 28, height: 28 }} />
        </motion.div>
      </div>
      <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>Loading wallet…</p>
    </div>
  );

  const chartData     = buildChartData(txns);
  const contacts      = buildQuickContacts(txns);
  const balance       = wallet?.balance ?? 0;
  const recentTxns    = txns.slice(0, 8);
  const last4         = wallet ? cardLast4(wallet.id) : "0000";
  const weekIncome    = chartData.reduce((s, d) => s + d.income, 0);
  const weekExpense   = chartData.reduce((s, d) => s + d.expense, 0);

  /* Action circles */
  const ACTIONS = [
    { icon: Plus,          label: "Add",       fn: () => needsAct ? setShowTerms(true) : navigate("/add-money")       },
    { icon: Send,          label: "Send",      fn: () => needsAct ? setShowTerms(true) : navigate("/send-money")      },
    { icon: ArrowDownLeft, label: "Request",   fn: () => needsAct ? setShowTerms(true) : navigate("/request-money")   },
    { icon: QrCode,        label: "QR Pay",    fn: () => needsAct ? setShowTerms(true) : navigate("/wallet/qr")       },
    { icon: History,       label: "History",   fn: () => navigate("/transaction-history")                              },
    { icon: Clock,         label: "Scheduled", fn: () => navigate("/scheduled-payments")                              },
    { icon: Target,        label: "Goals",     fn: () => navigate("/savings-goals")                                   },
    { icon: LinkIcon,      label: "Pay Link",  fn: () => needsAct ? setShowTerms(true) : navigate("/payment-request") },
  ];

  return (
    <div className="min-h-screen pb-28 select-none" style={{ background: BG }}>

      {/* ─── HEADER ─── */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{ background: `${BG}EE`, backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-[16px] text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #7C3AED, #a855f7)" }}>
            {firstName[0].toUpperCase()}
          </div>
          <div>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Welcome back,</p>
            <p className="text-[15px] font-bold text-white leading-tight capitalize">{firstName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setRefreshing(true) || load(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <motion.div animate={refreshing ? { rotate: 360 } : {}} transition={{ duration: 0.7, repeat: refreshing ? Infinity : 0, ease: "linear" }}>
              <RefreshCw style={{ color: "rgba(255,255,255,0.5)", width: 15, height: 15 }} />
            </motion.div>
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/wallet/settings")}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Bell style={{ color: "rgba(255,255,255,0.5)", width: 15, height: 15 }} />
          </motion.button>
        </div>
      </div>

      {/* ─── BANNERS ─── */}
      <AnimatePresence>
        {needsAct && (
          <motion.button initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            onClick={() => setShowTerms(true)} className="w-full flex items-center gap-3 px-4 py-3 text-left"
            style={{ background: "rgba(251,191,36,0.07)", borderBottom: "1px solid rgba(251,191,36,0.18)" }}
            data-testid="banner-activate-wallet">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(251,191,36,0.18)" }}>
              <Zap style={{ color: "#fbbf24", width: 16, height: 16 }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Activate your wallet</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Accept terms to unlock all features</p>
            </div>
            <ChevronRight style={{ color: "#fbbf24", width: 16, height: 16 }} />
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {pendingReqs.length > 0 && (
          <motion.button initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            onClick={() => navigate("/request-money")} className="w-full flex items-center gap-3 px-4 py-3 text-left"
            style={{ background: "rgba(96,165,250,0.07)", borderBottom: "1px solid rgba(96,165,250,0.15)" }}
            data-testid="banner-pending-requests">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(96,165,250,0.18)" }}>
              <Clock style={{ color: "#60a5fa", width: 16, height: 16 }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{pendingReqs.length} pending request{pendingReqs.length > 1 ? "s" : ""}</p>
              <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                {pendingReqs.map(r => `${r.amount.toLocaleString()} ETB from @${r.toUsername}`).slice(0, 2).join(", ")}
              </p>
            </div>
            <ChevronRight style={{ color: "#60a5fa", width: 16, height: 16 }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ─── BALANCE CARD ─── */}
      <div className="px-4 pt-4 pb-4">
        <motion.div
          initial={{ y: 18, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="relative rounded-3xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #2D0A8A 0%, #6B1FD4 35%, #9B35EA 65%, #5B10C4 100%)",
            boxShadow: "0 20px 60px rgba(107,31,212,0.55), 0 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.12)",
            minHeight: 185,
          }}
        >
          {/* Bright orb top-right */}
          <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(200,100,255,0.45) 0%, transparent 70%)" }} />
          {/* Subtle bottom-left glow */}
          <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(80,20,180,0.35) 0%, transparent 70%)" }} />
          {/* Dot grid texture */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.07]"
            style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />

          <div className="relative p-5">
            {/* Top row: MAIN BALANCE + eye | card icon */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setShowBal(v => !v)} className="flex items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.55)" }}>
                  MAIN BALANCE
                </p>
                {showBal
                  ? <Eye style={{ color: "rgba(255,255,255,0.5)", width: 14, height: 14 }} />
                  : <EyeOff style={{ color: "rgba(255,255,255,0.5)", width: 14, height: 14 }} />}
              </button>
              {/* Credit card icon */}
              <div className="w-9 h-6 rounded-md flex items-end justify-end px-1 pb-0.5"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}>
                <div className="w-4 h-1.5 rounded-sm" style={{ background: "rgba(255,255,255,0.5)" }} />
              </div>
            </div>

            {/* Balance amount */}
            <AnimatePresence mode="wait">
              {showBal ? (
                <motion.div key="vis" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-3">
                  <p className="font-black text-white leading-none" style={{ fontSize: 34, letterSpacing: "-0.02em" }}>
                    {formatETB(needsAct ? 0 : balance)}{" "}
                    <span className="text-[20px] font-bold" style={{ color: "rgba(255,255,255,0.65)" }}>ETB</span>
                  </p>
                  {!needsAct && balance > 0 && (
                    <p className="text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                      ≈ ${(balance / 57.5).toFixed(2)} USD
                    </p>
                  )}
                </motion.div>
              ) : (
                <motion.div key="hid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-3">
                  <p className="font-black text-white tracking-widest" style={{ fontSize: 28 }}>••••••••</p>
                  <p className="text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>Balance hidden</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Card number row */}
            <div className="flex items-center justify-between mt-1">
              <p className="font-mono text-[14px]" style={{ color: "rgba(255,255,255,0.55)", letterSpacing: "0.14em" }}>
                {showBal ? `**** **** **** ${last4}` : "•••• •••• •••• ••••"}
              </p>
              <div className="flex items-center gap-2">
                {wallet && (
                  <motion.button whileTap={{ scale: 0.88 }} onClick={doCopy}
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.12)" }} data-testid="button-copy-card">
                    {copied
                      ? <Check style={{ color: "#4ade80", width: 13, height: 13 }} />
                      : <Copy style={{ color: "rgba(255,255,255,0.55)", width: 13, height: 13 }} />}
                  </motion.button>
                )}
                {/* Mastercard circles */}
                <div className="flex -space-x-2.5">
                  <div className="w-7 h-7 rounded-full" style={{ background: "#EB001B", opacity: 0.85 }} />
                  <div className="w-7 h-7 rounded-full" style={{ background: "#F79E1B", opacity: 0.85 }} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ─── QUICK ACTION CIRCLES ─── */}
      <div className="px-4 pb-5">
        <div className="grid grid-cols-4 gap-y-4 gap-x-1">
          {ACTIONS.map((a, i) => (
            <motion.button key={a.label}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              whileTap={{ scale: 0.84 }}
              onClick={a.fn}
              className="flex flex-col items-center gap-2"
              data-testid={`button-wallet-${a.label.toLowerCase().replace(" ", "-")}`}
            >
              {/* CIRCLE — not square */}
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)" }}>
                <a.icon style={{ color: "rgba(255,255,255,0.75)", width: 22, height: 22 }} />
              </div>
              <span className="text-[10.5px] font-semibold text-center" style={{ color: "rgba(255,255,255,0.45)" }}>{a.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ─── STARS & GIFTS ─── */}
      <div className="px-4 pb-5">
        <div className="rounded-2xl flex items-center gap-3 px-4 py-3.5"
          style={{ background: CARD_BG2, border: "1px solid rgba(124,58,237,0.22)" }}>
          {/* Star circle icon */}
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.35)" }}>
            <Star style={{ color: "#a78bfa", width: 18, height: 18 }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-white">Stars & Gifts</p>
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>{stars.toLocaleString()} Stars available</p>
          </div>
          <motion.button whileTap={{ scale: 0.92 }} onClick={() => navigate("/buy-stars")}
            className="px-4 py-2 rounded-xl font-bold text-[13px] text-white flex-shrink-0"
            style={{ background: P, boxShadow: "0 4px 14px rgba(124,58,237,0.45)" }}
            data-testid="button-buy-stars-wallet">
            Redeem
          </motion.button>
        </div>
      </div>

      {/* ─── QUICK SEND ─── */}
      <div className="px-4 pb-5">
        <div className="flex items-center justify-between mb-3.5">
          <p className="font-bold text-[15px] text-white">Quick Send</p>
          <button onClick={() => navigate("/send-money")} className="text-[13px] font-semibold" style={{ color: P }}>View All</button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {/* New button */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/send-money")}
            className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed rgba(255,255,255,0.18)" }}>
              <Plus style={{ color: "rgba(255,255,255,0.35)", width: 20, height: 20 }} />
            </div>
            <p className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>New</p>
          </motion.button>

          {contacts.map(c => (
            <motion.button key={c.id} whileTap={{ scale: 0.88 }}
              onClick={() => navigate(`/send-money?to=${c.id}`)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
              data-testid={`quick-send-${c.id}`}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-[20px] font-black text-white"
                style={{
                  background: "linear-gradient(135deg, #6D28D9, #a855f7)",
                  boxShadow: "0 4px 14px rgba(124,58,237,0.45)",
                }}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <p className="text-[11px] font-medium max-w-[56px] truncate text-center"
                style={{ color: "rgba(255,255,255,0.5)" }}>
                {c.name.split(" ")[0]}
              </p>
            </motion.button>
          ))}

          {contacts.length === 0 && (
            <p className="text-[13px] py-4" style={{ color: "rgba(255,255,255,0.25)" }}>
              Send to someone to see them here
            </p>
          )}
        </div>
      </div>

      {/* ─── ACTIVITY CHART ─── */}
      <div className="px-4 pb-5">
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD_BG2, border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between px-4 pt-4 pb-1">
            <div>
              <p className="font-bold text-[15px] text-white">Activity</p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.38)" }}>Last 7 days performance</p>
            </div>
            <button className="flex items-center gap-1" style={{ color: P }}>
              <span className="text-[13px] font-semibold">Weekly</span>
              <ChevronDown style={{ width: 14, height: 14 }} />
            </button>
          </div>

          {chartData.every(d => d.income === 0 && d.expense === 0) ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <ArrowRightLeft style={{ color: "rgba(255,255,255,0.12)", width: 32, height: 32 }} />
              <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.25)" }}>No activity this week</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={115}>
              <AreaChart data={chartData} margin={{ left: -28, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.28)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.28)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#1C1130", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12, color: "#fff" }}
                  formatter={(v: number) => [`${v.toLocaleString()} ETB`]}
                />
                <Area type="monotone" dataKey="income" stroke="#7C3AED" fill="url(#purpleGrad)"
                  strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#7C3AED", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {/* Income / Expense stat bars */}
          <div className="flex items-center gap-3 px-4 py-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 flex-1">
              <div className="h-2 flex-1 max-w-[50px] rounded-full" style={{ background: "#4ade80" }} />
              <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>Income</p>
              <p className="text-[13px] font-bold" style={{ color: "#4ade80" }}>+{shortNum(weekIncome)}</p>
            </div>
            <div className="w-px h-5" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="flex items-center gap-2 flex-1 justify-end">
              <p className="text-[13px] font-bold" style={{ color: "#f87171" }}>-{shortNum(weekExpense)}</p>
              <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>Expense</p>
              <div className="h-2 flex-1 max-w-[50px] rounded-full" style={{ background: "#f87171" }} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── RECENT TRANSACTIONS ─── */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-[15px] text-white">Recent Transactions</p>
          <button onClick={() => navigate("/transaction-history")}
            className="text-[13px] font-semibold" style={{ color: P }} data-testid="button-view-all-txns">
            See All
          </button>
        </div>

        {recentTxns.length === 0 ? (
          <div className="rounded-2xl flex flex-col items-center py-12 gap-4"
            style={{ background: CARD_BG2, border: "1px solid rgba(255,255,255,0.07)" }}>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2.5 }}>
              <ArrowRightLeft style={{ color: "rgba(255,255,255,0.12)", width: 40, height: 40 }} />
            </motion.div>
            <p className="text-[14px] font-medium text-white">No transactions yet</p>
            <p className="text-[12px] text-center max-w-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              {needsAct ? "Activate your wallet to get started" : "Add money or send to get started"}
            </p>
            {needsAct && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowTerms(true)}
                className="mt-1 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white"
                style={{ background: P, boxShadow: "0 4px 14px rgba(124,58,237,0.4)" }}>
                Activate Wallet
              </motion.button>
            )}
          </div>
        ) : (
          /* ── Each transaction is its own card ── */
          <div className="space-y-2.5">
            {recentTxns.map((t, i) => {
              const cfg = TXN_CFG[t.type] ?? { label: t.type, color: "#fff", bg: "rgba(255,255,255,0.1)", isIn: false, statusText: t.status };
              const meta = t.metadata as Record<string, unknown>;
              const counterparty = cfg.isIn
                ? (meta.sender_name ? String(meta.sender_name) : null)
                : (meta.recipient_name ? String(meta.recipient_name) : null);
              const statusCol = STATUS_COLOR[t.status] ?? "#888";
              const statusLabel = t.status === "completed" ? cfg.statusText : t.status.charAt(0).toUpperCase() + t.status.slice(1);

              return (
                <motion.button
                  key={t.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate(`/transaction-detail/${t.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left rounded-2xl transition-colors"
                  style={{ background: CARD_BG2, border: "1px solid rgba(255,255,255,0.06)" }}
                  data-testid={`txn-row-${t.id}`}
                >
                  {/* Colored icon box */}
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg }}>
                    {cfg.isIn
                      ? <ArrowDownLeft style={{ color: cfg.color, width: 20, height: 20 }} />
                      : <ArrowUpRight  style={{ color: cfg.color, width: 20, height: 20 }} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-white truncate">
                      {counterparty ?? (t.description || cfg.label)}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
                      {shortDate(t.created_at)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-[15px]" style={{ color: cfg.color }}>
                      {cfg.isIn ? "+" : "−"}{formatETB(t.amount)}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: statusCol }}>
                      {statusLabel}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── MONTHLY STATS ─── */}
      <div className="px-4 mt-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4" style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.14)" }}>
            <div className="flex items-center justify-between mb-2">
              <TrendingUp style={{ color: "#4ade80", width: 16, height: 16 }} />
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>This month</span>
            </div>
            <p className="font-black text-[20px] leading-tight" style={{ color: "#4ade80" }}>+{formatETB(stats.monthly_received)}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>Money In</p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.14)" }}>
            <div className="flex items-center justify-between mb-2">
              <TrendingDown style={{ color: "#f87171", width: 16, height: 16 }} />
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>This month</span>
            </div>
            <p className="font-black text-[20px] leading-tight" style={{ color: "#f87171" }}>-{formatETB(stats.monthly_sent)}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>Money Out</p>
          </div>
        </div>
      </div>

      {/* ─── WALLET BOTTOM NAVIGATION ─── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto"
        style={{
          background: "#0D0A1A",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.45)",
        }}>
        <div className="flex items-end justify-around px-2 pb-safe" style={{ height: 68 }}>

          {/* HOME */}
          <motion.button whileTap={{ scale: 0.88 }}
            onClick={() => navigate("/wallet")}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full"
            data-testid="wallet-nav-home">
            <Home style={{ color: "rgba(255,255,255,0.38)", width: 22, height: 22 }} />
            <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.38)" }}>HOME</span>
          </motion.button>

          {/* WALLET — active */}
          <motion.button whileTap={{ scale: 0.88 }}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full"
            data-testid="wallet-nav-wallet">
            <WalletIcon style={{ color: "#fff", width: 22, height: 22 }} />
            <span className="text-[10px] font-bold text-white">WALLET</span>
          </motion.button>

          {/* QR — center raised button */}
          <div className="flex-1 flex items-start justify-center" style={{ paddingTop: 0 }}>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate("/wallet/qr")}
              className="flex items-center justify-center rounded-full"
              style={{
                width: 58,
                height: 58,
                marginTop: -22,
                background: `linear-gradient(135deg, #6D28D9, #9333EA)`,
                boxShadow: `0 4px 20px rgba(124,58,237,0.6), 0 0 0 4px #0D0A1A`,
              }}
              data-testid="wallet-nav-qr">
              <QrCode style={{ color: "#fff", width: 24, height: 24 }} />
            </motion.button>
          </div>

          {/* INSIGHTS */}
          <motion.button whileTap={{ scale: 0.88 }}
            onClick={() => navigate("/transaction-history")}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full"
            data-testid="wallet-nav-insights">
            <BarChart2 style={{ color: "rgba(255,255,255,0.38)", width: 22, height: 22 }} />
            <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.38)" }}>INSIGHTS</span>
          </motion.button>

          {/* PROFILE */}
          <motion.button whileTap={{ scale: 0.88 }}
            onClick={() => navigate("/profile")}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full"
            data-testid="wallet-nav-profile">
            <User style={{ color: "rgba(255,255,255,0.38)", width: 22, height: 22 }} />
            <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.38)" }}>PROFILE</span>
          </motion.button>

        </div>
      </div>
    </div>
  );
};

export default Wallet;
