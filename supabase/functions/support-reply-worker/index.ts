import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'
import { kickReplyWorker } from '../_shared/support-delay.ts'

const Body = z.object({ job_id: z.string().uuid(), hops: z.number().int().min(0).max(20) })
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })
const MAX_WAIT_MS = 120_000

const TEAMS: Record<string, { name: string; tone: string }> = {
  support: { name: 'Echats Support Team', tone: 'Technical support: friendly, practical, clear numbered troubleshooting steps.' },
  partnerships: { name: 'Echats Partnerships Team', tone: 'Strategic partnerships: confident, business-minded, explain collaboration opportunities and ask for concrete proposal details.' },
  sales: { name: 'Echats Sales Team', tone: 'Sales & growth: persuasive, benefit-focused; never quote unconfirmed prices, offer to prepare a tailored offer.' },
  admin: { name: 'Echats Trust & Safety Team', tone: 'Trust & safety / legal: formal, precise, policy-based; confirm receipt and review process.' },
  info: { name: 'Echats Communications Team', tone: 'Corporate communications: brief, polite, general information and press inquiries.' },
}

const BASE = `You reply by email on behalf of Echats, an international super app: private chat, voice/video calls, groups and channels, eTok short videos and live streams, Echat AI assistant, Stars, and a wallet (send money, QR payments, PIN on every payment).
Rules:
- Write as a human team member. Never say or imply you are an AI, bot, assistant, model or automated system.
- Reply in the same language as the customer's latest message.
- LANGUAGE QUALITY: if replying in Amharic, write ONLY in correct Ge'ez (Ethiopic) script with proper spelling and grammar. Never mix Arabic, Persian or any other script into Amharic words; write product names like Echats, eTok, Live, Stars, PIN in plain English letters or proper Amharic. Proofread before sending.
- Use the full conversation history; do not repeat earlier answers verbatim.
- SECURITY: never perform, confirm or promise any money transfer, refund, balance change, wallet action, PIN or password change, account deletion, unban or identity change by email; these are done only inside the Echats app or after team review.
- Never ask for passwords, PINs, verification codes or card numbers.
- Do not mention the earlier "we received your message" confirmation.
- Plain text only, no markdown, no placeholders like [Name]. End with the team signature given below.`

async function ai(system: string, messages: { role: string; content: string }[]) {
  const gkey = Deno.env.get('GEMINI_API_KEY')
  if (!gkey) return ''
  try {
    const g = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${gkey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gemini-flash-lite-latest', messages: [{ role: 'system', content: system }, ...messages] }),
    })
    if (g.ok) return String((await g.json())?.choices?.[0]?.message?.content ?? '').trim()
    console.error('worker gemini', g.status, await g.text())
  } catch (e) { console.error('worker gemini failed', e) }
  return ''
}

async function handleJob(admin: any, job: any) {
  const p = job.payload ?? {}
  const mailbox = job.kind === 'app' ? 'support' : (TEAMS[p.mailbox] ? p.mailbox : 'support')
  const team = TEAMS[mailbox]
  const { data: t } = job.ticket_id ? await admin.from('support_tickets').select('*').eq('id', job.ticket_id).maybeSingle() : { data: null }
  if (job.kind === 'app' && (!t || t.admin_reply || t.status !== 'open')) return

  const hist: { role: string; content: string }[] = []
  let msgs: any[] = []
  if (t) {
    hist.push({ role: 'user', content: `Category: ${t.category}\nSubject: ${t.subject}\n\n${t.message}` })
    msgs = (await admin.from('support_ticket_messages').select('*').eq('ticket_id', t.id).order('created_at').limit(40)).data ?? []
    if (t.admin_reply && !msgs.some((m) => m.sender_type !== 'user')) hist.push({ role: 'assistant', content: t.admin_reply })
  } else {
    msgs = (await admin.from('support_ticket_messages').select('*').is('ticket_id', null).eq('sender_email', p.from).order('created_at').limit(40)).data ?? []
  }
  for (const m of msgs) hist.push({ role: m.sender_type === 'user' ? 'user' : 'assistant', content: m.body })
  if (hist.length > 1 && hist[1].role === 'user' && hist[1].content === t?.message) hist.splice(1, 1)

  const reply = await ai(`${BASE}\nDepartment tone: ${team.tone}\nSignature to end with: "Best regards,\n${team.name}" (translate naturally if replying in Amharic, e.g. "ከሰላምታ ጋር፣").`, hist)
  if (!reply) throw new Error('empty reply')

  if (job.kind === 'app') {
    const { data: upd } = await admin.from('support_tickets')
      .update({ admin_reply: reply, status: 'replied', replied_at: new Date().toISOString(), auto_replied: true })
      .eq('id', t.id).is('admin_reply', null).select('*').maybeSingle()
    if (!upd) return
    await admin.from('support_ticket_messages').insert({ ticket_id: upd.id, sender_type: 'ai', sender_email: 'support@echats.site', mailbox: 'support', body: reply })
    const email = (await admin.auth.admin.getUserById(upd.user_id)).data?.user?.email
    if (!email) return
    const { data: prof } = await admin.from('profiles').select('name, username').eq('id', upd.user_id).maybeSingle()
    await sendTemplateEmail('support-reply', email, {
      templateData: { name: prof?.name || prof?.username || '', subject: upd.subject, message: upd.message, reply, ticketRef: upd.id.slice(0, 8).toUpperCase() },
      idempotencyKey: `support-reply-${upd.id}-auto`, replyTo: 'support@echats.site',
    })
  } else {
    await admin.from('support_ticket_messages').insert({ ticket_id: t?.id ?? null, sender_type: 'ai', sender_email: `${mailbox}@echats.site`, mailbox, body: reply })
    const refTag = t ? ` [#${t.id.slice(0, 8).toUpperCase()}]` : ''
    const baseSubj = (p.subject || t?.subject || 'Your message').replace(/^(re:\s*)+/i, '').replace(/\s*\[#[0-9A-F]{8}\]/i, '')
    await sendTemplateEmail('admin-message', p.from, {
      templateData: { subject: `Re: ${baseSubj}${refTag}`.slice(0, 200), message: reply, brandLabel: team.name, replyAddress: `${mailbox}@echats.site` },
      fromName: team.name, replyTo: `${mailbox}@echats.site`, idempotencyKey: `support-job-${job.id}`,
    })
  }
}

async function run(jobId: string, hops: number) {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: job } = await admin.from('support_reply_jobs').select('*').eq('id', jobId).maybeSingle()
  if (!job || job.status !== 'pending') return
  const remaining = new Date(job.due_at).getTime() - Date.now()
  if (remaining > 0) await new Promise((r) => setTimeout(r, Math.min(remaining, MAX_WAIT_MS)))
  if (new Date(job.due_at).getTime() > Date.now() + 1000) {
    if (hops > 0) await kickReplyWorker(jobId, hops - 1)
    else await admin.from('support_reply_jobs').update({ status: 'failed' }).eq('id', jobId)
    return
  }
  const { data: claimed } = await admin.from('support_reply_jobs').update({ status: 'processing' }).eq('id', jobId).eq('status', 'pending').select('*').maybeSingle()
  if (!claimed) return
  try { await handleJob(admin, claimed); await admin.from('support_reply_jobs').update({ status: 'done' }).eq('id', jobId) }
  catch (e) { console.error('reply job failed', e); await admin.from('support_reply_jobs').update({ status: 'failed' }).eq('id', jobId) }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const provided = req.headers.get('x-inbound-secret') ?? ''
  const allowed = [Deno.env.get('INBOUND_EMAIL_SECRET'), Deno.env.get('INBOUND_EMAIL_SECRET_CF')].filter((v): v is string => !!v)
  if (!provided || !allowed.includes(provided)) return json({ error: 'unauthorized' }, 401)
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return json({ error: 'bad request' }, 400)
  const job = run(parsed.data.job_id, parsed.data.hops).catch((e) => console.error('worker run failed', e))
  // @ts-ignore EdgeRuntime is provided by the edge runtime
  EdgeRuntime.waitUntil(job)
  return json({ ok: true }, 202)
})
