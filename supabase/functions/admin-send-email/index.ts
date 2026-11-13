import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const MAILBOXES = {
  support: 'Echat Support',
  info: 'Echat Info',
  contact: 'Echat Contact',
  admin: 'Echat Admin',
} as const
const Body = z.object({
  from: z.enum(['support', 'info', 'contact', 'admin']),
  to: z.string().trim().email().max(255),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(10000),
})
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = req.headers.get('Authorization') ?? ''
    if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user } } = await userClient.auth.getUser(auth.slice(7))
    if (!user) return json({ error: 'unauthorized' }, 401)
    const { data: ok } = await userClient.rpc('is_super_admin')
    if (!ok) return json({ error: 'not found' }, 404)
    const parsed = Body.safeParse(await req.json())
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
    const { from, to, subject, message } = parsed.data
    const replyTo = `${from}@echats.site`
    const r = await sendTemplateEmail('admin-message', to, {
      templateData: { subject, message, brandLabel: MAILBOXES[from], replyAddress: replyTo },
      fromName: MAILBOXES[from], replyTo,
    })
    if (!r.sent) return json({ error: 'recipient_suppressed' }, 422)
    return json({ ok: true })
  } catch (e) {
    console.error('admin-send-email failed', e)
    return json({ error: 'send failed' }, 500)
  }
})
