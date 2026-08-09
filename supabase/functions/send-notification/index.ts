import { corsHeaders } from '../_shared/cors.ts';
import { sendPushToUser, adminClient } from '../_shared/fcm.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Kind = 'direct_message' | 'group_message' | 'gift' | 'story' | 'payment_request';

interface Payload {
  kind: Kind;
  /** Required for direct_message / gift / story / payment_request */
  receiverId?: string;
  /** Required for group_message */
  groupId?: string;
  /** Short preview text (message body, gift name, amount, ...) */
  preview?: string;
  /** Deep link path inside the app */
  url?: string;
}

const MAX_PREVIEW = 120;

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
    const senderId = claimsData.claims.sub as string;

    const body = (await req.json()) as Payload;
    const kind = body.kind;
    const validKinds: Kind[] = ['direct_message', 'group_message', 'gift', 'story', 'payment_request'];
    if (!kind || !validKinds.includes(kind)) {
      return new Response(JSON.stringify({ error: 'Invalid notification kind' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const preview = (body.preview ?? '').toString().slice(0, MAX_PREVIEW);
    const supabase = adminClient();

    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('name, username')
      .eq('id', senderId)
      .maybeSingle();
    const senderName = senderProfile?.name || senderProfile?.username || 'Someone';

    // ---- Group broadcast ----
    if (kind === 'group_message') {
      if (!body.groupId) {
        return new Response(JSON.stringify({ error: 'groupId is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: membership } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', body.groupId);
      const members = (membership ?? []).map((m: { user_id: string }) => m.user_id);
      if (!members.includes(senderId)) {
        return new Response(JSON.stringify({ error: 'Not a group member' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: group } = await supabase
        .from('groups')
        .select('name')
        .eq('id', body.groupId)
        .maybeSingle();

      let sent = 0;
      for (const memberId of members.filter((m) => m !== senderId)) {
        const res = await sendPushToUser(memberId, {
          title: group?.name ? `${group.name}` : 'New group message',
          body: `${senderName}: ${preview || 'sent a message'}`,
          tag: `group-${body.groupId}`,
          url: body.url ?? `/group/${body.groupId}`,
          data: { type: 'group_message', groupId: body.groupId, senderId },
        });
        sent += res.sent;
      }
      return new Response(JSON.stringify({ message: 'Group notifications processed', sent }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Single recipient ----
    const receiverId = body.receiverId;
    if (!receiverId || receiverId === senderId) {
      return new Response(JSON.stringify({ error: 'Invalid receiverId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (kind === 'direct_message') {
      const { data: chat } = await supabase
        .from('chats')
        .select('id')
        .or(
          `and(participant_1.eq.${senderId},participant_2.eq.${receiverId}),and(participant_1.eq.${receiverId},participant_2.eq.${senderId})`,
        )
        .maybeSingle();
      if (!chat) {
        return new Response(JSON.stringify({ error: 'No chat with this user' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const titles: Record<Exclude<Kind, 'group_message'>, string> = {
      direct_message: senderName,
      gift: `🎁 Gift from ${senderName}`,
      story: `${senderName} added a story`,
      payment_request: `💸 Payment request from ${senderName}`,
    };

    const result = await sendPushToUser(receiverId, {
      title: titles[kind as Exclude<Kind, 'group_message'>],
      body: preview || 'Open Echat to see more',
      tag: `${kind}-${senderId}`,
      url: body.url ?? '/',
      data: { type: kind, senderId },
    });

    return new Response(JSON.stringify({ message: 'Notification processed', ...result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Push] send-notification error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
