import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const MAX_FAILS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const RESEND_MS = 60 * 1000;

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function sessionIdOf(token: string): string | null {
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof p.session_id === 'string' ? p.session_id : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ ok: false, error: 'METHOD' }, 405);
  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return reply({ ok: false, error: 'UNAUTHORIZED' }, 401);
  const token = authorization.slice(7);
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user } } = await userClient.auth.getUser();
  const sessionId = sessionIdOf(token);
  if (!user || !user.email) return reply({ ok: false, error: 'UNAUTHORIZED' }, 401);

  let body: { action?: string; code?: string; purpose?: string } = {};
  try { body = await req.json(); } catch { return reply({ ok: false, error: 'INVALID' }, 400); }
  const action = body.action;

  const { data: settings } = await admin.from('user_2fa_settings').select('enabled').eq('user_id', user.id).maybeSingle();
  const enabled = !!settings?.enabled;
  const { data: ver } = await admin.from('session_2fa_verifications').select('session_id').eq('session_id', sessionId ?? '00000000-0000-0000-0000-000000000000').eq('user_id', user.id).maybeSingle();

  if (action === 'status') return reply({ ok: true, enabled, verified: !enabled || !!ver, email: user.email });

  const { data: att } = await admin.from('email_2fa_attempts').select('*').eq('user_id', user.id).maybeSingle();
  const now = Date.now();
  const windowFresh = att && now - new Date(att.window_start).getTime() < WINDOW_MS;
  const fails = windowFresh ? att!.failed_count : 0;

  if (action === 'send') {
    if (att?.last_sent_at && now - new Date(att.last_sent_at).getTime() < RESEND_MS) return reply({ ok: false, error: 'WAIT' });
    const otp = createClient(url, anon, { auth: { persistSession: false } });
    const { error } = await otp.auth.signInWithOtp({ email: user.email, options: { shouldCreateUser: false } });
    if (error) return reply({ ok: false, error: error.status === 429 ? 'WAIT' : 'SEND_FAILED' });
    await admin.from('email_2fa_attempts').upsert({
      user_id: user.id, last_sent_at: new Date().toISOString(),
      failed_count: fails, window_start: windowFresh ? att!.window_start : new Date().toISOString(),
    });
    return reply({ ok: true });
  }

  if (action === 'verify') {
    if (!sessionId) return reply({ ok: false, error: 'UNAUTHORIZED' }, 401);
    const purpose = body.purpose;
    if (!['login', 'enable', 'disable'].includes(purpose ?? '')) return reply({ ok: false, error: 'INVALID' }, 400);
    if (fails >= MAX_FAILS) return reply({ ok: false, error: 'LOCKED' });
    const code = String(body.code ?? '').trim();
    if (!/^\d{6,8}$/.test(code)) return reply({ ok: false, error: 'WRONG_CODE' });
    const otp = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await otp.auth.verifyOtp({ email: user.email, token: code, type: 'email' });
    if (error || !data.session || data.user?.id !== user.id) {
      await admin.from('email_2fa_attempts').upsert({
        user_id: user.id, failed_count: fails + 1,
        window_start: windowFresh ? att!.window_start : new Date().toISOString(), last_sent_at: att?.last_sent_at ?? null,
      });
      return reply({ ok: false, error: fails + 1 >= MAX_FAILS ? 'LOCKED' : 'WRONG_CODE', remaining: Math.max(0, MAX_FAILS - fails - 1) });
    }
    // The code proved email ownership; discard the extra session it created.
    await admin.auth.admin.signOut(data.session.access_token, 'local').catch(() => {});
    await admin.from('email_2fa_attempts').upsert({ user_id: user.id, failed_count: 0, window_start: new Date().toISOString(), last_sent_at: att?.last_sent_at ?? null });

    if (purpose === 'disable') {
      if (enabled && !ver) return reply({ ok: false, error: 'NOT_VERIFIED' });
      await admin.from('user_2fa_settings').upsert({ user_id: user.id, enabled: false, updated_at: new Date().toISOString() });
      return reply({ ok: true, enabled: false });
    }
    if (purpose === 'enable') {
      await admin.from('user_2fa_settings').upsert({ user_id: user.id, enabled: true, updated_at: new Date().toISOString() });
    }
    await admin.from('session_2fa_verifications').upsert({ session_id: sessionId, user_id: user.id });
    return reply({ ok: true, enabled: purpose === 'enable' ? true : enabled });
  }
  return reply({ ok: false, error: 'INVALID' }, 400);
});
