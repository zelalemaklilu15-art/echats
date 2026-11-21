import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const Body = z.object({
  from: z.string().trim().email().max(255),
  to: z.string().trim().max(255),
  subject: z.string().max(500).default(''),
  text: z.string().max(100000).default(''),
  auto: z.boolean().optional(),
})
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

type Mailbox = 'support' | 'partnerships' | 'sales' | 'admin' | 'info'
const TEAMS: Record<Mailbox, { name: string; tone: string }> = {
  support: { name: 'Echats Support Team', tone: 'Technical support: friendly, practical, clear numbered troubleshooting steps.' },
  partnerships: { name: 'Echats Partnerships Team', tone: 'Strategic partnerships: confident, business-minded, explain collaboration opportunities (creators, eTok, channels, live, integrations) and ask for concrete proposal details.' },
  sales: { name: 'Echats Sales Team', tone: 'Sales & growth: persuasive, benefit-focused (eTok ads, Stars bulk purchase, merchant payments); never quote prices that are not confirmed, offer to prepare a tailored offer.' },
  admin: { name: 'Echats Trust & Safety Team', tone: 'Trust & safety / legal: formal, precise, policy-based (copyright, abuse reports, legal requests); confirm receipt and review process.' },
  info: { name: 'Echats Communications Team', tone: 'Corporate communications: brief, polite, general information and press inquiries.' },
}
const MAILBOXES = Object.keys(TEAMS) as Mailbox[]

const BASE = `You reply by email on behalf of Echats, an international super app: private chat, voice/video calls, groups and channels, eTok short videos and live streams, Echat AI assistant, Stars, and a wallet (send money, QR payments, PIN on every payment).
Rules:
- Write as a human team member. Never say or imply you are an AI, bot, assistant, model or automated system.
- Reply in the same language as the customer's latest message (Amharic or English or other).
- LANGUAGE QUALITY: if replying in Amharic, write ONLY in correct Ge'ez (Ethiopic) script with proper spelling and grammar. Never mix Arabic, Persian, Latin or any other script into Amharic words; write product names like Echats, eTok, Live, Stars, PIN in plain English letters or proper Amharic (e.g. ቀጥታ ስርጭት). Proofread before sending.
- Use the full conversation history for context; do not repeat earlier answers verbatim, continue the conversation.
- SECURITY: never perform, confirm or promise any money transfer, refund, balance change, wallet action, PIN or password change, account deletion, unban or identity change by email. Politely explain these are done only inside the Echats app for security, or that the team will review.
- Never ask for passwords, PINs, verification codes or card numbers.
- Plain text only, no markdown, no placeholders like [Name]. End with the team signature given below.`

function cleanReply(t: string) {
  const lines = t.replace(/\r/g, '').split('\n')
  const out: string[] = []
  for (const l of lines) {
    if (/^On .+wrote:\s*$/i.test(l.trim()) || /^-{2,}\s*Original Message/i.test(l.trim()) || /^From:\s/i.test(l.trim()) && out.length) break
    if (l.trim().startsWith('>')) continue
    out.push(l)
  }
  return out.join('\n').trim().slice(0, 8000)
}

async function ai(system: string, messages: { role: string; content: string }[]) {
  const gkey = Deno.env.get('GEMINI_API_KEY')
  if (gkey) {
    try {
      const g = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST', headers: { Authorization: `Bearer ${gkey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gemini-flash-lite-latest', messages: [{ role: 'system', content: system }, ...messages] }),
      })
      if (g.ok) { const r = String((await g.json())?.choices?.[0]?.message?.content ?? '').trim(); if (r) return r }
      else console.error('inbound gemini', g.status, await g.text())
    } catch (e) { console.error('inbound gemini failed', e) }
  }
  return ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const provided = req.headers.get('x-inbound-secret') ?? ''
  const allowed = [Deno.env.get('INBOUND_EMAIL_SECRET'), Deno.env.get('INBOUND_EMAIL_SECRET_CF')].filter((v): v is string => !!v)
  if (!provided || !allowed.includes(provided)) {
    console.warn('inbound-email: rejected request with invalid secret')
    return json({ error: 'unauthorized' }, 401)
  }
  try {
    const parsed = Body.safeParse(await req.json())
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
    const { subject, auto } = parsed.data
    const from = parsed.data.from.toLowerCase()
    const local = parsed.data.to.toLowerCase().split('@')[0]
    // Anti-loop: ignore our own addresses, bounces and auto-replies
    if (auto || from.endsWith('@echats.site') || from.endsWith('.echats.site') || /mailer-daemon|postmaster|no-?reply|bounce/.test(from) || /out of office|auto(matic)? reply|delivery status|undeliver/i.test(subject))
      return json({ ok: true, skipped: 'auto' })
    const text = cleanReply(parsed.data.text)
    if (!text) return json({ ok: true, skipped: 'empty' })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Thread lookup by ticket ref like #7534E135
    let ticket: any = null
    const ref = (subject + '\n' + parsed.data.text).match(/#([0-9A-F]{8})\b/i)?.[1]?.toLowerCase()
    const userId: string | null = (await admin.rpc('support_find_user_by_email', { p_email: from })).data ?? null
    if (ref && userId) {
      const { data } = await admin.from('support_tickets').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(200)
      ticket = (data ?? []).find((t: any) => t.id.startsWith(ref)) ?? null
    }
    if (!ticket && userId) {
      const { data } = await admin.from('support_tickets').insert({ user_id: userId, subject: (subject || 'Email request').slice(0, 200), message: text.slice(0, 5000), category: local === 'partnerships' ? 'partnership' : 'email' }).select('*').single()
      ticket = data
    }

    // Rate limit: at most 6 inbound messages per sender per hour get an automatic reply
    const since = new Date(Date.now() - 3600_000).toISOString()
    const { count } = await admin.from('support_ticket_messages').select('id', { count: 'exact', head: true }).eq('sender_email', from).eq('sender_type', 'user').gte('created_at', since)

    // History
    const hist: { role: string; content: string }[] = []
    if (ticket) {
      hist.push({ role: 'user', content: `Subject: ${ticket.subject}\n\n${ticket.message}` })
      const { data: msgs } = await admin.from('support_ticket_messages').select('*').eq('ticket_id', ticket.id).order('created_at').limit(40)
      if (ticket.admin_reply && !(msgs ?? []).some((m: any) => m.sender_type !== 'user')) hist.push({ role: 'assistant', content: ticket.admin_reply })
      for (const m of msgs ?? []) hist.push({ role: m.sender_type === 'user' ? 'user' : 'assistant', content: m.body })
    } else {
      const { data: msgs } = await admin.from('support_ticket_messages').select('*').is('ticket_id', null).eq('sender_email', from).order('created_at').limit(40)
      for (const m of msgs ?? []) hist.push({ role: m.sender_type === 'user' ? 'user' : 'assistant', content: m.body })
    }

    // Department routing: explicit department address wins, otherwise classify
    let mailbox: Mailbox = (MAILBOXES as string[]).includes(local) && local !== 'support' ? local as Mailbox : 'support'
    if (mailbox === 'support') {
      const c = (await ai('Classify the email into exactly one word: support (app problems, account, wallet, bugs), partnerships (business collaboration, creators, investment), sales (ads, buying Stars in bulk, merchant/pricing), admin (copyright, legal, abuse reports, policy), info (press, general questions). Answer with the single word only.', [{ role: 'user', content: `Subject: ${subject}\n\n${text}` }])).toLowerCase()
      const hit = MAILBOXES.find((m) => c.includes(m)); if (hit) mailbox = hit
    }

    await admin.from('support_ticket_messages').insert({ ticket_id: ticket?.id ?? null, sender_type: 'user', sender_email: from, mailbox, subject: subject.slice(0, 500), body: text })
    if (ticket && ticket.status !== 'open') await admin.from('support_tickets').update({ status: 'open' }).eq('id', ticket.id)
    if ((count ?? 0) >= 6) return json({ ok: true, skipped: 'rate' })

    const replyJob = async () => {
    await new Promise((r) => setTimeout(r, 120_000))
    const team = TEAMS[mailbox]
    hist.push({ role: 'user', content: text })
    const reply = await ai(`${BASE}\nDepartment tone: ${team.tone}\nSignature to end with: "Best regards,\n${team.name}" (translate "Best regards" and the team name naturally if replying in Amharic, e.g. "ከሰላምታ ጋር፣").`, hist)
    if (!reply) return

    await admin.from('support_ticket_messages').insert({ ticket_id: ticket?.id ?? null, sender_type: 'ai', sender_email: `${mailbox}@echats.site`, mailbox, body: reply })
    const refTag = ticket ? ` [#${ticket.id.slice(0, 8).toUpperCase()}]` : ''
    const baseSubj = (subject || ticket?.subject || 'Your message').replace(/^(re:\s*)+/i, '').replace(/\s*\[#[0-9A-F]{8}\]/i, '')
    await sendTemplateEmail('admin-message', from, {
      templateData: { subject: `Re: ${baseSubj}${refTag}`.slice(0, 200), message: reply, brandLabel: team.name, replyAddress: `${mailbox}@echats.site` },
      fromName: team.name, replyTo: `${mailbox}@echats.site`,
    })
    }
    const job = replyJob().catch((e) => console.error('inbound reply failed', e))
    // @ts-ignore EdgeRuntime is provided by the edge runtime
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(job); else await job
    return json({ ok: true, queued: true, mailbox })
  } catch (e) {
    console.error('inbound-email failed', e)
    return json({ error: 'failed' }, 500)
  }
})
