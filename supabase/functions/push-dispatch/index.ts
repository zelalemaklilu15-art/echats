// Internal: called by database triggers (pg_net) whenever app activity is saved.
// Builds the right notification and sends it via FCM. Not callable by clients.
import { sendPushToUser, adminClient, type PushMessage } from '../_shared/fcm.ts';

type Rec = Record<string, any>;
const db = adminClient();
const clip = (s: string, n = 120) => (s || '').slice(0, n);

async function nameOf(id: string): Promise<string> {
  // Deferred until delivery: every recipient has a different authorization.
  return `{{profile:${id}}}`;
}

async function recipientText(text: string, viewer: string): Promise<string> {
  let result = text;
  for (const match of text.matchAll(/\{\{profile:([0-9a-f-]+)\}\}/g)) {
    const { data, error } = await db.rpc('notification_profile_name', { p_viewer: viewer, p_subject: match[1] });
    result = result.replaceAll(match[0], !error && typeof data === 'string' ? data : 'Hidden profile');
  }
  return result;
}

function preview(content: string, type: string): string {
  switch (type) {
    case 'image': return '📷 Photo';
    case 'voice': return '🎤 Voice message';
    case 'video': return '🎥 Video';
    case 'file': return '📎 File';
    case 'location': return '📍 Location';
    default: return clip(content) || 'New message';
  }
}

async function send(ids: string[], actor: string, msg: PushMessage) {
  const targets = [...new Set(ids)].filter((id) => id && id !== actor);
  let sent = 0;
  for (const id of targets) {
    const [title, body] = await Promise.all([recipientText(msg.title, id), recipientText(msg.body, id)]);
    sent += (await sendPushToUser(id, { ...msg, title, body })).sent;
  }
  return sent;
}

async function followersOf(id: string) {
  const { data } = await db.from('etok_follows').select('follower_id').eq('following_id', id).limit(500);
  return (data ?? []).map((r: Rec) => r.follower_id);
}

async function handle(table: string, op: string, r: Rec): Promise<number> {
  switch (table) {
    case 'messages': {
      const n = await nameOf(r.sender_id);
      return send([r.receiver_id], r.sender_id, {
        title: n, body: preview(r.content, r.message_type), tag: `chat-${r.chat_id}`,
        url: `/chat/${r.chat_id}`, data: { type: 'direct_message', chatId: r.chat_id, senderId: r.sender_id },
      });
    }
    case 'group_messages': {
      const [{ data: g }, { data: m }, n] = await Promise.all([
        db.from('groups').select('name').eq('id', r.group_id).maybeSingle(),
        db.from('group_members').select('user_id').eq('group_id', r.group_id),
        nameOf(r.sender_id),
      ]);
      return send((m ?? []).map((x: Rec) => x.user_id), r.sender_id, {
        title: g?.name || 'Group', body: `${n}: ${preview(r.content, r.message_type)}`,
        tag: `group-${r.group_id}`, url: `/group/${r.group_id}`, data: { type: 'group_message', groupId: r.group_id },
      });
    }
    case 'etok_likes': {
      const { data: v } = await db.from('etok_videos').select('author_id').eq('id', r.video_id).maybeSingle();
      if (!v) return 0;
      return send([v.author_id], r.user_id, {
        title: 'eTok', body: `${await nameOf(r.user_id)} liked your video`,
        tag: `etok-like-${r.video_id}`, url: '/etok', data: { type: 'etok_like', videoId: r.video_id },
      });
    }
    case 'etok_comments': {
      const { data: v } = await db.from('etok_videos').select('author_id').eq('id', r.video_id).maybeSingle();
      const n = await nameOf(r.author_id);
      let sent = 0;
      if (r.parent_id) {
        const { data: p } = await db.from('etok_comments').select('author_id').eq('id', r.parent_id).maybeSingle();
        if (p) sent += await send([p.author_id], r.author_id, {
          title: 'eTok', body: `${n} replied: ${clip(r.text, 100)}`, tag: `etok-reply-${r.parent_id}`,
          url: '/etok', data: { type: 'etok_reply', videoId: r.video_id },
        });
      }
      if (v) sent += await send([v.author_id], r.author_id, {
        title: 'eTok', body: `${n} commented: ${clip(r.text, 100)}`, tag: `etok-comment-${r.video_id}`,
        url: '/etok', data: { type: 'etok_comment', videoId: r.video_id },
      });
      return sent;
    }
    case 'etok_follows':
      return send([r.following_id], r.follower_id, {
        title: 'eTok', body: `${await nameOf(r.follower_id)} started following you`,
        tag: 'etok-follow', url: `/etok/profile/${r.follower_id}`, data: { type: 'etok_follow' },
      });
    case 'etok_videos':
      if (r.privacy && r.privacy !== 'public') return 0;
      return send(await followersOf(r.author_id), r.author_id, {
        title: 'eTok', body: `${await nameOf(r.author_id)} posted a new video`,
        tag: `etok-video-${r.author_id}`, url: '/etok', data: { type: 'etok_video', videoId: r.id },
      });
    case 'etok_live_streams':
      return send(await followersOf(r.host_id), r.host_id, {
        title: '🔴 LIVE', body: `${await nameOf(r.host_id)} is live: ${clip(r.title, 80)}`,
        tag: `etok-live-${r.host_id}`, url: '/etok/live', data: { type: 'etok_live', streamId: r.id },
      });
    case 'stars_gifts':
      return send([r.receiver_id], r.sender_id, {
        title: `🎁 Gift from ${await nameOf(r.sender_id)}`, body: r.message ? clip(r.message) : `${r.stars} Stars gift`,
        tag: `gift-${r.id}`, url: `/chat/${r.chat_id}`, data: { type: 'gift', chatId: r.chat_id },
      });
    case 'user_stories': {
      const { data: c } = await db.from('chats').select('participant_1, participant_2')
        .or(`participant_1.eq.${r.user_id},participant_2.eq.${r.user_id}`).limit(500);
      const ids = (c ?? []).map((x: Rec) => (x.participant_1 === r.user_id ? x.participant_2 : x.participant_1));
      return send(ids, r.user_id, {
        title: 'Stories', body: `${await nameOf(r.user_id)} added a story`,
        tag: `story-${r.user_id}`, url: '/stories', data: { type: 'story' },
      });
    }
    case 'channel_posts': {
      const [{ data: ch }, { data: subs }] = await Promise.all([
        db.from('channels').select('name').eq('id', r.channel_id).maybeSingle(),
        db.from('channel_subscribers').select('user_id').eq('channel_id', r.channel_id).limit(2000),
      ]);
      return send((subs ?? []).map((x: Rec) => x.user_id), r.sender_id, {
        title: ch?.name || 'Channel', body: clip(r.content) || 'New post',
        tag: `channel-${r.channel_id}`, url: `/channel/${r.channel_id}`, data: { type: 'channel_post', channelId: r.channel_id },
      });
    }
    case 'payment_requests': {
      const amt = `${Number(r.amount).toLocaleString()} ETB`;
      if (op === 'INSERT') {
        return send([r.payer_id], r.requester_id, {
          title: `💸 Payment request from ${await nameOf(r.requester_id)}`, body: `${amt}${r.note ? ` — ${clip(r.note, 80)}` : ''}`,
          tag: `payreq-${r.id}`, url: '/request-money', data: { type: 'payment_request', requestId: r.id },
        });
      }
      if (r.status === 'paid' || r.status === 'declined') {
        const n = await nameOf(r.payer_id);
        return send([r.requester_id], r.payer_id, {
          title: r.status === 'paid' ? '✅ Request paid' : 'Request declined',
          body: r.status === 'paid' ? `${n} paid your request of ${amt}` : `${n} declined your request of ${amt}`,
          tag: `payreq-${r.id}`, url: r.status === 'paid' ? '/wallet' : '/request-money', data: { type: 'payment_request_' + r.status },
        });
      }
      return 0;
    }
    case 'call_logs':
      if (op !== 'UPDATE' || r.status !== 'missed' || !r.ended_at) return 0;
      return send([r.receiver_id], r.caller_id, {
        title: 'Missed call', body: `${await nameOf(r.caller_id)} · ${r.call_type === 'video' ? 'Video' : 'Voice'} call`,
        tag: `missed-${r.caller_id}`, url: '/calls', data: { type: 'missed_call' },
      });
  }
  return 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const { data: cfg } = await db.from('push_dispatch_config').select('secret').eq('id', 1).maybeSingle();
  if (!cfg?.secret || req.headers.get('x-push-secret') !== cfg.secret) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const { table, op, record } = await req.json();
    if (typeof table !== 'string' || !record) return new Response('Bad request', { status: 400 });
    const sent = await handle(table, op, record);
    console.log(`[push-dispatch] ${table}/${op} sent=${sent}`);
    return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[push-dispatch] error', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
