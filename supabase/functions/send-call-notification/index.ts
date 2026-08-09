import { corsHeaders } from '../_shared/cors.ts';
import { sendPushToUser, adminClient } from '../_shared/fcm.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface CallPushPayload {
  receiverId: string;
  callType: 'voice' | 'video';
  roomId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerUserId = claimsData.claims.sub as string;

    const payload = (await req.json()) as CallPushPayload;
    const { receiverId, callType, roomId } = payload;

    if (!receiverId || !callType || !roomId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (receiverId === callerUserId) {
      return new Response(JSON.stringify({ error: 'Cannot call yourself' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve the caller name server-side to prevent impersonation.
    const supabase = adminClient();
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('name, username')
      .eq('id', callerUserId)
      .maybeSingle();
    const callerName = callerProfile?.name || callerProfile?.username || 'Someone';

    const callTypeText = callType === 'video' ? 'Video' : 'Voice';
    const result = await sendPushToUser(receiverId, {
      title: `Incoming ${callTypeText} Call`,
      body: `${callerName} is calling you`,
      tag: 'incoming-call',
      highPriority: true,
      url: '/',
      data: {
        type: 'incoming_call',
        roomId,
        callType,
        callerId: callerUserId,
        callerName,
      },
    });

    if (!result.configured) {
      return new Response(
        JSON.stringify({ error: 'Push notifications not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ message: 'Notifications processed', ...result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Push] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
