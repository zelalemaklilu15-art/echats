import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, Shield, Zap, CreditCard, Landmark, Banknote, Wallet } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { walletService } from "@/lib/walletService";
import { toast } from "sonner";
import { newIdempotencyKey } from "@/lib/walletSecurity";

/* ─── Design tokens ─── */
const BG    = "hsl(var(--surface-lowest))";
const CARD  = "hsl(var(--card))";
const CARD2 = "hsl(var(--surface-high))";
const P     = "hsl(var(--tertiary))";

/* ─── Payment methods ─── */
const METHODS = [
  { id: "telebirr",  label: "Telebirr",         sub: "Pending confirmation",              Icon: Wallet,    iconBg: "hsl(var(--tertiary) / 0.25)",  iconColor: "hsl(var(--primary))" },
  { id: "cbebirr",   label: "CBEBirr",           sub: "Commercial Bank of Ethiopia",  Icon: Landmark,  iconBg: "hsl(var(--cosmic-cyan) / 0.15)",   iconColor: "hsl(var(--cosmic-cyan))" },
  { id: "awash",     label: "Awash Bank",        sub: "Secure bank transfer",         Icon: Banknote,  iconBg: "hsl(var(--cosmic-mint) / 0.15)",   iconColor: "hsl(var(--cosmic-mint))" },
  { id: "card",      label: "Credit/Debit Card", sub: "Visa, Mastercard, Amex",       Icon: CreditCard,iconBg: "hsl(var(--tertiary) / 0.15)",   iconColor: "hsl(var(--tertiary))" },
  { id: "dashen",    label: "Dashen Bank",       sub: "Fast Amole integration",       Icon: Landmark,  iconBg: "hsl(var(--cosmic-magenta) / 0.15)",   iconColor: "hsl(var(--cosmic-magenta))" },
];

const QUICK = [100, 250, 500, 1000, 2500, 5000];

const AddMoney = () => {
  const navigate = useNavigate();
  const [amount,  setAmount]  = useState("2500");
  const [method,  setMethod]  = useState("telebirr");
  const [step,    setStep]    = useState<"main" | "confirm">("main");
  const [loading, setLoading] = useState(false);

  const operations = useRef(new Map<string, string>());
  const numeric = parseFloat(amount.replace(/,/g, "")) || 0;
  const sel = METHODS.find(m => m.id === method) ?? METHODS[0];

  const fmt = (n: number) =>
    n.toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleConfirm = async () => {
    if (loading || !sel || numeric <= 0 || numeric > 10000) return;
    setLoading(true);
    try {
      const payload = JSON.stringify([numeric, sel.label]);
      const requestKey = operations.current.get(payload) ?? newIdempotencyKey("deposit");
      operations.current.set(payload, requestKey);
      const result = await walletService.deposit(numeric, sel.label, requestKey);
      if (result.success && result.transaction) {
        navigate("/transaction-receipt", {
          state: {
            transaction: {
              type: "add_money", amount: result.transaction.amount,
              method: result.transaction.method, transactionId: result.transaction.id,
              timestamp: result.transaction.created_at, status: result.transaction.status,
            },
          },
        });
      } else {
        toast.error(result.error || "Failed to add money");
      }
    } catch { toast.error("Failed. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col pb-6" style={{ background: BG }}>

      {/* ── HEADER ── */}
      <div className="flex items-center px-4 pt-12 pb-4">
        <motion.button whileTap={{ scale: 0.88 }}
          onClick={() => step === "main" ? navigate("/wallet") : setStep("main")}
          className="w-9 h-9 flex items-center justify-center"
          data-testid="button-back-add-money">
          <ArrowLeft style={{ color: "hsl(var(--foreground) / 0.85)", width: 22, height: 22 }} />
        </motion.button>
        <h1 className="flex-1 text-center font-bold text-[18px] text-foreground">Add Money</h1>
        <div className="w-9" />
      </div>

      {/* ── PAGE INDICATOR DOTS ── */}
      <div className="flex items-center justify-center gap-2 pb-6">
        <div className="h-[4px] w-7 rounded-full" style={{ background: P }} />
        <div className="h-[4px] w-4 rounded-full" style={{ background: "hsl(var(--foreground) / 0.2)" }} />
        <div className="h-[4px] w-4 rounded-full" style={{ background: "hsl(var(--foreground) / 0.2)" }} />
      </div>

      <AnimatePresence mode="wait">
        {step === "main" ? (
          <motion.div key="main" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">

            {/* ── AMOUNT SECTION ── */}
            <div className="px-5 pb-5">
              {/* ENTER AMOUNT label */}
              <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] mb-4" style={{ color: P }}>
                Enter Amount
              </p>

              {/* Amount display */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="text-[22px] font-bold" style={{ color: "hsl(var(--foreground) / 0.38)" }}>ETB</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className="bg-transparent border-0 outline-none text-foreground font-black text-center"
                  style={{ fontSize: 48, letterSpacing: "-0.02em", width: "220px" }}
                  data-testid="input-add-amount"
                />
              </div>

              {/* Quick amount chips */}
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK.map(q => {
                  const active = numeric === q;
                  return (
                    <motion.button key={q} whileTap={{ scale: 0.92 }}
                      onClick={() => setAmount(q.toString())}
                      className="px-5 py-2.5 rounded-full font-bold text-[14px]"
                      style={{
                        background: active ? P : CARD2,
                        color: active ? "hsl(var(--foreground))" : "hsl(var(--foreground) / 0.75)",
                        border: `1px solid ${active ? P : "hsl(var(--foreground) / 0.1)"}`,
                        boxShadow: active ? `0 4px 14px hsl(var(--tertiary) / 0.45)` : "none",
                      }}>
                      {q >= 1000 ? q.toLocaleString() : q}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Separator */}
            <div className="mx-5 mb-5" style={{ height: 1, background: "hsl(var(--foreground) / 0.07)" }} />

            {/* ── SELECT PAYMENT METHOD ── */}
            <div className="px-5 flex-1">
              <p className="font-bold text-[17px] text-foreground mb-4">Select Payment Method</p>

              <div className="space-y-2.5">
                {METHODS.map(m => {
                  const active = method === m.id;
                  return (
                    <motion.button key={m.id} whileTap={{ scale: 0.98 }}
                      onClick={() => setMethod(m.id)}
                      className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-left"
                      style={{
                        background: active ? "hsl(var(--tertiary) / 0.15)" : CARD,
                        border: `1px solid ${active ? "hsl(var(--tertiary) / 0.45)" : "hsl(var(--foreground) / 0.08)"}`,
                      }}
                      data-testid={`method-${m.id}`}>
                      {/* Icon */}
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ background: m.iconBg }}>
                        <m.Icon style={{ color: m.iconColor, width: 20, height: 20 }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[15px] text-foreground">{m.label}</p>
                        <p className="text-[12px]" style={{ color: "hsl(var(--foreground) / 0.45)" }}>{m.sub}</p>
                      </div>
                      {/* Radio */}
                      <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                        style={{
                          border: `2px solid ${active ? P : "hsl(var(--foreground) / 0.3)"}`,
                          background: active ? P : "transparent",
                        }}>
                        {active && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* ── CONTINUE BUTTON ── */}
            <div className="px-5 pt-5">
              <motion.button whileTap={{ scale: 0.97 }}
                disabled={numeric <= 0 || numeric > 10000}
                onClick={() => numeric > 0 && setStep("confirm")}
                className="w-full py-4 rounded-full font-bold text-[16px] text-foreground flex items-center justify-center gap-2"
                style={{
                  background: numeric > 0 ? P : "hsl(var(--tertiary) / 0.3)",
                  boxShadow: numeric > 0 ? "0 6px 24px hsl(var(--tertiary) / 0.45)" : "none",
                  opacity: numeric > 0 ? 1 : 0.5,
                }}
                data-testid="button-amount-next">
                Continue
                <ArrowRight style={{ width: 18, height: 18 }} />
              </motion.button>
            </div>

          </motion.div>
        ) : (
          /* ── CONFIRM STEP ── */
          <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col px-5">

            <div className="rounded-3xl overflow-hidden mb-4" style={{ background: CARD, border: "1px solid hsl(var(--foreground) / 0.08)" }}>
              {/* Amount hero */}
              <div className="px-6 py-7 text-center border-b" style={{ borderColor: "hsl(var(--foreground) / 0.07)", background: "hsl(var(--tertiary) / 0.1)" }}>
                <p className="text-[11px] uppercase tracking-widest font-bold mb-2" style={{ color: "hsl(var(--foreground) / 0.45)" }}>You're adding</p>
                <p className="text-[44px] font-black text-foreground leading-none">
                  {fmt(numeric)} <span className="text-[20px] font-bold" style={{ color: "hsl(var(--foreground) / 0.45)" }}>ETB</span>
                </p>
                <p className="text-[12px] mt-1.5" style={{ color: "hsl(var(--foreground) / 0.35)" }}>Awaiting verified payment confirmation</p>
              </div>

              {/* Detail rows */}
              {[
                { label: "Payment Method", value: sel.label },
                { label: "Transaction Fee", value: "Free" },
                { label: "Requested Amount", value: `${fmt(numeric)} ETB` },
                { label: "Status", value: "Pending confirmation" },
              ].map((row, i, arr) => (
                <div key={row.label} className="flex items-center justify-between px-5 py-3.5"
                  style={{ borderBottom: i < arr.length - 1 ? "1px solid hsl(var(--foreground) / 0.07)" : "none" }}>
                  <span className="text-[13px]" style={{ color: "hsl(var(--foreground) / 0.5)" }}>{row.label}</span>
                  <span className="text-[13px] font-bold text-foreground">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-2xl px-4 py-3 mb-5"
              style={{ background: "hsl(var(--cosmic-mint) / 0.07)", border: "1px solid hsl(var(--cosmic-mint) / 0.18)" }}>
              <Shield style={{ color: "hsl(var(--cosmic-mint))", width: 16, height: 16, flexShrink: 0 }} />
              <p className="text-[12px]" style={{ color: "hsl(var(--foreground) / 0.5)" }}>Your balance is unchanged until payment is verified.</p>
            </div>

            <motion.button whileTap={{ scale: 0.97 }}
              onClick={handleConfirm} disabled={loading}
              className="w-full py-4 rounded-full font-bold text-[16px] text-foreground flex items-center justify-center gap-2"
              style={{ background: P, boxShadow: "0 6px 24px hsl(var(--tertiary) / 0.45)", opacity: loading ? 0.7 : 1 }}
              data-testid="button-confirm-add">
              {loading
                ? <><Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} /> Processing…</>
                : <><Check style={{ width: 18, height: 18 }} /> Request {numeric.toLocaleString()} ETB</>
              }
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AddMoney;
