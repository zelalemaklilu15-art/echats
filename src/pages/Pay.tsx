import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { parsePaymentPath, UUID_PATTERN } from '@/lib/paymentLinks';
import { getAccessProfile } from '@/lib/profileAccess';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function Pay() {
  const { userId } = useAuth();
  const location = useLocation();
  const [prefill, setPrefill] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    setError(''); setPrefill(null);
    if (!userId) return;
    void (async () => {
      try {
        const intent = parsePaymentPath(location.pathname, location.search);
        const recipient = 'recipient' in intent ? intent.recipient : undefined;
        const { data, error: failure } = await (supabase as any).rpc('resolve_payment_destination', {
          p_request: intent.requestId ?? null,
          p_user: recipient && UUID_PATTERN.test(recipient) ? recipient : null,
          p_username: recipient && !UUID_PATTERN.test(recipient) ? recipient : null,
        });
        if (failure || data?.error || !data?.contact?.id) throw new Error(data?.error ?? 'Payment link is unavailable');
        const contact = await getAccessProfile(data.contact.id);
        if (current) setPrefill({ contact: contact ?? data.contact,
          amount: intent.requestId ? data.amount : intent.amount,
          note: intent.requestId ? data.note : intent.note,
          requestId: data.requestId ?? undefined });
      } catch (e) { if (current) setError(e instanceof Error ? e.message : 'Invalid payment link'); }
    })();
    return () => { current = false; };
  }, [userId, location.pathname, location.search]);
  if (!userId) return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (prefill) return <Navigate to="/send-money" state={{ prefill }} replace />;
  return <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
    {error ? <><AlertCircle className="h-8 w-8 text-destructive" /><p role="alert" className="text-foreground text-center">{error}</p><Button variant="outline" onClick={() => window.history.back()}>Back</Button></>
      : <Loader2 className="h-6 w-6 animate-spin text-primary" />}
  </div>;
}