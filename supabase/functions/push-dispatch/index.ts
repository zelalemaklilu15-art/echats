// Internal: called by database triggers (pg_net) whenever app activity is saved.
// Builds the right notification and sends it via FCM. Not callable by clients.
import { sendPushToUser, adminClient, type PushMessage } from '../_shared/fcm.ts';

type Rec = Record<string, any>;
const db = adminClient();
const clip = (s: string, n = 120) => (s || '').slice(0, n);
const preview = (content: unknown, kind: string) => kind === 'text' || !kind
  ? clip(typeof content === 'string' ? content : '') || 'New message'
  : ({ image: 'Photo', video: 'Video', audio: 'Voice message', file: 'File', gift: 'Gift' } as Record<string, string>)[kind] ?? 'New message';

async function nameOf(id: string): Promise<string> {
  // Deferred until delivery: every recipient has a different authorization.
  return `{{profile:${id}}}`;
}

async function recipientText(text: string, viewer: string): Promise<{ text: string; hidden: boolean }> {
  let result = text;
  let hidden = false;
  for (const match of text.matchAll(/\{\{profile:([0-9a-f-]+)\}\}/g)) {
    const { data, error } = await db.rpc('notification_profile_name', { p_viewer: viewer, p_subject: match[1] });
    const name = !error && typeof data === 'string' ? data : 'Hidden profile';
    if (name === 'Hidden profile') hidden = true;
    result = result.replaceAll(match[0], name);
  }
  return { text: result, hidden };
}

// Generic lock-screen text when the sender's notification privacy hides them.
const GENERIC: Record<string, [string | null, string]> = {
  direct_message: ['Echat', 'New message'],
  group_message: [null, 'New group message'],
  gift: ['Echat', 'New gift'],
  payment_request: ['Echat', 'Payment request'],
  payment_request_paid: ['Echat', 'Payment request update'],
  payment_request_declined: ['Echat', 'Payment request update'],
  wallet_transfer: ['Echat', 'Money received'],
  missed_call: ['Echat', 'Missed call'],
  story: ['Echat', 'New story'],
  etok_like: ['eTok', 'New activity'],
  etok_comment: ['eTok', 'New comment'],
  etok_reply: ['eTok', 'New reply'],
  etok_follow: ['eTok', 'New follower'],
  etok_video: ['eTok', 'New video'],
  etok_live: ['eTok', 'Someone is live'],
};

// Recipient-owned switches from Notification settings (server-side copy).
const PREF_FOR: Record<string, 'messages' | 'groups' | 'calls'> = {
  direct_message: 'messages', gift: 'messages', group_message: 'groups', missed_call: 'calls',
};
const PREVIEW_TYPES = new Set(['direct_message', 'group_message', 'gift']);

async function send(ids: string[], actor: string, msg: PushMessage) {
  const targets = [...new Set(ids)].filter((id) => id && id !== actor);
  if (!targets.length) return 0;
  const type = (msg.data as Rec)?.type as string;
  const { data: prefRows } = await db.from('notification_preferences')
    .select('user_id, messages, groups, calls, message_preview').in('user_id', targets);
  const prefs = new Map((prefRows ?? []).map((p: Rec) => [p.user_id, p]));
  let sent = 0;
  for (const id of targets) {
    const p = prefs.get(id);
    const key = PREF_FOR[type];
    if (p && key && p[key] === false) continue;
    const [t, b] = await Promise.all([recipientText(msg.title, id), recipientText(msg.body, id)]);
    let title = t.text, body = b.text;
    if (t.hidden || b.hidden) {
      const g = GENERIC[type] ?? ['Echat', 'New notification'];
      title = g[0] ?? t.text;
      body = g[1];
    } else if (p && p.message_preview === false && PREVIEW_TYPES.has(type)) {
      body = GENERIC[type]?.[1] ?? 'New message';
    }
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
    case 'wallet_transactions': {
      const { data: wallet } = await db.from('wallets').select('user_id').eq('id', r.wallet_id).maybeSingle();
      if (!wallet?.user_id) return 0;
      if (r.type === 'transfer_in' && r.status === 'completed') {
        const actor = r.metadata?.sender_user_id;
        if (!actor) return 0;
        return send([wallet.user_id], actor, {
          title: 'Money received', body: `${await nameOf(actor)} sent you ${Number(r.amount).toFixed(2)} ETB`,
          tag: `wallet-${r.id}`, url: '/wallet', data: { type: 'wallet_transfer', transactionId: r.id },
        });
      }
      if (r.type === 'deposit' && (op === 'INSERT' || r.status === 'completed')) {
        return (await sendPushToUser(wallet.user_id, {
          title: r.status === 'completed' ? 'Deposit confirmed' : 'Deposit request created',
          body: `${Number(r.amount).toFixed(2)} ETB — ${r.status === 'completed' ? 'confirmed' : 'awaiting payment confirmation'}`,
          tag: `wallet-${r.id}`, url: '/wallet', data: { type: 'wallet_deposit', transactionId: r.id, status: r.status },
        })).sent;
      }
      return 0;
    }
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
      // Only videos visible to everyone notify followers ('everyone' is the stored value).
      if (r.privacy && r.privacy !== 'everyone' && r.privacy !== 'public') return 0;
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
      const partners = [...new Set((c ?? []).map((x: Rec) => (x.participant_1 === r.user_id ? x.participant_2 : x.participant_1)))];
      // Only people inside the Story's audience may learn it exists.
      const ids: string[] = [];
      for (const id of partners) {
        const { data: ok } = await db.rpc('story_notification_allowed', { p_story: r.id, p_viewer: id });
        if (ok === true) ids.push(id);
      }
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
