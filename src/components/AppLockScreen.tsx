import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, Fingerprint } from "lucide-react";
import { verifyAppPin, isAppLockEnabled } from "@/lib/chatLockService";
import logoImage from "@/assets/echat-logo.png";

let _appUnlocked = false;
export function setAppSessionUnlocked() { _appUnlocked = true; }
export function isAppSessionUnlocked() { return _appUnlocked; }

interface Props {
  children: React.ReactNode;
}

export default function AppLockGate({ children }: Props) {
  const [locked, setLocked] = useState(() => isAppLockEnabled() && !_appUnlocked);
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLocked(isAppLockEnabled() && !_appUnlocked);
  }, []);

  const handleDigit = (d: string) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setError("");
    if (next.length >= 4) {
      setTimeout(() => tryUnlock(next), 120);
    }
  };

  const tryUnlock = (p: string) => {
    if (verifyAppPin(p)) {
      _appUnlocked = true;
      setLocked(false);
    } else {
      setShake(true);
      setError("Incorrect PIN");
      setPin("");
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleDelete = () => setPin(p => p.slice(0, -1));

  if (!locked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background">
      <motion.div
        animate={shake ? { x: [-8, 8, -8, 8, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-8 w-full max-w-xs px-6"
      >
        <img src={logoImage} alt="Echat" className="w-16 h-16 rounded-2xl shadow-xl" />
        <div>
          <h1 className="text-2xl font-bold text-center text-foreground">Echat is Locked</h1>
          <p className="text-sm text-muted-foreground text-center mt-1">Enter your PIN to continue</p>
        </div>

        <div className="flex gap-3">
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <motion.div
              key={i}
              animate={{ scale: pin.length > i ? 1.15 : 1 }}
              className={`w-4 h-4 rounded-full border-2 transition-colors ${
                pin.length > i
                  ? "bg-primary border-primary"
                  : "border-muted-foreground/40 bg-transparent"
              }`}
            />
          ))}
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-red-500 -mt-4"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-3 gap-4 w-full">
          {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((key) => (
            key === "" ? (
              <div key="empty" />
            ) : key === "⌫" ? (
              <button
                key="del"
                onPointerDown={handleDelete}
                className="w-full aspect-square rounded-2xl flex items-center justify-center bg-muted/60 active:scale-95 transition-transform text-foreground"
              >
                <Delete className="h-5 w-5" />
              </button>
            ) : (
              <button
                key={key}
                onPointerDown={() => handleDigit(key)}
                className="w-full aspect-square rounded-2xl flex flex-col items-center justify-center bg-muted/60 active:bg-primary/20 active:scale-95 transition-all font-semibold text-xl text-foreground"
              >
                {key}
              </button>
            )
          ))}
        </div>

        <button className="text-sm text-primary underline underline-offset-2" onClick={() => {
          if (confirm("Forgot your PIN? You will need to sign out and back in to reset it.")) {
            localStorage.removeItem("echat_app_lock");
            _appUnlocked = true;
            setLocked(false);
          }
        }}>
          Forgot PIN?
        </button>
      </motion.div>
    </div>
  );
}
