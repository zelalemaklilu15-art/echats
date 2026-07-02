import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smile, CreditCard } from "lucide-react";
import { verifyWalletPinAsync, isWalletLockEnabled } from "@/lib/chatLockService";

let _walletUnlocked = false;
export function resetWalletSession() { _walletUnlocked = false; }

interface Props { children: React.ReactNode; }

const PIN_LENGTH = 6;
const BG   = "#0F0820";
const P    = "#7C3AED";
const PDIM = "rgba(124,58,237,0.22)";

export default function WalletLockGate({ children }: Props) {
  const [locked, setLocked] = useState(() => isWalletLockEnabled() && !_walletUnlocked);
  const [pin,    setPin]    = useState("");
  const [shake,  setShake]  = useState(false);
  const [error,  setError]  = useState("");
  const [checking, setChecking] = useState(false);

  const handleDigit = (d: string) => {
    if (pin.length >= PIN_LENGTH || checking) return;
    const next = pin + d;
    setPin(next);
    setError("");
    if (next.length >= 4) {
      setTimeout(() => void tryUnlock(next), 100);
    }
  };

  const tryUnlock = async (p: string) => {
    setChecking(true);
    const ok = await verifyWalletPinAsync(p);
    setChecking(false);
    if (ok) {
      _walletUnlocked = true;
      setLocked(false);
    } else if (p.length >= PIN_LENGTH) {
      setShake(true);
      setError("Incorrect PIN. Try again.");
      setPin("");
      setTimeout(() => setShake(false), 480);
    }
  };

  const handleDelete = () => { setPin(p => p.slice(0, -1)); setError(""); };
  const handleBiometric = () => {};

  if (!locked) return <>{children}</>;

  const KEYS: (string | null)[] = [
    "1","2","3",
    "4","5","6",
    "7","8","9",
    "bio","0","del",
  ];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-between"
      style={{ background: BG, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>

      {/* ── TOP SECTION ── */}
      <div className="flex flex-col items-center pt-16 pb-8 px-8 w-full max-w-sm mx-auto">
        {/* Wallet icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-7"
          style={{ background: `linear-gradient(135deg, #3D1A8A, #6D28D9)`, boxShadow: `0 8px 32px rgba(109,40,217,0.45)` }}
        >
          <CreditCard style={{ color: "#fff", width: 34, height: 34 }} />
        </motion.div>

        {/* Title */}
        <h1 className="text-[26px] font-bold text-white text-center leading-tight mb-2">
          Enter Wallet PIN
        </h1>
        <p className="text-[14px] text-center" style={{ color: "rgba(255,255,255,0.45)" }}>
          Please enter your 6-digit security code
        </p>
      </div>

      {/* ── PIN DOTS ── */}
      <motion.div
        animate={shake ? { x: [-10, 10, -10, 10, -6, 6, 0] } : {}}
        transition={{ duration: 0.45 }}
        className="flex items-end justify-center gap-5 px-8"
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = i < pin.length;
          return (
            <div key={i} className="flex flex-col items-center gap-2">
              {/* Dot */}
              <motion.div
                animate={{ scale: filled ? 1.15 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                className="w-3 h-3 rounded-full"
                style={{
                  background: filled ? "#fff" : "rgba(255,255,255,0.28)",
                }}
              />
              {/* Underline */}
              <div className="w-9 h-[2px] rounded-full"
                style={{ background: filled ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.15)" }} />
            </div>
          );
        })}
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-[13px] font-medium mt-3"
            style={{ color: "#f87171" }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── KEYPAD ── */}
      <div className="w-full max-w-xs mx-auto px-6">
        <div className="grid grid-cols-3">
          {KEYS.map((key, idx) => {
            if (key === "bio") return (
              <motion.button
                key="bio"
                whileTap={{ scale: 0.88 }}
                onPointerDown={handleBiometric}
                className="flex items-center justify-center"
                style={{ height: 80 }}
                data-testid="pin-biometric"
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: PDIM, border: `1px solid rgba(124,58,237,0.35)` }}>
                  <Smile style={{ color: P, width: 22, height: 22 }} />
                </div>
              </motion.button>
            );

            if (key === "del") return (
              <motion.button
                key="del"
                whileTap={{ scale: 0.88 }}
                onPointerDown={handleDelete}
                className="flex items-center justify-center"
                style={{ height: 80 }}
                data-testid="pin-delete"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {/* Custom backspace icon matching design */}
                  <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
                    <path d="M7.5 1H18C18.5523 1 19 1.44772 19 2V14C19 14.5523 18.5523 15 18 15H7.5L1 8L7.5 1Z"
                      stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" fill="rgba(255,255,255,0.07)" />
                    <path d="M12 6L8 10M8 6L12 10" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              </motion.button>
            );

            return (
              <motion.button
                key={key}
                whileTap={{ scale: 0.88, backgroundColor: "rgba(255,255,255,0.07)" }}
                onPointerDown={() => handleDigit(key!)}
                className="flex items-center justify-center rounded-full"
                style={{ height: 80 }}
                data-testid={`pin-key-${key}`}
              >
                <span className="font-light text-white" style={{ fontSize: 30, letterSpacing: "-0.01em" }}>
                  {key}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── FORGOT PIN ── */}
      <div className="pb-4 flex flex-col items-center gap-6">
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="text-[15px] font-semibold"
          style={{ color: P }}
          data-testid="pin-forgot"
        >
          Forgot PIN?
        </motion.button>

        {/* Bottom page indicator */}
        <div className="flex items-center gap-2">
          <div className="h-[3px] w-8 rounded-full" style={{ background: "rgba(255,255,255,0.18)" }} />
          <div className="h-[3px] w-10 rounded-full" style={{ background: P }} />
          <div className="h-[3px] w-8 rounded-full" style={{ background: "rgba(255,255,255,0.18)" }} />
        </div>
      </div>
    </div>
  );
}
