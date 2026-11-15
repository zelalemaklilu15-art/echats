import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'

const Body = z.object({ action: z.enum(['ban', 'unban']), user_id: z.string().uuid() })
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

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
    if (user_id === user.id) return json({ error: 'You cannot ban yourself' }, 400)
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { error } = await admin.auth.admin.updateUserById(user_id, { ban_duration: action === 'ban' ? '876000h' : 'none' })
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  } catch (e) {
    console.error('admin-user-action failed', e)
    return json({ error: 'failed' }, 500)
  }
})
