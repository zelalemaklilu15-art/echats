import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { verifyWalletPinAsync } from "@/lib/chatLockService";
import PinConfirmSheet from "@/components/wallet/PinConfirmSheet";
import PinResetFlow from "@/components/wallet/PinResetFlow";

let unlockedUser: string | null = null;
export function resetWalletSession() { unlockedUser = null; }
supabase.auth.onAuthStateChange((event) => {
  if (event !== 'TOKEN_REFRESHED' && event !== 'INITIAL_SESSION') resetWalletSession();
});

export default function WalletLockGate({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [unlocked, setUnlocked] = useState(unlockedUser);
  const [pinError, setPinError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    if (unlockedUser !== userId) { unlockedUser = null; setUnlocked(null); }
    setPinError(''); setBusy(false); setResetOpen(false);
    return () => { generation.current += 1; };
  }, [userId]);
  const unlock = async (pin: string) => {
    if (busy || !userId) return;
    const current = generation.current;
    setBusy(true); setPinError('');
    const ok = await verifyWalletPinAsync(pin);
    if (current !== generation.current) return;
    setBusy(false);
    if (ok) { unlockedUser = userId; setUnlocked(userId); }
    else setPinError('Could not unlock wallet. Check your PIN or try again later.');
  };
  if (userId && unlocked === userId) return <>{children}</>;
  return <div className="min-h-screen bg-background">
    <PinConfirmSheet open={!resetOpen} onOpenChange={(open) => { if (!open) window.history.back(); }}
      summary="Enter your 4- or 6-digit wallet PIN" busy={busy} error={pinError}
      onSubmit={unlock} onForgot={() => setResetOpen(true)} />
    <PinResetFlow open={resetOpen} onClose={() => setResetOpen(false)} />
  </div>;
}
