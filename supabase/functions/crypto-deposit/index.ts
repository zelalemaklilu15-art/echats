import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ success: false, error: 'Unauthorized' }, 401);
  const apiKey = Deno.env.get('NOWPAYMENTS_API_KEY');
  if (!apiKey) return json({ success: false, error: 'Crypto payments are not configured yet' });

  let body: { amount?: unknown; idempotency_key?: unknown; device_id?: unknown; return_url?: unknown };
  try { body = await req.json(); } catch { return json({ success: false, error: 'Invalid body' }, 400); }
  const amount = Number(body.amount);
  const key = typeof body.idempotency_key === 'string' ? body.idempotency_key : '';
  const device = typeof body.device_id === 'string' ? body.device_id : '';
  if (!Number.isFinite(amount)) return json({ success: false, error: 'Invalid amount' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: opened, error } = await user.rpc('crypto_deposit_open', { p_amount: amount, p_key: key, p_device: device });
  if (error) return json({ success: false, error: 'Could not start deposit' });
  const o = opened as { success: boolean; error?: string; order_id?: string; invoice_url?: string };
  if (!o.success) return json(o);
  if (o.invoice_url) return json({ success: true, order_id: o.order_id, invoice_url: o.invoice_url });

  const origin = typeof body.return_url === 'string' && /^https?:\/\//.test(body.return_url) ? body.return_url : undefined;
  const res = await fetch('https://api.nowpayments.io/v1/invoice', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      price_amount: amount, price_currency: 'usd', order_id: o.order_id,
      order_description: 'eChat Wallet top-up',
      ipn_callback_url: `${url}/functions/v1/crypto-webhook`,
      success_url: origin, cancel_url: origin,
    }),
  });
  const inv = await res.json().catch(() => ({}));
  if (!res.ok || !inv.invoice_url) return json({ success: false, error: 'Crypto provider unavailable, try again' });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  await admin.rpc('crypto_deposit_attach', { p_order: o.order_id, p_invoice: String(inv.id), p_url: inv.invoice_url });
  return json({ success: true, order_id: o.order_id, invoice_url: inv.invoice_url });
});
