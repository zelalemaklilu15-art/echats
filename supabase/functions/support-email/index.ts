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
    } else if (email) {
      await sendTemplateEmail('support-reply', email, { templateData: data, idempotencyKey: `support-reply-${t.id}-${t.replied_at}`, replyTo: 'support@echats.site' })
    }
    return json({ ok: true })
  } catch (e) {
    console.error('support-email failed', e)
    return json({ error: 'send failed' }, 500)
  }
})
