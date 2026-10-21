import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { checkWalletDevice } from "@/lib/walletSecurity";
import { refreshWalletLockFlag } from "@/lib/chatLockService";
import OtpSheet from "./OtpSheet";
import PinSetupSheet from "./PinSetupSheet";

let _deviceOk = false;

/**
 * Wallet entry guard:
 *  - unrecognized device -> email code (high-risk), then the device is remembered
 *  - no PIN yet -> prompt to create a 4/6-digit PIN
 */
export default function WalletSecurityGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "otp" | "ok">(_deviceOk ? "ok" : "checking");
  const [askPin, setAskPin] = useState(false);

  const runCheck = async () => {
    try {
      const r = await checkWalletDevice();
      if (r === "trusted") { _deviceOk = true; setState("ok"); } else setState("otp");
    } catch { setState("ok"); /* server still enforces PIN on every payment */ }
  };

  useEffect(() => { if (!_deviceOk) void runCheck(); }, []);
  useEffect(() => {
    if (state !== "ok") return;
    refreshWalletLockFlag().then((has) => { if (!has) setAskPin(true); }).catch(() => {});
  }, [state]);

  if (state === "checking") {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (state === "otp") {
    return (
      <div className="min-h-screen bg-background">
        <OtpSheet open onOpenChange={(o) => { if (!o) window.history.back(); }}
          reason="This is a new device. Confirm it's you to open your wallet."
          onVerified={() => void runCheck()} />
      </div>
    );
  }
  return (
    <>
      {children}
      <PinSetupSheet open={askPin} onOpenChange={setAskPin} onDone={() => setAskPin(false)} />
    </>
  );
}
