import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { checkWalletDevice } from "@/lib/walletSecurity";
import { refreshWalletLockFlag } from "@/lib/chatLockService";
import { walletService } from "@/lib/walletService";
import WalletTerms from "@/components/WalletTerms";
import { useNavigate } from "react-router-dom";
import OtpSheet from "./OtpSheet";
import PinSetupSheet from "./PinSetupSheet";

/**
 * Wallet entry guard:
 *  - unrecognized device -> email code (high-risk), then the device is remembered
 *  - no PIN yet -> prompt to create a 4/6-digit PIN
 */
export default function WalletSecurityGate({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "otp" | "activation" | "suspended" | "ok" | "error">("checking");
  const [checkedUser, setCheckedUser] = useState<string | null>(null);
  const generation = useRef(0);
  const [askPin, setAskPin] = useState(false);

  const runCheck = async () => {
    const current = ++generation.current;
    setState('checking');
    try {
      if (!userId) throw new Error('Please sign in');
      const r = await checkWalletDevice();
      if (current !== generation.current) return;
      if (r !== 'trusted') { setState('otp'); return; }
      const { wallet } = await walletService.getWalletBalance(true);
      if (current !== generation.current) return;
      setCheckedUser(userId);
      if (wallet?.status === 'suspended') { setState('suspended'); return; }
      if (!wallet || wallet.status === 'pending_activation') { setState('activation'); return; }
      const has = await refreshWalletLockFlag();
      if (current !== generation.current) return;
      setAskPin(!has); setCheckedUser(userId); setState('ok');
    } catch { if (current === generation.current) setState("error"); }
  };

  useEffect(() => {
    setCheckedUser(null); setAskPin(false); void runCheck();
    return () => { generation.current += 1; };
  }, [userId]);

  if (state === 'checking' || (checkedUser !== userId && state !== 'error' && state !== 'otp')) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (state === 'activation') return <WalletTerms onAccepted={() => void runCheck()} onCancel={() => navigate('/chats')} />;
  if (state === 'suspended') return <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
    <p className="text-foreground" role="alert">Wallet is suspended.</p><Button variant="outline" onClick={() => navigate('/chats')}>Back</Button>
  </div>;
  if (state === 'error') return <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
    <p className="text-foreground">Could not verify wallet security.</p>
    <Button onClick={() => void runCheck()}>Retry</Button>
  </div>;

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
      {!askPin && children}
      <PinSetupSheet open={askPin} onOpenChange={(open) => { if (!open && askPin) window.history.back(); }} onDone={() => setAskPin(false)} />
    </>
  );
}
