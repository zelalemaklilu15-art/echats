// Shared, runtime-agnostic parsing helpers for the receiver-phone SMS webhook.
// Kept separate from index.ts so the same rules can be unit-tested.

export type Parsed = { amount: number; txid: string; phone: string | null; provider: string }

export function parseSms(provider: string, text: string): Parsed | null {
  const t = text.replace(/\s+/g, ' ')
  const amount = t.match(/(?:ETB|Birr|ብር)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|Birr|ብር)/i)
  // Telebirr: 10 letters/digits (e.g. DKN0KRZYF4); eBirr: 12 digits (e.g. 802838867703)
  const idPat = provider === 'ebirr' ? '(\\d{12})' : '([A-Z0-9]{10})'
  const txid = t.match(new RegExp(`(?:transaction (?:number|id)|trans(?:action)? ?(?:no|id)|txn ?id|ref(?:erence)?(?: no)?)\\s*[:#]?\\s*(?:is\\s*)?${idPat}\\b`, 'i'))
  if (txid && provider === 'telebirr' && !/[A-Z]/i.test(txid[1])) return null
  const phone = t.match(/(?<!\d)(?:\+?251\s?|0)?([79]\d{8})(?!\d)/)
  if (!amount || !txid) return null
  return { amount: Number((amount[1] ?? amount[2]).replace(/,/g, '')), txid: txid[1].toUpperCase(), phone: phone ? '0' + phone[1] : null, provider }
}

// Sender names seen in the wild: "telebirr", "127", "eBirr". When the forwarder
// cannot tell us who sent it, fall back to the wording of the message itself.
export function pickProvider(sender: string, text = ''): 'telebirr' | 'ebirr' | null {
  const s = (sender ?? '').toLowerCase()
  if (s.includes('telebirr') || s === '127') return 'telebirr'
  if (s.includes('ebirr')) return 'ebirr'
  if (!text) return null
  const t = text.toLowerCase()
  if (t.includes('telebirr')) return 'telebirr'
  if (t.includes('ebirr')) return 'ebirr'
  return null
}

export type Body = { sender?: string; text?: string; heartbeat?: boolean }

// The phone forwarder may post JSON, url-encoded form fields, or plain text.
// A raw SMS can contain newlines or quotes that break hand-built JSON, so the
// JSON branch recovers the fields leniently before giving up.
export function extractBody(body: string, ctype: string): Body {
  if (ctype.includes('x-www-form-urlencoded')) {
    const p = new URLSearchParams(body)
    return { sender: p.get('sender') ?? undefined, text: p.get('text') ?? undefined, heartbeat: p.get('heartbeat') === 'true' }
  }
  try {
    const j = JSON.parse(body)
    if (j && typeof j === 'object') {
      return {
        sender: typeof j.sender === 'string' ? j.sender : undefined,
        text: typeof j.text === 'string' ? j.text : undefined,
        heartbeat: j.heartbeat === true,
      }
    }
  } catch {
    const s = body.match(/"sender"\s*:\s*"([^"]*)"/)
    const t = body.match(/"text"\s*:\s*"([\s\S]*?)"\s*}\s*$/)
    if (t) return { sender: s?.[1], text: t[1].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"') }
  }
  return { text: body }
}
