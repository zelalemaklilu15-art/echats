// @ts-nocheck
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Loader2, X, Check, AlertCircle, QrCode, Home, CreditCard, History, User, Clock, Shield, Send as SendIcon, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { walletService } from "@/lib/walletService";
import { supabase } from "@/integrations/supabase/client";
import { ChatAvatar } from "@/components/ui/chat-avatar";
import { toast } from "sonner";

/* ─── tokens ─── */
const BG   = "#0D0A1A";
const CARD = "#1A1030";
const P    = "#7C3AED";

interface Contact { id: string; name: string; username: string; avatar_url?: string; is_online?: boolean; last_seen?: string; }

function groupAlpha(contacts: Contact[]): { letter: string; items: Contact[] }[] {
  const map = new Map<string, Contact[]>();
  for (const c of contacts) {
    const l = (c.name || c.username)[0].toUpperCase();
    if (!map.has(l)) map.set(l, []);
    map.get(l)!.push(c);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([letter, items]) => ({ letter, items }));
}

const QUICK_AMOUNTS = [50, 100, 250, 500, 1000, 2000];

const SendMoney = () => {
  const navigate = useNavigate();
  const [step,     setStep]     = useState<"pick" | "amount" | "confirm">("pick");
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<Contact[]>([]);
  const [searching,setSearching]= useState(false);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [amount,   setAmount]   = useState("");
  const [note,     setNote]     = useState("");
  const [balance,  setBalance]  = useState(0);
  const [sending,  setSending]  = useState(false);
  const [recent,   setRecent]   = useState<Contact[]>([]);
  const [allContacts,setAll]    = useState<Contact[]>([]);
  const [schedMode,setSchedMode]= useState(false);
  const [schedDate,setSchedDate]= useState("");
  const [schedTime,setSchedTime]= useState("");

  useEffect(() => {
    walletService.getWalletBalance().then(d => {
      if (d.wallet) setBalance(d.wallet.balance);
      const txns = d.transactions || [];
      const seen = new Map<string, Contact>();
      for (const t of txns) {
        if (t.type !== "transfer_out") continue;
        const m = t.metadata as Record<string, unknown>;
        const id = String(m.recipient_id ?? "");
        const name = String(m.recipient_name ?? m.recipient_username ?? "");
        const username = String(m.recipient_username ?? "");
        if (!id || !name || seen.has(id)) continue;
        seen.set(id, { id, name, username });
        if (seen.size >= 6) break;
      }
      setRecent([...seen.values()]);
    });
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const { data } = await supabase.rpc("search_users_public", { search_term: "" });
        setAll((data || []).slice(0, 50).map((u: any) => ({
          id: u.id, name: u.name || u.username, username: u.username,
          avatar_url: u.avatar_url, is_online: u.is_online, last_seen: u.last_seen,
        })));
      } catch {}
    };
    loadAll();
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await supabase.rpc("search_users_public", { search_term: query });
        setResults((data || []).map((u: any) => ({
          id: u.id, name: u.name || u.username, username: u.username,
          avatar_url: u.avatar_url, is_online: u.is_online, last_seen: u.last_seen,
        })));
      } catch { toast.error("Search failed"); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const numeric = parseFloat(amount) || 0;
  const canSend = numeric > 0 && numeric <= balance;
  const grouped = useMemo(() => groupAlpha(query.length >= 2 ? results : allContacts), [results, allContacts, query]);

  const handleSend = async () => {
    if (!selected || !canSend) return;
    setSending(true);
    try {
      const result = await walletService.transfer(selected.id, numeric, note || undefined);
      if (result.success && result.transaction) {
        navigate("/transaction-receipt", {
          state: { transaction: { type: "sent", amount: result.transaction.amount, recipient: selected.name, transactionId: result.transaction.id, timestamp: result.transaction.created_at, status: result.transaction.status, note: result.transaction.note } },
        });
      } else toast.error(result.error || "Failed to send money");
    } catch { toast.error("Failed. Please try again."); }
    finally { setSending(false); }
  };

  const back = () => {
    if (step === "pick")    navigate("/wallet");
    else if (step === "amount")  setStep("pick");
    else if (step === "confirm") setStep("amount");
  };

  /* ── AVATAR helper ── */
  const Avatar = ({ c, size = 56 }: { c: Contact; size?: number }) => (
    <div className="rounded-full overflow-hidden flex-shrink-0" style={{ width: size, height: size }}>
      <ChatAvatar name={c.name} src={c.avatar_url} size="md" status={isUserOnline(c.last_seen, c.is_online || false) ? "online" : undefined} />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col pb-24" style={{ background: BG }}>

      {/* ── HEADER ── */}
      <div className="flex items-center px-4 pt-12 pb-4">
        <motion.button whileTap={{ scale: 0.88 }} onClick={back}
          className="w-9 h-9 flex items-center justify-center">
          <ArrowLeft style={{ color: "rgba(255,255,255,0.85)", width: 22, height: 22 }} />
        </motion.button>
        <h1 className="flex-1 text-center font-bold text-[18px] text-white">Send Money</h1>
        <motion.button whileTap={{ scale: 0.88 }}
          onClick={() => navigate("/wallet/qr")}
          className="w-9 h-9 flex items-center justify-center">
          <QrCode style={{ color: "rgba(255,255,255,0.6)", width: 20, height: 20 }} />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ── STEP 1: Pick contact ── */}
          {step === "pick" && (
            <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* Search bar */}
              <div className="px-4 pb-5">
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{ background: CARD, border: `1px solid rgba(124,58,237,0.35)` }}>
                  <Search style={{ color: P, width: 18, height: 18, flexShrink: 0 }} />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search username or phone number"
                    className="flex-1 bg-transparent outline-none text-[14px] placeholder-opacity-60"
                    style={{ color: "rgba(255,255,255,0.8)" }}
                    data-testid="input-recipient-search"
                  />
                  {query && (
                    <button onClick={() => { setQuery(""); setResults([]); }}>
                      <X style={{ color: "rgba(255,255,255,0.4)", width: 16, height: 16 }} />
                    </button>
                  )}
                </div>
              </div>

              {/* Recent Recipients */}
              {recent.length > 0 && query.length === 0 && (
                <div className="px-4 pb-6">
                  <p className="font-bold text-[17px] text-white mb-4">Recent Recipients</p>
                  <div className="flex gap-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {recent.map(c => (
                      <motion.button key={c.id} whileTap={{ scale: 0.9 }}
                        onClick={() => { setSelected(c); setStep("amount"); }}
                        className="flex flex-col items-center gap-1.5 flex-shrink-0"
                        data-testid={`recent-${c.username}`}>
                        <div className="w-[60px] h-[60px] rounded-full overflow-hidden"
                          style={{ border: "2px solid rgba(255,255,255,0.12)" }}>
                          <ChatAvatar name={c.name} src={c.avatar_url} size="lg" />
                        </div>
                        <p className="text-[12px] font-medium text-white">{c.name.split(" ")[0]}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* All Contacts / Search results */}
              <div className="px-4">
                <p className="font-bold text-[17px] text-white mb-4">
                  {query.length >= 2 ? "Search Results" : "All Contacts"}
                </p>

                {searching && (
                  <div className="flex justify-center py-10">
                    <Loader2 style={{ color: P, width: 24, height: 24 }} className="animate-spin" />
                  </div>
                )}

                {!searching && grouped.map(({ letter, items }) => (
                  <div key={letter} className="mb-4">
                    <p className="text-[13px] font-bold mb-3" style={{ color: P }}>{letter}</p>
                    <div className="space-y-0">
                      {items.map(c => (
                        <motion.button key={c.id} whileTap={{ scale: 0.99 }}
                          onClick={() => { setSelected(c); setStep("amount"); }}
                          className="flex items-center gap-3 w-full py-3 text-left"
                          data-testid={`contact-${c.username}`}>
                          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                            <ChatAvatar name={c.name} src={c.avatar_url} size="md" status={isUserOnline(c.last_seen, c.is_online || false) ? "online" : undefined} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[15px] text-white truncate">{c.name}</p>
                            <p className="text-[13px] truncate" style={{ color: "rgba(255,255,255,0.4)" }}>@{c.username}</p>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ))}

                {!searching && query.length >= 2 && results.length === 0 && (
                  <div className="text-center py-14">
                    <User style={{ color: "rgba(255,255,255,0.2)", width: 40, height: 40, margin: "0 auto 12px" }} />
                    <p className="font-medium text-[14px] text-white mb-1">No users found</p>
                    <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.4)" }}>No results for "{query}"</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: Enter amount ── */}
          {step === "amount" && selected && (
            <motion.div key="amount" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="px-4 pt-2 pb-6">

              {/* Recipient row */}
              <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-7"
                style={{ background: CARD, border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0">
                  <ChatAvatar name={selected.name} src={selected.avatar_url} size="md" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[15px] text-white">{selected.name}</p>
                  <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>@{selected.username}</p>
                </div>
                <button onClick={() => { setSelected(null); setStep("pick"); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.08)" }}>
                  <X style={{ color: "rgba(255,255,255,0.5)", width: 14, height: 14 }} />
                </button>
              </div>

              {/* Amount input */}
              <div className="flex items-center justify-center gap-2 mb-2">
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0" autoFocus
                  className="text-center bg-transparent border-0 outline-none font-black text-white"
                  style={{ fontSize: 52, letterSpacing: "-0.02em", width: "200px" }}
                  data-testid="input-send-amount" />
                <span className="font-bold" style={{ color: "rgba(255,255,255,0.4)", fontSize: 22 }}>ETB</span>
              </div>
              {numeric > balance && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 justify-center mb-3">
                  <AlertCircle style={{ color: "#f87171", width: 14, height: 14 }} />
                  <span className="text-[12px]" style={{ color: "#f87171" }}>Exceeds balance</span>
                </motion.div>
              )}

              {/* Quick amounts */}
              <div className="flex flex-wrap justify-center gap-2 mt-4 mb-5">
                {QUICK_AMOUNTS.filter(q => q <= balance).map(q => {
                  const active = numeric === q;
                  return (
                    <motion.button key={q} whileTap={{ scale: 0.92 }}
                      onClick={() => setAmount(q.toString())}
                      className="px-5 py-2.5 rounded-full font-bold text-[14px]"
                      style={{
                        background: active ? P : CARD,
                        color: active ? "#fff" : "rgba(255,255,255,0.7)",
                        border: `1px solid ${active ? P : "rgba(255,255,255,0.1)"}`,
                      }}>
                      {q.toLocaleString()}
                    </motion.button>
                  );
                })}
              </div>

              {/* Note */}
              <div className="px-4 py-3 rounded-2xl mb-6"
                style={{ background: CARD, border: "1px solid rgba(255,255,255,0.08)" }}>
                <input value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Add a note (optional)"
                  className="w-full bg-transparent outline-none text-[14px]"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                  data-testid="input-note" />
              </div>

              <motion.button whileTap={{ scale: 0.97 }} disabled={!canSend}
                onClick={() => canSend && setStep("confirm")}
                className="w-full py-4 rounded-full font-bold text-[16px] text-white"
                style={{ background: canSend ? P : "rgba(124,58,237,0.3)", boxShadow: canSend ? "0 6px 24px rgba(124,58,237,0.45)" : "none", opacity: canSend ? 1 : 0.5 }}
                data-testid="button-send-next">
                Continue
              </motion.button>
            </motion.div>
          )}

          {/* ── STEP 3: Confirm ── */}
          {step === "confirm" && selected && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="px-4 pt-2 pb-6">
              <div className="rounded-3xl overflow-hidden mb-4" style={{ background: CARD, border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="px-6 py-6 text-center border-b" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(124,58,237,0.08)" }}>
                  <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-3">
                    <ChatAvatar name={selected.name} src={selected.avatar_url} size="xl" />
                  </div>
                  <p className="text-[12px] mb-1" style={{ color: "rgba(255,255,255,0.45)" }}>Sending to</p>
                  <p className="font-bold text-[17px] text-white">{selected.name}</p>
                  <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>@{selected.username}</p>
                </div>
                <div className="px-6 py-5 text-center border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <p className="font-black text-[44px] text-white leading-none">
                    {numeric.toLocaleString()} <span className="text-[22px] font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>ETB</span>
                  </p>
                  {note && <p className="text-[13px] mt-2 italic" style={{ color: "rgba(255,255,255,0.4)" }}>"{note}"</p>}
                </div>
                {[
                  { label: "Transaction Fee", value: "Free" },
                  { label: "Balance After", value: `${(balance - numeric).toLocaleString("en-ET", { minimumFractionDigits: 2 })} ETB` },
                  { label: "Processing", value: "Instant" },
                ].map((row, i, arr) => (
                  <div key={row.label} className="flex items-center justify-between px-5 py-3.5"
                    style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                    <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.5)" }}>{row.label}</span>
                    <span className="text-[13px] font-bold text-white">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Schedule toggle */}
              <div className="rounded-2xl px-4 py-3.5 mb-4" style={{ background: CARD, border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(124,58,237,0.2)" }}>
                      <Clock style={{ color: P, width: 16, height: 16 }} />
                    </div>
                    <span className="text-[13px] font-semibold text-white">Schedule for later</span>
                  </div>
                  <button onClick={() => { setSchedMode(!schedMode); if (!schedMode) { const t = new Date(Date.now() + 86400000); setSchedDate(t.toISOString().split("T")[0]); setSchedTime("09:00"); } }}
                    className="w-11 h-6 rounded-full relative transition-colors"
                    style={{ background: schedMode ? P : "rgba(255,255,255,0.15)" }}>
                    <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                      style={{ left: schedMode ? "22px" : "2px" }} />
                  </button>
                </div>
                <AnimatePresence>
                  {schedMode && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-3.5 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>Date</p>
                          <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                            className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none text-white"
                            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }} />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>Time</p>
                          <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)}
                            className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none text-white"
                            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-2 rounded-2xl px-4 py-3 mb-5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Shield style={{ color: "rgba(255,255,255,0.4)", width: 16, height: 16, flexShrink: 0 }} />
                <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {schedMode ? "Payment will be processed automatically at the scheduled time" : "Once sent, this transaction cannot be reversed"}
                </p>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} disabled={sending}
                onClick={() => {
                  if (schedMode && schedDate && schedTime) {
                    const scheduledAt = new Date(`${schedDate}T${schedTime}`);
                    if (scheduledAt <= new Date()) { toast.error("Please choose a future date and time"); return; }
                    const payments = JSON.parse(localStorage.getItem("echat_scheduled_payments") || "[]");
                    payments.unshift({ id: `sp_${Date.now()}`, toUserId: selected?.id || "", toName: selected?.name || "", amount: numeric, note: note || undefined, scheduledAt: scheduledAt.toISOString(), status: "pending" });
                    localStorage.setItem("echat_scheduled_payments", JSON.stringify(payments));
                    toast.success(`Payment of ${numeric.toLocaleString()} ETB scheduled`);
                    navigate("/scheduled-payments");
                  } else { handleSend(); }
                }}
                className="w-full py-4 rounded-full font-bold text-[16px] text-white flex items-center justify-center gap-2"
                style={{ background: P, boxShadow: "0 6px 24px rgba(124,58,237,0.45)", opacity: sending ? 0.7 : 1 }}
                data-testid="button-confirm-send">
                {sending
                  ? <><Loader2 style={{ width: 18, height: 18 }} className="animate-spin" /> Sending…</>
                  : schedMode
                  ? <><Calendar style={{ width: 18, height: 18 }} /> Schedule Payment</>
                  : `Send ${numeric.toLocaleString()} ETB`
                }
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto"
        style={{ background: BG, borderTop: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 -8px 32px rgba(0,0,0,0.45)" }}>
        <div className="flex items-end justify-around px-2" style={{ height: 68 }}>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/wallet")}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full">
            <Home style={{ color: "rgba(255,255,255,0.38)", width: 22, height: 22 }} />
            <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.38)" }}>HOME</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/wallet")}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full">
            <CreditCard style={{ color: "rgba(255,255,255,0.38)", width: 22, height: 22 }} />
            <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.38)" }}>CARDS</span>
          </motion.button>
          {/* Center SEND */}
          <div className="flex-1 flex items-start justify-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ marginTop: -22, background: `linear-gradient(135deg, ${P}, #a855f7)`, boxShadow: `0 4px 20px rgba(124,58,237,0.6), 0 0 0 4px ${BG}` }}>
              <SendIcon style={{ color: "#fff", width: 22, height: 22 }} />
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/transaction-history")}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full">
            <History style={{ color: "rgba(255,255,255,0.38)", width: 22, height: 22 }} />
            <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.38)" }}>HISTORY</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/profile")}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full">
            <User style={{ color: "rgba(255,255,255,0.38)", width: 22, height: 22 }} />
            <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.38)" }}>PROFILE</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default SendMoney;
