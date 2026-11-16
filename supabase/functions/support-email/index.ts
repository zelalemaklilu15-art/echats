import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const Body = z.object({ event: z.enum(['created', 'replied']), ticket_id: z.string().uuid() })
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const auth = req.headers.get('Authorization') ?? ''
    if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user } } = await userClient.auth.getUser(auth.slice(7))
    if (!user) return json({ error: 'unauthorized' }, 401)
    const parsed = Body.safeParse(await req.json())
    if (!parsed.success) return json({ error: 'bad request' }, 400)
    const { event, ticket_id } = parsed.data

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: t } = await admin.from('support_tickets').select('*').eq('id', ticket_id).maybeSingle()
    if (!t) return json({ error: 'not found' }, 404)
    if (event === 'created' && t.user_id !== user.id) return json({ error: 'not found' }, 404)
    if (event === 'replied') {
      const { data: ok } = await userClient.rpc('is_super_admin')
      if (!ok || !t.admin_reply) return json({ error: 'not found' }, 404)
    }
    const { data: owner } = await admin.auth.admin.getUserById(t.user_id)
    const email = owner?.user?.email
    const { data: prof } = await admin.from('profiles').select('name, username').eq('id', t.user_id).maybeSingle()
    const data = { name: prof?.name || prof?.username || '', email, subject: t.subject, message: t.message, category: t.category, reply: t.admin_reply, ticketRef: t.id.slice(0, 8).toUpperCase() }

    if (event === 'created') {
      await sendTemplateEmail('support-alert', '', { templateData: data, idempotencyKey: `support-alert-${t.id}`, replyTo: email })
      if (email) await sendTemplateEmail('support-received', email, { templateData: data, idempotencyKey: `support-received-${t.id}`, replyTo: 'support@echats.site' })
      // @ts-ignore EdgeRuntime is provided by the runtime
      EdgeRuntime.waitUntil(autoReply(admin, t.id))
    } else if (email) {
      await sendTemplateEmail('support-reply', email, { templateData: data, idempotencyKey: `support-reply-${t.id}-${t.replied_at}`, replyTo: 'support@echats.site' })
    }
    return json({ ok: true })
  } catch (e) {
    console.error('support-email failed', e)
    return json({ error: 'send failed' }, 500)
  }
})

const SUPPORT_PROMPT = `You are a senior member of the Echats Support Team replying by email to a customer.
Echats is an international super app: private chat, voice/video calls, groups and channels, eTok short videos and live streams, Echat AI assistant (15 free questions per day), Stars, and a wallet (send money, QR payments, PIN on every payment).
Rules:
- Write as a human support specialist. Never say or imply you are an AI, bot, assistant, model or automated system.
- Reply in the same language the customer wrote in.
- Be warm, concise and practical: acknowledge the issue, give clear numbered steps when useful.
- Never promise refunds, balance changes, account deletion or unbans; say the team is reviewing and will follow up.
- Never ask for passwords, PINs or verification codes.
- Do not add a greeting line with a name placeholder or a signature; end with: "Best regards,\nEchats Support Team".
- Plain text only, no markdown.`

async function autoReply(admin: any, id: string) {
  try {
    await new Promise((r) => setTimeout(r, 120_000))
    const { data: t } = await admin.from('support_tickets').select('*').eq('id', id).maybeSingle()
    if (!t || t.admin_reply || t.status !== 'open') return
    const userText = `Category: ${t.category}\nSubject: ${t.subject}\n\n${t.message}`
    let reply = ''
    const gkey = Deno.env.get('GEMINI_API_KEY')
    if (gkey) {
      try {
        const g = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${gkey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gemini-flash-lite-latest', messages: [{ role: 'system', content: SUPPORT_PROMPT }, { role: 'user', content: userText }] }),
        })
        if (g.ok) reply = String((await g.json())?.choices?.[0]?.message?.content ?? '').trim()
        else console.error('auto reply gemini', g.status, await g.text())
      } catch (e) { console.error('auto reply gemini failed', e) }
    }
    if (!reply) {
    const key = Deno.env.get('LOVABLE_API_KEY')
    if (!key) return
    const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Lovable-API-Key': key, 'X-Lovable-AIG-SDK': 'fetch', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-6-astra',
        instructions: SUPPORT_PROMPT,
        input: [{ role: 'user', content: `Category: ${t.category}\nSubject: ${t.subject}\n\n${t.message}` }],
        store: false,
      }),
    })
    if (!res.ok) { console.error('auto reply gateway', res.status, await res.text()); return }
    const out = await res.json()
    reply = String(out?.output_text ?? (out?.output ?? []).flatMap((o: any) => o?.content ?? []).filter((c: any) => c?.type === 'output_text').map((c: any) => c.text).join('') ?? '').trim()
    }
    if (!reply) return
    const { data: upd } = await admin.from('support_tickets')
      .update({ admin_reply: reply, status: 'replied', replied_at: new Date().toISOString(), auto_replied: true })
      .eq('id', id).is('admin_reply', null).select('*').maybeSingle()
    if (!upd) return
    const { data: owner } = await admin.auth.admin.getUserById(upd.user_id)
    const email = owner?.user?.email
    if (!email) return
    const { data: prof } = await admin.from('profiles').select('name, username').eq('id', upd.user_id).maybeSingle()
    await sendTemplateEmail('support-reply', email, {
      templateData: { name: prof?.name || prof?.username || '', subject: upd.subject, message: upd.message, reply, ticketRef: upd.id.slice(0, 8).toUpperCase() },
      idempotencyKey: `support-reply-${upd.id}-auto`, replyTo: 'support@echats.site',
    })
  } catch (e) { console.error('auto reply failed', e) }
}
