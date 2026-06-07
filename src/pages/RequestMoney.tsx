// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, ArrowDownLeft, Loader2, X, User, Copy, Check, QrCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChatAvatar } from "@/components/ui/chat-avatar";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Contact { id: string; name: string; username: string; avatar_url?: string; is_online?: boolean; last_seen?: string; }

export interface PaymentRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  toUsername: string;
  toName: string;
  amount: number;
  reason: string;
  status: "pending" | "fulfilled" | "cancelled";
  createdAt: string;
}

export function getPaymentRequests(userId: string): PaymentRequest[] {
  try {
    return JSON.parse(localStorage.getItem(`echat_payment_requests_${userId}`) || "[]");
  } catch { return []; }
}

function savePaymentRequests(userId: string, requests: PaymentRequest[]) {
  localStorage.setItem(`echat_payment_requests_${userId}`, JSON.stringify(requests));
}

const QUICK = [50, 100, 250, 500, 1000, 2000];

const RequestMoney = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";

  const [step, setStep]           = useState<"pick" | "amount" | "done">("pick");
  const [query, setQuery]         = useState("");
  const [contacts, setContacts]   = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected]   = useState<Contact | null>(null);
  const [amount, setAmount]       = useState("");
  const [reason, setReason]       = useState("");
  const [copied, setCopied]       = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [lastRequest, setLastRequest] = useState<PaymentRequest | null>(null);

  useEffect(() => {
    if (query.length < 2) { setContacts([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase.rpc("search_users_public", { search_term: query });
        if (error) throw error;
        setContacts((data || []).map((u: any) => ({
          id: u.id, name: u.name || u.username, username: u.username,
          avatar_url: u.avatar_url, is_online: u.is_online, last_seen: u.last_seen,
        })));
      } catch { toast.error("Search failed"); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const numeric = parseFloat(amount) || 0;

  const handleRequest = () => {
    if (!selected || numeric <= 0) return;
    const req: PaymentRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fromUserId: currentUserId,
      toUserId: selected.id,
      toUsername: selected.username,
      toName: selected.name,
      amount: numeric,
      reason: reason.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    const existing = getPaymentRequests(currentUserId);
    savePaymentRequests(currentUserId, [...existing, req]);
    setLastRequest(req);
    setStep("done");
    toast.success(`Request for ${numeric.toLocaleString()} ETB sent to @${selected.username}`);
  };

  const requestLink = lastRequest
    ? `https://echat.app/pay/@${lastRequest.toUsername}?amount=${lastRequest.amount}&reason=${encodeURIComponent(lastRequest.reason)}&ref=${lastRequest.id}`
    : "";

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(requestLink).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success("Request link copied!");
  };

  const handleCopyId = async () => {
    if (!lastRequest) return;
    await navigator.clipboard.writeText(lastRequest.id).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Request ID copied");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => {
              if (step === "pick") navigate("/wallet");
              else if (step === "amount") setStep("pick");
              else navigate("/wallet");
            }}
            className="w-9 h-9 rounded-full bg-card border border-border/50 flex items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-bold text-[17px]">Request Money</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── STEP 1: Pick contact ── */}
        {step === "pick" && (
          <div className="px-4 pt-5">
            <p className="text-muted-foreground text-[13px] mb-4">Who are you requesting from?</p>
            <div className="flex items-center gap-2 bg-muted rounded-2xl px-4 py-3 mb-4">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search by name or @username"
                className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-muted-foreground"
                data-testid="input-request-search"
              />
              {query && (
                <button onClick={() => { setQuery(""); setContacts([]); }}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {searching && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!searching && contacts.length > 0 && (
              <div className="rounded-2xl bg-card border border-border/50 overflow-hidden divide-y divide-border/50 mb-4">
                {contacts.map(c => (
                  <motion.button
                    key={c.id} whileTap={{ scale: 0.98 }}
                    onClick={() => { setSelected(c); setStep("amount"); }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-muted/30 transition-colors"
                    data-testid={`request-contact-${c.username}`}
                  >
                    <ChatAvatar name={c.name} src={c.avatar_url} size="md" status={isUserOnline(c.last_seen, c.is_online || false) ? "online" : undefined} />
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-[14px]">{c.name}</p>
                      <p className="text-muted-foreground text-[12px]">@{c.username}</p>
                    </div>
                    <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
                  </motion.button>
                ))}
              </div>
            )}
            {!searching && query.length >= 2 && contacts.length === 0 && (
              <div className="text-center py-8">
                <User className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-muted-foreground text-[13px]">No users found for "{query}"</p>
              </div>
            )}
            {query.length === 0 && (
              <div className="text-center py-12">
                <Search className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-[13px]">Type to search Echat users</p>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Amount + reason ── */}
        {step === "amount" && selected && (
          <div className="px-4 pt-6 pb-6">
            {/* Selected pill */}
            <div className="flex items-center gap-3 bg-card border border-border/50 rounded-2xl px-4 py-3 mb-6">
              <ChatAvatar name={selected.name} src={selected.avatar_url} size="md" status={isUserOnline(selected.last_seen, selected.is_online || false) ? "online" : undefined} />
              <div className="flex-1">
                <p className="font-semibold text-[14px]">{selected.name}</p>
                <p className="text-muted-foreground text-[12px]">@{selected.username}</p>
              </div>
              <button onClick={() => { setSelected(null); setStep("pick"); }} className="p-1.5 rounded-full bg-muted">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Big amount input */}
            <div className="flex items-end justify-center gap-3 mb-3">
              <input
                type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0" autoFocus
                className="text-center text-[52px] font-black bg-transparent border-0 outline-none w-48 text-foreground placeholder:text-muted-foreground/30"
                data-testid="input-request-amount"
              />
              <span className="text-[24px] font-bold text-muted-foreground mb-2">ETB</span>
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {QUICK.map(q => (
                <motion.button key={q} whileTap={{ scale: 0.95 }} onClick={() => setAmount(q.toString())}
                  className={cn("py-2.5 rounded-xl text-[13px] font-semibold border transition-colors",
                    numeric === q ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>
                  {q.toLocaleString()} ETB
                </motion.button>
              ))}
            </div>

            {/* Reason */}
            <div className="bg-muted rounded-2xl px-4 py-3 mb-5">
              <input
                value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Reason for request (optional)"
                className="w-full bg-transparent outline-none text-[14px] placeholder:text-muted-foreground"
                data-testid="input-request-reason"
              />
            </div>

            {/* Summary card */}
            {numeric > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card border border-border/50 overflow-hidden mb-5">
                <div className="divide-y divide-border/50">
                  {[
                    { label: "Requesting From", value: `${selected.name} (@${selected.username})` },
                    { label: "Amount", value: `${numeric.toLocaleString()} ETB` },
                    { label: "Processing", value: "Instant notification" },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-3">
                      <span className="text-[13px] text-muted-foreground">{row.label}</span>
                      <span className="text-[13px] font-semibold text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            <button
              onClick={handleRequest}
              disabled={numeric <= 0}
              className={cn("w-full py-4 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all",
                numeric > 0 ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "bg-muted text-muted-foreground opacity-50")}
              data-testid="button-send-request"
            >
              <ArrowDownLeft className="h-5 w-5" />
              Request {numeric > 0 ? `${numeric.toLocaleString()} ETB` : "Money"}
            </button>

            <p className="text-muted-foreground text-[11px] text-center mt-3">
              The recipient will receive a notification to pay you
            </p>
          </div>
        )}

        {/* ── STEP 3: Done + QR ── */}
        {step === "done" && lastRequest && (
          <div className="px-4 pt-6 pb-6">
            {/* Success header */}
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.5 }}
              className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center mx-auto mb-4"
            >
              <Check className="h-7 w-7 text-emerald-400" strokeWidth={2.5} />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="text-center mb-6">
              <p className="font-bold text-[20px]">Request Sent!</p>
              <p className="text-muted-foreground text-[14px] mt-1">
                {lastRequest.toName} will be notified to send you <strong>{lastRequest.amount.toLocaleString()} ETB</strong>
              </p>
            </motion.div>

            {/* QR Code card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="rounded-2xl bg-card border border-border/50 p-5 flex flex-col items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-muted-foreground" />
                <p className="text-[13px] font-semibold">Payment Request QR</p>
              </div>
              <div className="bg-white rounded-xl p-4">
                <QRCodeSVG value={requestLink} size={160} level="M" />
              </div>
              <p className="text-[12px] text-muted-foreground text-center">
                Share this QR or the link below to receive{" "}
                <strong className="text-foreground">{lastRequest.amount.toLocaleString()} ETB</strong>
              </p>
            </motion.div>

            {/* Request details */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="rounded-2xl bg-card border border-border/50 overflow-hidden divide-y divide-border/50 mb-4">
              {[
                { label: "Requested From", value: `@${lastRequest.toUsername}` },
                { label: "Amount", value: `${lastRequest.amount.toLocaleString()} ETB` },
                lastRequest.reason && { label: "Reason", value: lastRequest.reason },
                { label: "Status", value: "Pending" },
              ].filter(Boolean).map((row: any, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-muted-foreground">{row.label}</span>
                  <span className={cn("text-[13px] font-semibold", row.label === "Status" && "text-yellow-400")}>{row.value}</span>
                </div>
              ))}
            </motion.div>

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-card border border-border/50 hover:bg-muted/30 transition-colors"
                data-testid="button-copy-request-link"
              >
                <span className="text-[14px] font-semibold">Copy Request Link</span>
                <AnimatePresence mode="wait">
                  {copiedLink
                    ? <motion.div key="c" initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="h-4 w-4 text-emerald-400" /></motion.div>
                    : <motion.div key="u" initial={{ scale: 0 }} animate={{ scale: 1 }}><Copy className="h-4 w-4 text-muted-foreground" /></motion.div>
                  }
                </AnimatePresence>
              </button>

              <button
                onClick={() => {
                  const shareData = { title: "Echat Payment Request", text: `Please send me ${lastRequest.amount.toLocaleString()} ETB on Echat`, url: requestLink };
                  if (navigator.share) navigator.share(shareData).catch(() => {});
                  else handleCopyLink();
                }}
                className="w-full py-4 rounded-2xl border border-border font-bold text-[15px] hover:bg-muted transition-colors"
                data-testid="button-share-request"
              >
                Share Request
              </button>

              <button
                onClick={() => navigate("/wallet")}
                className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-[15px] shadow-lg shadow-primary/25"
                data-testid="button-done-request"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestMoney;
