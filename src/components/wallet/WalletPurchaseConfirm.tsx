import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { walletService } from '@/lib/walletService';
import PinConfirmSheet from './PinConfirmSheet';
import OtpSheet from './OtpSheet';
import PinResetFlow from './PinResetFlow';
import PinSetupSheet from './PinSetupSheet';

export default function WalletPurchaseConfirm({ open, summary, onClose, purchase, onDone }: {
  open: boolean; summary: string; onClose: () => void;
  purchase: (pin: string) => Promise<{ success: boolean; error?: string }>;
  onDone: () => void;
}) {
  const { userId } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flow, setFlow] = useState<'pin' | 'otp' | 'reset' | 'setup'>('pin');
  const running = useRef(false);
  const submit = async (pin: string) => {
    if (running.current || !userId) return;
    running.current = true; setBusy(true); setError('');
    try {
      const result = await purchase(pin);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user.id !== userId) return;
      if (result.success) { walletService.invalidateCache(); onDone(); }
      else if (result.error === 'STEP_UP_REQUIRED') setFlow('otp');
      else if (result.error === 'PIN_NOT_SET') setFlow('setup');
      else setError(result.error || 'Could not complete purchase. Please retry.');
    } catch { setError('Could not complete purchase. Please retry.'); }
    finally { running.current = false; setBusy(false); }
  };
  return <>
    <PinConfirmSheet open={open && flow === 'pin'} summary={summary} busy={busy} error={error}
      onOpenChange={o => { if (!o && !busy) onClose(); }} onSubmit={submit} onForgot={() => setFlow('reset')} />
    <OtpSheet open={open && flow === 'otp'} onOpenChange={o => { if (!o) onClose(); }}
      reason="This is a new device. Confirm it's you before paying."
      onVerified={() => { setError(''); setFlow('pin'); }} />
    <PinResetFlow open={open && flow === 'reset'} onClose={() => setFlow('pin')} />
    <PinSetupSheet open={open && flow === 'setup'} onOpenChange={o => { if (!o) onClose(); }}
      onStepUpRequired={() => setFlow('otp')} onDone={() => setFlow('pin')} />
  </>;
}