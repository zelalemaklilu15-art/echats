// Payment requests are stored on the server so the other person sees them
// (and gets a notification). Status changes go through server functions.
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export interface ServerPaymentRequest {
  id: string;
  requester_id: string;
  payer_id: string;
  amount: number;
  note: string;
  status: 'pending' | 'paid' | 'declined' | 'cancelled';
  created_at: string;
  other?: { id: string; name: string; username: string; avatar_url?: string };
}

export async function createPaymentRequest(payerId: string, amount: number, note: string) {
  const { data, error } = await db
    .from('payment_requests')
    .insert({ requester_id: (await supabase.auth.getUser()).data.user?.id, payer_id: payerId, amount, note })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ServerPaymentRequest;
}

async function withProfiles(rows: ServerPaymentRequest[], uid: string) {
  const ids = [...new Set(rows.map(r => (r.requester_id === uid ? r.payer_id : r.requester_id)))];
  const profiles = await Promise.all(ids.map(id => supabase.rpc('get_public_profile', { profile_id: id })));
  const map = new Map<string, any>();
  profiles.forEach(p => { const row = (p.data as any[])?.[0]; if (row) map.set(row.id, row); });
  return rows.map(r => {
    const p = map.get(r.requester_id === uid ? r.payer_id : r.requester_id);
    return { ...r, amount: Number(r.amount), other: p ? { id: p.id, name: p.name || p.username, username: p.username, avatar_url: p.avatar_url } : undefined };
  });
}

/** Pending requests other people sent to me. */
export async function getIncomingRequests(uid: string) {
  const { data, error } = await db.from('payment_requests').select('*')
    .eq('payer_id', uid).eq('status', 'pending').order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return withProfiles(data ?? [], uid);
}

/** Requests I sent. */
export async function getOutgoingRequests(uid: string) {
  const { data, error } = await db.from('payment_requests').select('*')
    .eq('requester_id', uid).order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return withProfiles(data ?? [], uid);
}

export async function respondToRequest(id: string, action: 'decline' | 'cancel') {
  const { error } = await db.rpc('respond_payment_request', { p_id: id, p_action: action });
  if (error) throw new Error(error.message);
}

/** One-time upload of pending requests that were only saved on this phone. */
export async function migrateLocalRequests(uid: string) {
  const key = `echat_payment_requests_${uid}`;
  const done = `echat_payment_requests_migrated_${uid}`;
  if (localStorage.getItem(done)) return;
  try {
    const local = JSON.parse(localStorage.getItem(key) || '[]');
    const pending = local.filter((r: any) => r.status === 'pending' && r.toUserId && r.amount > 0);
    if (pending.length) {
      const { error } = await db.from('payment_requests').insert(
        pending.map((r: any) => ({ requester_id: uid, payer_id: r.toUserId, amount: r.amount, note: r.reason || '' })),
      );
      if (error) return;
    }
    localStorage.setItem(done, '1');
  } catch { /* ignore */ }
}
