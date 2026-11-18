import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const Body = z.object({ action: z.enum(['ban', 'unban', 'wallet_active', 'wallet_suspended', 'password_reset']), user_id: z.string().uuid() })
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const NOTICES: Record<string, [string, string]> = {
  ban: ['Important: your Echats account has been suspended', 'Hello,\n\nAfter a review, your Echats account has been suspended because activity on it did not meet our Terms of Service. While suspended you will not be able to sign in.\n\nIf you believe this is a mistake, simply reply to this email and our team will review your case personally.'],
  unban: ['Welcome back to Echats! 🎉', 'Hello,\n\nGood news — your Echats account has been fully restored. You can sign in again and continue chatting, sharing and using your wallet right away.\n\nThank you for being part of Echats. We are glad to have you back!'],
  wallet_suspended: ['Security notice: your Echat Wallet is temporarily on hold', 'Hello,\n\nTo keep your money safe, your Echat Wallet has been temporarily placed on hold. Your balance is fully protected and nothing has been lost — sending and payments are simply paused for now.\n\nIf you have any questions, reply to this email and our team will help you quickly.'],
  wallet_active: ['Your Echat Wallet is active again ✅', 'Hello,\n\nGreat news — your Echat Wallet has been reactivated. You can send, receive and pay again as usual, and your full balance is available.\n\nThank you for your patience!'],
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = req.headers.get('Authorization') ?? ''
    if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
    const url = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user } } = await userClient.auth.getUser(auth.slice(7))
    if (!user) return json({ error: 'unauthorized' }, 401)
    const { data: ok } = await userClient.rpc('is_super_admin')
    if (!ok) return json({ error: 'not found' }, 404)
    const parsed = Body.safeParse(await req.json())
    if (!parsed.success) return json({ error: 'bad request' }, 400)
    const { action, user_id } = parsed.data
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    if (action === 'password_reset') {
      const { data: u } = await admin.auth.admin.getUserById(user_id)
      const email = u?.user?.email
      if (!email) return json({ error: 'User has no email' }, 400)
      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo: 'https://echats.site/reset-password' })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }
    if (action === 'ban' || action === 'unban') {
      if (user_id === user.id) return json({ error: 'You cannot ban yourself' }, 400)
      const { error } = await admin.auth.admin.updateUserById(user_id, { ban_duration: action === 'ban' ? '876000h' : 'none' })
      if (error) return json({ error: error.message }, 400)
    } else {
      const { error } = await userClient.rpc('admin_set_wallet_status', { p_user: user_id, p_status: action === 'wallet_active' ? 'active' : 'suspended' })
      if (error) return json({ error: error.message }, 400)
    }
    try {
      const { data: u } = await admin.auth.admin.getUserById(user_id)
      const email = u?.user?.email
      const n = NOTICES[action]
      if (email) await sendTemplateEmail('admin-message', email, {
        templateData: { subject: n[0], message: n[1], brandLabel: 'Echats Support Team', replyAddress: 'support@echats.site' },
        idempotencyKey: `admin-${action}-${user_id}-${crypto.randomUUID()}`,
      })
    } catch (e) { console.error('admin notice email failed', e) }
    return json({ ok: true })
  } catch (e) {
    console.error('admin-user-action failed', e)
    return json({ error: 'failed' }, 500)
  }
})
