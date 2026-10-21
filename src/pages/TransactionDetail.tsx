// @ts-nocheck
import { useState, useEffect } from "react";
import { ArrowLeft, User, Copy, Check, Loader2, Download, AlertCircle, Wallet, FileText } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { walletService, type WalletTransaction } from "@/lib/walletService";
import { format } from "date-fns";
import { toast } from "sonner";

/* ─── tokens ─── */
const BG   = "hsl(var(--surface-lowest))";
const CARD = "hsl(var(--surface-low))";
const P    = "hsl(var(--tertiary))";

function formatETB(n: number) {
  return n.toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_CFG: Record<string, { bg: string; color: string; dot: string }> = {
  completed: { bg: "hsl(var(--cosmic-mint) / 0.18)",  color: "hsl(var(--cosmic-mint))", dot: "hsl(var(--cosmic-mint))" },
  pending:   { bg: "hsl(var(--tertiary) / 0.18)",  color: "hsl(var(--tertiary))", dot: "hsl(var(--tertiary))" },
  failed:    { bg: "hsl(var(--destructive) / 0.18)",   color: "hsl(var(--destructive))", dot: "hsl(var(--destructive))" },
  reversed:  { bg: "hsl(var(--cosmic-magenta) / 0.18)",  color: "hsl(var(--cosmic-magenta))", dot: "hsl(var(--cosmic-magenta))" },
};

const TransactionDetail = () => {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<WalletTransaction | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [copied,      setCopied]      = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!transactionId) { navigate("/wallet"); return; }
      try {
        const cached = walletService.getCachedTransactions();
        let tx = cached.find(t => t.id === transactionId);
        if (!tx) {
          const data = await walletService.getWalletBalance(true);
          tx = data.transactions.find(t => t.id === transactionId);
        }
        if (tx) setTransaction(tx);
        else navigate("/transaction-history");
      } catch { navigate("/transaction-history"); }
      finally { setIsLoading(false); }
    };
    load();
  }, [transactionId, navigate]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
      <Loader2 className="h-7 w-7 animate-spin" style={{ color: P }} />
    </div>
  );
  if (!transaction) return null;

  const isIn    = ["transfer_in", "deposit"].includes(transaction.type);
  const meta    = transaction.metadata as Record<string, unknown> || {};
  const status  = STATUS_CFG[transaction.status] ?? STATUS_CFG.completed;
  const shortId = "TXN" + transaction.id.slice(-9).toUpperCase();
  const fromTo  = isIn
    ? String(meta.sender_name   || meta.sender_username   || "Wallet")
    : String(meta.recipient_name|| meta.recipient_username|| "Wallet");
  const method  = String(meta.method || "Wallet Balance");
  const note    = String(meta.note || transaction.description || "");

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(shortId).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast.success("Transaction ID copied");
  };

  const handleDownload = () => {
    const lines = [
      "═══════════════════════════════",
      "        ECHAT OFFICIAL E-RECEIPT",
      "  Validated by Wallet Network",
      "═══════════════════════════════",
      `Amount     : ${isIn ? "+" : "-"}${formatETB(transaction.amount)} ETB`,
      `From/To    : ${fromTo}`,
      `Trans. ID  : ${shortId}`,
      `Date & Time: ${format(new Date(transaction.created_at), "MMM d, yyyy, h:mm a")}`,
      `Method     : ${method}`,
      note ? `Note       : ${note}` : "",
      `Status     : ${transaction.status.toUpperCase()}`,
      "═══════════════════════════════",
    ].filter(l => l !== "").join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `echat-receipt-${shortId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded");
  };

  return (
    <div className="min-h-screen flex flex-col pb-10" style={{ background: BG }}>

      {/* ── HEADER ── */}
      <div className="flex items-center px-4 pt-12 pb-5">
        <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center">
          <ArrowLeft style={{ color: "hsl(var(--foreground) / 0.85)", width: 22, height: 22 }} />
        </motion.button>
        <h1 className="flex-1 text-center font-bold text-[18px] text-foreground">Transaction Detail</h1>
        <div className="w-9" />
      </div>

      {/* ── HERO SECTION ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center px-4 pb-6">

        {/* Double-ring checkmark circle */}
        <div className="relative mb-5">
          {/* Outer dim ring */}
          <div className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{ border: "2px solid hsl(var(--tertiary) / 0.25)", background: "hsl(var(--tertiary) / 0.06)" }}>
            {/* Inner purple filled circle */}
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${P}, hsl(var(--secondary)))`, boxShadow: `0 4px 20px hsl(var(--tertiary) / 0.5)` }}>
              <Check style={{ color: "hsl(var(--foreground))", width: 26, height: 26, strokeWidth: 3 }} />
            </div>
          </div>
        </div>

        {/* Amount */}
        <p className="font-black text-[38px] text-foreground leading-none mb-3" style={{ letterSpacing: "-0.02em" }}>
          {isIn ? "+" : "-"}{formatETB(transaction.amount)} ETB
        </p>

        {/* Status badge */}
        <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full"
          style={{ background: status.bg }}>
          <div className="w-2 h-2 rounded-full" style={{ background: status.dot }} />
          <span className="text-[12px] font-bold uppercase tracking-wide" style={{ color: status.color }}>
            {transaction.status}
          </span>
        </div>
      </motion.div>

      <div className="px-4 space-y-4">
        {/* ── DETAILS SECTION ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <p className="font-bold text-[18px] text-foreground mb-3">Details</p>

          <div className="rounded-2xl overflow-hidden" style={{ background: CARD, border: "1px solid hsl(var(--foreground) / 0.07)" }}>
            {/* From/To */}
            <div className="flex items-center justify-between px-4 py-4"
              style={{ borderBottom: "1px solid hsl(var(--foreground) / 0.06)" }}>
              <span className="text-[13px]" style={{ color: "hsl(var(--foreground) / 0.45)" }}>From/To</span>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: "hsl(var(--tertiary) / 0.2)" }}>
                  <User style={{ color: "hsl(var(--primary))", width: 14, height: 14 }} />
                </div>
                <span className="font-bold text-[14px] text-foreground">{fromTo}</span>
              </div>
            </div>

            {/* Transaction ID */}
            <div className="flex items-center justify-between px-4 py-4"
              style={{ borderBottom: "1px solid hsl(var(--foreground) / 0.06)" }}>
              <span className="text-[13px]" style={{ color: "hsl(var(--foreground) / 0.45)" }}>Transaction ID</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[14px] text-foreground font-mono">{shortId}</span>
                <motion.button whileTap={{ scale: 0.85 }} onClick={handleCopyId}>
                  {copied
                    ? <Check style={{ color: "hsl(var(--cosmic-mint))", width: 15, height: 15 }} />
                    : <Copy style={{ color: "hsl(var(--foreground) / 0.35)", width: 15, height: 15 }} />
                  }
                </motion.button>
              </div>
            </div>

            {/* Date & Time */}
            <div className="flex items-center justify-between px-4 py-4"
              style={{ borderBottom: "1px solid hsl(var(--foreground) / 0.06)" }}>
              <span className="text-[13px]" style={{ color: "hsl(var(--foreground) / 0.45)" }}>Date & Time</span>
              <span className="font-bold text-[14px] text-foreground">
                {format(new Date(transaction.created_at), "MMM d, yyyy, h:mm a")}
              </span>
            </div>

            {/* Payment Method */}
            <div className="flex items-center justify-between px-4 py-4"
              style={{ borderBottom: note ? "1px solid hsl(var(--foreground) / 0.06)" : "none" }}>
              <span className="text-[13px]" style={{ color: "hsl(var(--foreground) / 0.45)" }}>Payment Method</span>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "hsl(var(--tertiary) / 0.2)" }}>
                  <Wallet style={{ color: "hsl(var(--primary))", width: 14, height: 14 }} />
                </div>
                <span className="font-bold text-[14px] text-foreground">{method}</span>
              </div>
            </div>

            {/* Reference Note (only if present) */}
            {note && (
              <div className="flex items-center justify-between px-4 py-4">
                <span className="text-[13px]" style={{ color: "hsl(var(--foreground) / 0.45)" }}>Reference Note</span>
                <span className="font-bold text-[14px] text-foreground italic">"{note}"</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── OFFICIAL E-RECEIPT ROW ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <div className="flex items-center gap-3 px-4 py-4 rounded-2xl"
            style={{ background: CARD, border: "1px solid hsl(var(--foreground) / 0.07)" }}>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "hsl(var(--tertiary) / 0.2)" }}>
              <FileText style={{ color: "hsl(var(--primary))", width: 20, height: 20 }} />
            </div>
            <div>
              <p className="font-bold text-[14px] text-foreground">Official E-Receipt</p>
              <p className="text-[12px]" style={{ color: "hsl(var(--foreground) / 0.4)" }}>Validated by Wallet Network</p>
            </div>
          </div>
        </motion.div>

        {/* ── DOWNLOAD RECEIPT BUTTON ── */}
        <motion.button whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          onClick={handleDownload}
          className="w-full py-4 rounded-full font-bold text-[16px] text-foreground flex items-center justify-center gap-2"
          style={{ background: P, boxShadow: "0 6px 24px hsl(var(--tertiary) / 0.45)" }}
          data-testid="button-download-receipt">
          <Download style={{ width: 18, height: 18 }} />
          Download Receipt
        </motion.button>

        {/* ── REPORT AN ISSUE BUTTON ── */}
        <motion.button whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
          onClick={() => toast.info("Support team will be contacted")}
          className="w-full py-4 rounded-full font-bold text-[16px] flex items-center justify-center gap-2"
          style={{ background: "hsl(var(--foreground) / 0.06)", border: "1px solid hsl(var(--foreground) / 0.1)", color: "hsl(var(--foreground) / 0.7)" }}
          data-testid="button-report-issue">
          <AlertCircle style={{ width: 18, height: 18 }} />
          Report an Issue
        </motion.button>

        {/* Bottom dash indicator */}
        <div className="flex justify-center pb-4 pt-2">
          <div className="w-10 h-1 rounded-full" style={{ background: "hsl(var(--foreground) / 0.15)" }} />
        </div>
      </div>
    </div>
  );
};

export default TransactionDetail;
