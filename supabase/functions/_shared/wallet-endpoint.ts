import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/** Authenticate first; let one database transaction authorize and commit the operation. */
export function serveWalletOperation(rpc: string, args: (body: Record<string, unknown>, req: Request) => Record<string, unknown>) {
  Deno.serve(async req => {
    const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return reply({ success: false, error: 'Method not allowed' }, 405);
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return reply({ success: false, error: 'Unauthorized' }, 401);
    try {
      const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: authorization } },
      });
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) return reply({ success: false, error: 'Unauthorized' }, 401);
      const { data: twoFaOk } = await client.rpc('is_session_2fa_ok');
      if (twoFaOk !== true) return reply({ success: false, error: 'TWO_STEP_REQUIRED' });
      const body = await req.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ success: false, error: 'Invalid request' }, 400);
      const { data, error } = await client.rpc(rpc, args(body, req));
      if (error) return reply({ success: false, error: 'Could not complete this wallet operation. Please retry.' });
      return reply(data);
    } catch {
      return reply({ success: false, error: 'Invalid wallet request' }, 400);
    }
  });
}