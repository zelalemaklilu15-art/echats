import { createClient } from 'npm:@supabase/supabase-js@2';

// NOWPayments IPN: signature is HMAC-SHA512 of the JSON body with keys sorted.
const sortKeys = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(sortKeys)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v as object).sort().map(k => [k, sortKeys((v as Record<string, unknown>)[k])]))
    : v;

async function hmac(secret: string, msg: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const secret = Deno.env.get('NOWPAYMENTS_IPN_SECRET');
  if (!secret) return new Response('not configured', { status: 503 });
  const raw = await req.text();
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return new Response('bad', { status: 400 }); }
  const expected = await hmac(secret, JSON.stringify(sortKeys(body)));
  const got = (req.headers.get('x-nowpayments-sig') ?? '').toLowerCase();
  if (got.length !== expected.length || got !== expected) return new Response('signature', { status: 401 });

  const order = String(body.order_id ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(order)) return new Response('order', { status: 400 });
  const status = String(body.payment_status ?? '');
  const map: Record<string, string> = { finished: 'finished', failed: 'failed', expired: 'expired', refunded: 'refunded' };
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await admin.rpc('crypto_deposit_settle', {
    p_order: order, p_status: map[status] ?? status.slice(0, 30),
    p_price: body.price_amount != null ? Number(body.price_amount) : null,
    p_pay_currency: typeof body.pay_currency === 'string' ? body.pay_currency.slice(0, 20) : null,
  });
  if (error) return new Response('error', { status: 500 });
  return new Response('ok');
});
