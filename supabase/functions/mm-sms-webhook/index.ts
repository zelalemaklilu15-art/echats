// Receives payment SMS from the private Echats receiver phone.
// Every request must be signed (ECDSA P-256 / SHA-256) by a registered device key.
import { createClient } from 'npm:@supabase/supabase-js@2'

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))

// Android Keystore emits DER signatures; WebCrypto wants raw r||s
function derToRaw(sig: Uint8Array): Uint8Array {
  if (sig.length === 64) return sig
  if (sig[0] !== 0x30) throw new Error('bad sig')
  let o = 2; if (sig[1] & 0x80) o = 2 + (sig[1] & 0x7f)
  const read = () => { if (sig[o] !== 0x02) throw new Error('bad sig'); const l = sig[o + 1]; let v = sig.slice(o + 2, o + 2 + l); o += 2 + l
    while (v.length > 32 && v[0] === 0) v = v.slice(1); const out = new Uint8Array(32); out.set(v, 32 - v.length); return out }
  const r = read(), s = read(); const raw = new Uint8Array(64); raw.set(r); raw.set(s, 32); return raw
}

export function parseSms(provider: string, text: string) {
  const t = text.replace(/\s+/g, ' ')
  const amount = t.match(/(?:ETB|Birr|ብር)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|Birr|ብር)/i)
  // Telebirr: 10 letters/digits (e.g. DKN0KRZYF4); eBirr: 12 digits (e.g. 802838867703)
  const idPat = provider === 'ebirr' ? '(\\d{12})' : '([A-Z0-9]{10})'
  const txid = t.match(new RegExp(`(?:transaction (?:number|id)|trans(?:action)? ?(?:no|id)|txn ?id|ref(?:erence)?(?: no)?)\\s*[:#]?\\s*(?:is\\s*)?${idPat}\\b`, 'i'))
  if (txid && provider === 'telebirr' && !/[A-Z]/i.test(txid[1])) return null
  const phone = t.match(/(?:\+?251|0)\s?([79]\d{8})/)
  if (!amount || !txid) return null
  return { amount: Number((amount[1] ?? amount[2]).replace(/,/g, '')), txid: txid[1].toUpperCase(), phone: phone ? '0' + phone[1] : null, provider }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const deviceId = req.headers.get('x-device-id') ?? '', ts = req.headers.get('x-timestamp') ?? '',
    nonce = req.headers.get('x-nonce') ?? '', sig = req.headers.get('x-signature') ?? ''
  const body = await req.text()
  if (!/^[0-9a-f-]{36}$/.test(deviceId) || !/^\d{10,13}$/.test(ts) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !sig || body.length > 4000)
    return json({ error: 'unauthorized' }, 401)
  const tsMs = ts.length === 10 ? Number(ts) * 1000 : Number(ts)
  if (Math.abs(Date.now() - tsMs) > 5 * 60_000) return json({ error: 'stale' }, 401)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: dev } = await db.from('mm_receiver_devices').select('id, public_key_jwk, active').eq('id', deviceId).maybeSingle()
  if (!dev?.active) return json({ error: 'unauthorized' }, 401)
  try {
    const key = await crypto.subtle.importKey('jwk', dev.public_key_jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(b64(sig)), new TextEncoder().encode(`${ts}.${nonce}.${body}`))
    if (!ok) return json({ error: 'unauthorized' }, 401)
  } catch { return json({ error: 'unauthorized' }, 401) }

  const { error: nErr } = await db.from('mm_nonces').insert({ device_id: deviceId, nonce })
  if (nErr) return json({ error: 'replay' }, 401)
  await db.from('mm_receiver_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', deviceId)

  let p: { sender?: string; text?: string; received_at?: number; heartbeat?: boolean }
  try { p = JSON.parse(body) } catch { return json({ error: 'bad body' }, 400) }
  if (p.heartbeat) return json({ ok: true })
  const sender = String(p.sender ?? '').toLowerCase()
  const provider = sender.includes('telebirr') || sender === '127' ? 'telebirr' : sender.includes('ebirr') ? 'ebirr' : null
  if (!provider || typeof p.text !== 'string') return json({ ok: true, ignored: 'sender' })
  const parsed = parseSms(provider, p.text)
  if (!parsed || !(parsed.amount > 0)) { console.warn('mm-sms-webhook: unparsed sms'); return json({ ok: true, ignored: 'format' }) }
  const received = new Date(typeof p.received_at === 'number' ? p.received_at : Date.now())
  const { data, error } = await db.rpc('mm_ingest_sms', { p_device: deviceId, p_provider: provider, p_txid: parsed.txid,
    p_amount: parsed.amount, p_phone: parsed.phone, p_raw: p.text, p_received: received.toISOString() })
  if (error) { console.error('mm-sms-webhook', error.message); return json({ error: 'failed' }, 500) }
  return json({ ok: true, result: data })
})
