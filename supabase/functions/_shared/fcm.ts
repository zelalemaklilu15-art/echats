// Firebase Cloud Messaging helper for Supabase Edge Functions (Deno).
// Uses the FIREBASE_SERVICE_ACCOUNT secret (raw service-account JSON).
import { initializeApp, getApps, cert } from 'npm:firebase-admin@12/app';
import { getMessaging } from 'npm:firebase-admin@12/messaging';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

let ready = false;

function initFirebase(): boolean {
  if (ready) return true;
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) {
    console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT is not configured');
    return false;
  }
  try {
    const parsed: ServiceAccount = JSON.parse(raw);
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          // Secrets often store the key with escaped newlines.
          privateKey: parsed.private_key.replace(/\\n/g, '\n'),
        }),
      });
    }
    ready = true;
    return true;
  } catch (err) {
    console.error('[FCM] Failed to initialise firebase-admin:', err);
    return false;
  }
}

export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

export async function getDeviceTokens(userId: string): Promise<string[]> {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from('device_tokens')
    .select('token')
    .eq('user_id', userId);
  if (error) {
    console.error('[FCM] Failed to load device tokens:', error);
    return [];
  }
  return (data ?? []).map((r: { token: string }) => r.token).filter(Boolean);
}

async function pruneTokens(tokens: string[]) {
  if (tokens.length === 0) return;
  const supabase = adminClient();
  await supabase.from('device_tokens').delete().in('token', tokens);
}

export interface PushMessage {
  title: string;
  body: string;
  /** Arbitrary string data forwarded to the client (all values must be strings). */
  data?: Record<string, string>;
  /** Notification collapse/replace key, e.g. "incoming-call". */
  tag?: string;
  /** High priority is used for calls so devices wake immediately. */
  highPriority?: boolean;
  /** Deep link opened when the notification is tapped. */
  url?: string;
}

export interface PushResult {
  configured: boolean;
  sent: number;
  failed: number;
  tokens: number;
}

export async function sendPushToUser(userId: string, message: PushMessage): Promise<PushResult> {
  const tokens = await getDeviceTokens(userId);
  if (tokens.length === 0) {
    return { configured: initFirebase(), sent: 0, failed: 0, tokens: 0 };
  }
  return await sendPushToTokens(tokens, message);
}

export async function sendPushToTokens(tokens: string[], message: PushMessage): Promise<PushResult> {
  if (!initFirebase()) {
    return { configured: false, sent: 0, failed: 0, tokens: tokens.length };
  }
  if (tokens.length === 0) {
    return { configured: true, sent: 0, failed: 0, tokens: 0 };
  }

  const data: Record<string, string> = { ...(message.data ?? {}) };
  if (message.url) data.url = message.url;
  if (message.tag) data.tag = message.tag;

  try {
    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: message.title, body: message.body },
      data,
      android: {
        priority: message.highPriority ? 'high' : 'normal',
        notification: {
          tag: message.tag,
          channelId: message.tag === 'incoming-call' ? 'calls' : 'default',
          priority: message.highPriority ? 'max' : 'default',
          sound: 'default',
        },
      },
      apns: {
        headers: {
          'apns-priority': message.highPriority ? '10' : '5',
          ...(message.tag === 'incoming-call' ? { 'apns-push-type': 'alert' } : {}),
        },
        payload: {
          aps: {
            sound: 'default',
            'interruption-level': message.highPriority ? 'time-sensitive' : 'active',
            ...(message.tag ? { 'thread-id': message.tag } : {}),
          },
        },
      },
      webpush: {
        headers: { Urgency: message.highPriority ? 'high' : 'normal' },
        notification: {
          title: message.title,
          body: message.body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: message.tag,
          requireInteraction: message.tag === 'incoming-call',
        },
        fcmOptions: { link: message.url ?? '/' },
      },
    });

    const dead: string[] = [];
    response.responses.forEach((r, i) => {
      if (r.success) return;
      const code = (r.error as { code?: string } | undefined)?.code ?? '';
      if (
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token') ||
        code.includes('invalid-argument')
      ) {
        dead.push(tokens[i]);
      } else {
        console.error('[FCM] Send error:', code, r.error?.message);
      }
    });
    await pruneTokens(dead);

    return {
      configured: true,
      sent: response.successCount,
      failed: response.failureCount,
      tokens: tokens.length,
    };
  } catch (err) {
    console.error('[FCM] sendEachForMulticast failed:', err);
    return { configured: true, sent: 0, failed: tokens.length, tokens: tokens.length };
  }
}
