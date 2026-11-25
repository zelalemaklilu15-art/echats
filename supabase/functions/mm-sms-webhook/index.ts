// Receives payment SMS from the private Echats receiver phone.
// Two accepted auth modes:
//   A) Shared secret header `x-webhook-secret` (used by the ready-made phone
//      forwarder, which cannot produce a cryptographic signature).
//   B) ECDSA P-256 / SHA-256 signature by a registered device key (custom APK).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { extractBody, parseSms, pickProvider } from './parse.ts'

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))

// The receiver phone that runs the forwarder. Fixed so every forwarded SMS is
// attributed to one known device even on the shared-secret path.
const RECEIVER_DEVICE_ID = '26c1cda9-06b6-4a21-98bc-b16e056e34c7'

// Android Keystore emits DER signatures; WebCrypto wants raw r||s
function derToRaw(sig: Uint8Array): Uint8Array {
  if (sig.length === 64) return sig
  if (sig[0] !== 0x30) throw new Error('bad sig')
  let o = 2; if (sig[1] & 0x80) o = 2 + (sig[1] & 0x7f)
  const read = () => { if (sig[o] !== 0x02) throw new Error('bad sig'); const l = sig[o + 1]; let v = sig.slice(o + 2, o + 2 + l); o += 2 + l
    while (v.length > 32 && v[0] === 0) v = v.slice(1); const out = new Uint8Array(32); out.set(v, 32 - v.length); return out }
  const r = read(), s = read(); const raw = new Uint8Array(64); raw.set(r); raw.set(s, 32); return raw
}

// Constant-time compare so a wrong secret cannot be discovered byte by byte.
function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const body = await req.text()
  if (body.length > 4000) return json({ error: 'unauthorized' }, 401)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // ---- Mode A: shared secret from the trusted receiver phone -----------------
  const secret = req.headers.get('x-webhook-secret') ?? ''
  const expected = Deno.env.get('MM_SMS_WEBHOOK_SECRET') ?? ''
  let deviceId = ''
  if (secret && expected && sameSecret(secret, expected)) {
    deviceId = RECEIVER_DEVICE_ID
    await db.from('mm_receiver_devices').upsert(
      { id: RECEIVER_DEVICE_ID, label: 'receiver-phone-forwarder', public_key_jwk: { auth: 'shared-secret' }, active: true, last_seen_at: new Date().toISOString() },
      { onConflict: 'id' },
    )
  } else {
    // ---- Mode B: signed request from a registered device --------------------
    const deviceIdHdr = req.headers.get('x-device-id') ?? '', ts = req.headers.get('x-timestamp') ?? '',
      nonce = req.headers.get('x-nonce') ?? '', sig = req.headers.get('x-signature') ?? ''
    if (!/^[0-9a-f-]{36}$/.test(deviceIdHdr) || !/^\d{10,13}$/.test(ts) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !sig)
      return json({ error: 'unauthorized' }, 401)
    const tsMs = ts.length === 10 ? Number(ts) * 1000 : Number(ts)
    if (Math.abs(Date.now() - tsMs) > 5 * 60_000) return json({ error: 'stale' }, 401)

    const { data: dev } = await db.from('mm_receiver_devices').select('id, public_key_jwk, active').eq('id', deviceIdHdr).maybeSingle()
    if (!dev?.active) return json({ error: 'unauthorized' }, 401)
    try {
      const key = await crypto.subtle.importKey('jwk', dev.public_key_jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
      const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(b64(sig)), new TextEncoder().encode(`${ts}.${nonce}.${body}`))
      if (!ok) return json({ error: 'unauthorized' }, 401)
    } catch { return json({ error: 'unauthorized' }, 401) }

    const { error: nErr } = await db.from('mm_nonces').insert({ device_id: deviceIdHdr, nonce })
    if (nErr) return json({ error: 'replay' }, 401)
    await db.from('mm_receiver_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', deviceIdHdr)
    deviceId = deviceIdHdr
  }

  const p = extractBody(body, req.headers.get('content-type') ?? '')
  if (p.heartbeat) return json({ ok: true })
  if (typeof p.text !== 'string' || !p.text.trim()) return json({ ok: true, ignored: 'empty' })

  const provider = pickProvider(String(p.sender ?? ''), p.text)
  if (!provider) return json({ ok: true, ignored: 'sender' })
  const parsed = parseSms(provider, p.text)
  if (!parsed || !(parsed.amount > 0)) { console.warn('mm-sms-webhook: unparsed sms'); return json({ ok: true, ignored: 'format' }) }

  const received = new Date()
  const { data, error } = await db.rpc('mm_ingest_sms', { p_device: deviceId, p_provider: provider, p_txid: parsed.txid,
    p_amount: parsed.amount, p_phone: parsed.phone, p_raw: p.text, p_received: received.toISOString() })
  if (error) { console.error('mm-sms-webhook', error.message); return json({ error: 'failed' }, 500) }
  return json({ ok: true, result: data })
})
