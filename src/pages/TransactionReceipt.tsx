import { ArrowLeft, Share2, Check, Clock, AlertCircle, MoreVertical, Wallet } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { format } from "date-fns";

/* ─── design tokens ─── */
const BG      = "hsl(var(--surface-lowest))";
const CARD    = "hsl(var(--surface-low))";
const P       = "hsl(var(--tertiary))";

interface TransactionData {
  type: "add_money" | "sent" | "request" | string;
  amount: number;
  recipient?: string;
  method?: string;
  transactionId: string;
  timestamp: string;
  status: "completed" | "pending" | string;
  note?: string | null;
}

function formatETB(n: number) {
  return (typeof n === "number" ? n : parseFloat(String(n)) || 0)
    .toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Build zigzag SVG path: row of downward-pointing teeth in CARD color on BG */
function zigzagPath(viewW = 400, toothW = 20, h = 20): string {
  const points: string[] = [`M0,0`];
  for (let x = 0; x < viewW; x += toothW) {
    points.push(`L${x + toothW / 2},${h}`);   /* tip pointing DOWN */
    points.push(`L${x + toothW},0`);           /* back up to base   */
  }
  points.push("Z");
  return points.join(" ");
}

const TransactionReceipt = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const tx        = location.state?.transaction as TransactionData | undefined;

  if (!tx) { navigate("/wallet"); return null; }

  const isSent     = tx.type === "sent";
  const isIn       = tx.type === "add_money";
  const completed = tx.status === "completed";
  const pending = tx.status === "pending";
  const StatusIcon = completed ? Check : pending ? Clock : AlertCircle;
  const shortRef   = "TXN" + tx.transactionId.slice(-10).toUpperCase();
  const maskedWallet = `Wallet (**** ${tx.transactionId.slice(-4).toUpperCase()})`;

  const qrData = JSON.stringify({
    id: tx.transactionId, type: tx.type, amount: tx.amount, ts: tx.timestamp, app: "Echat",
  });

  const handleShare = async () => {
    const text = `${tx.status.toUpperCase()} · ${formatETB(tx.amount)} ETB\nRef: ${shortRef}`;
    if (navigator.share) {
      await navigator.share({ title: "Echat Receipt", text, url: window.location.href }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
      toast.success("Copied to clipboard");
    }
  };

  let txDate = "";
  let txTime = "";
  try {
    const d = new Date(tx.timestamp);
    txDate   = format(d, "MMM d, yyyy");
    txTime   = format(d, "HH:mm a");
  } catch {
    txDate = tx.timestamp;
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: 24 }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", padding: "48px 16px 20px" }}>
        <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/wallet")}
          style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft style={{ color: "hsl(var(--foreground) / 0.85)", width: 22, height: 22 }} />
        </motion.button>
        <h1 style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 18, color: "hsl(var(--foreground))", margin: 0 }}>
          Transaction Receipt
        </h1>
        <button style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer" }}>
          <MoreVertical style={{ color: "hsl(var(--foreground) / 0.45)", width: 20, height: 20 }} />
        </button>
      </div>

      {/* ── RECEIPT BLOCK (card body + zigzag edge) ── */}
      <motion.div
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
        style={{ margin: "0 16px" }}
      >
        {/* Card body — rounded TOP corners only, flat at bottom */}
        <div style={{
          background: CARD,
          borderRadius: "24px 24px 0 0",
          border: "1px solid hsl(var(--foreground) / 0.07)",
          borderBottom: "none",
          overflow: "hidden",
          padding: "32px 24px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}>

          {/* Green checkmark circle */}
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "hsl(var(--cosmic-mint) / 0.18)",
            border: "2px solid hsl(var(--cosmic-mint) / 0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 14,
            boxShadow: "0 0 28px hsl(var(--cosmic-mint) / 0.18)",
          }}>
            <StatusIcon className={completed ? "text-cosmic-mint" : pending ? "text-tertiary" : "text-destructive"} size={28} />
          </div>

          {/* PAYMENT SUCCESSFUL */}
          <p style={{
            color: "hsl(var(--cosmic-mint))", fontWeight: 700, fontSize: 12,
            letterSpacing: "0.18em", textTransform: "uppercase",
            marginBottom: 18,
          }}>{completed ? "Payment Successful" : pending ? "Awaiting Confirmation" : "Payment " + tx.status}</p>

          {/* App branding */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: `linear-gradient(135deg, ${P}, hsl(var(--secondary)))`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Wallet style={{ color: "hsl(var(--foreground))", width: 14, height: 14 }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 16, color: "hsl(var(--foreground))" }}>EchatWallet</span>
            </div>
            <span style={{ fontSize: 12, color: "hsl(var(--foreground) / 0.38)" }}>Secure Digital Payments</span>
          </div>

          {/* Amount label */}
          <p style={{ fontSize: 12, color: "hsl(var(--foreground) / 0.4)", marginBottom: 6 }}>
            {pending ? "Requested Amount" : isSent ? "Amount Sent" : isIn ? "Amount Added" : "Amount"}
          </p>

          {/* Big amount */}
          <p style={{
            fontWeight: 900, fontSize: 40, color: "hsl(var(--foreground))",
            letterSpacing: "-0.02em", lineHeight: 1,
            marginBottom: 24,
          }}>
            {formatETB(tx.amount)} ETB
          </p>

          {/* Dashed separator */}
          <div style={{
            width: "100%",
            borderTop: "1.5px dashed hsl(var(--foreground) / 0.13)",
            marginBottom: 20,
          }} />

          {/* Detail rows */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
            {tx.recipient && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "hsl(var(--foreground) / 0.4)" }}>Recipient</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--foreground))" }}>{tx.recipient}</span>
              </div>
            )}
            {isIn && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "hsl(var(--foreground) / 0.4)" }}>Method</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--foreground))" }}>{tx.method || "Bank Transfer"}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "hsl(var(--foreground) / 0.4)" }}>Date</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--foreground))" }}>{txDate}</span>
            </div>
            {txTime && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "hsl(var(--foreground) / 0.4)" }}>Time</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--foreground))" }}>{txTime}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "hsl(var(--foreground) / 0.4)" }}>Payment Method</span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Wallet style={{ color: "hsl(var(--foreground) / 0.45)", width: 13, height: 13 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--foreground))" }}>{maskedWallet}</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "hsl(var(--foreground) / 0.4)" }}>Reference ID</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground) / 0.75)", fontFamily: "monospace" }}>
                {shortRef}
              </span>
            </div>
          </div>

          {/* QR code */}
          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{
              background: "#fff", borderRadius: 16, padding: 16,
              boxShadow: "0 4px 24px hsl(var(--surface-lowest) / 0.35)",
            }}>
              <QRCodeSVG value={qrData} size={128} level="M" />
            </div>
            <p style={{
              fontSize: 10, fontWeight: 700,
              letterSpacing: "0.22em", textTransform: "uppercase",
              color: "hsl(var(--foreground) / 0.3)",
            }}>Scan to Verify</p>
          </div>

          {/* small bottom padding before zigzag */}
          <div style={{ height: 24 }} />
        </div>

        {/* ── ZIGZAG TORN-PAPER EDGE ──
            Downward-pointing teeth in CARD color, BG shows between teeth.
            This sits directly below the flat-bottom card, no gap.        */}
        <div style={{ background: BG, lineHeight: 0 }}>
          <svg
            width="100%" height="20"
            viewBox="0 0 400 20"
            preserveAspectRatio="none"
            style={{ display: "block" }}
          >
            <path d={zigzagPath(400, 20, 20)} fill={CARD} />
          </svg>
        </div>
      </motion.div>

      {/* ── SHARE RECEIPT BUTTON ── */}
      <div style={{ padding: "20px 16px 0" }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
          onClick={handleShare}
          data-testid="button-share-receipt"
          style={{
            width: "100%", padding: "16px 0",
            borderRadius: 999, border: "none", cursor: "pointer",
            background: P,
            boxShadow: "0 6px 28px hsl(var(--tertiary) / 0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontWeight: 700, fontSize: 16, color: "hsl(var(--foreground))",
          }}
        >
          <Share2 style={{ width: 18, height: 18 }} />
          Share Receipt
        </motion.button>

        {/* ── DONE BUTTON ── */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }}
          onClick={() => navigate("/wallet")}
          data-testid="button-done"
          style={{
            width: "100%", padding: "16px 0",
            borderRadius: 999, cursor: "pointer",
            background: "hsl(var(--foreground) / 0.07)",
            border: "1px solid hsl(var(--foreground) / 0.1)",
            fontWeight: 700, fontSize: 16, color: "hsl(var(--foreground))",
            marginTop: 12,
          }}
        >
          Done
        </motion.button>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }}
          style={{
            textAlign: "center", fontSize: 11, marginTop: 16,
            color: "hsl(var(--foreground) / 0.28)", padding: "0 8px",
          }}
        >
          A confirmation email has been sent to your registered address.
        </motion.p>
      </div>
    </div>
  );
};

export default TransactionReceipt;
