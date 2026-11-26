import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'

const Body = z.object({
  draft: z.string().trim().min(1).max(4000),
  preset: z.enum(['none', 'ban', 'receipt', 'resolved', 'info']).default('none'),
  tone: z.enum(['friendly', 'firm']).default('friendly'),
  history: z.array(z.object({ from: z.enum(['customer', 'team']), text: z.string().max(4000) })).max(20).default([]),
})
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const PRESETS: Record<string, string> = {
  none: '',
  ban: 'Decision: the account has been restricted/suspended for violating Echats community rules and terms.',
  receipt: 'Request: ask the customer to send a screenshot of their Telebirr/eBirr payment receipt including the transaction ID.',
  resolved: 'Status: the issue has been resolved; thank the customer.',
  info: 'Request: ask the customer for more details needed to investigate.',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const auth = req.headers.get('Authorization') ?? ''
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: isAdmin } = await sb.rpc('is_super_admin')
  if (isAdmin !== true) return json({ error: 'not found' }, 404)

  const p = Body.safeParse(await req.json().catch(() => null))
  if (!p.success) return json({ error: p.error.flatten().fieldErrors }, 400)
  const { draft, preset, tone, history } = p.data

  const system = `You are an editor for the Echats Support Team (an international super app). The admin writes a short, rough note (often in Amharic) stating a DECISION or message. Rewrite it into a complete, polite, professional customer-support reply.
Rules:
- Keep the admin's decision and facts EXACTLY. Never add promises, refunds, amounts, dates or durations the admin did not state. Never soften or reverse a decision.
- Reply in the language of the customer's latest message (if none, use the language of the admin note).
- Amharic must be correct Ge'ez script with proper grammar; keep names like Echats, Telebirr, eBirr, PIN in English letters.
- Tone: ${tone === 'firm' ? 'firm, formal and policy-based, still respectful' : 'warm, friendly and helpful'}.
- Never mention AI, bots or automation. Never ask for passwords, PINs or verification codes.
- Plain text only, no markdown, no placeholders like [Name]. End with: "Echats Support Team" (translated naturally if not English).
Output only the final reply text.`
  const convo = history.map((h) => `${h.from === 'customer' ? 'Customer' : 'Team'}: ${h.text}`).join('\n\n')
  const user = `Conversation so far:\n${convo || '(none)'}\n\n${PRESETS[preset]}\nAdmin note: ${draft}`

  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ error: 'unavailable' }, 503)
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gemini-flash-lite-latest', messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  })
  if (!r.ok) { console.error('polish', r.status, await r.text()); return json({ error: 'rewrite failed' }, 502) }
  const text = String((await r.json())?.choices?.[0]?.message?.content ?? '').trim()
  return text ? json({ text }) : json({ error: 'empty' }, 502)
})
