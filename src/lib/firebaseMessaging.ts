// @ts-nocheck
// Firebase Cloud Messaging (web) integration for Echat.
// Registers the device token so Edge Functions can push calls, messages,
// wallet activity and other app events to this device.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, deleteToken } from 'firebase/messaging';
import { supabase } from '@/integrations/supabase/client';
import { firebaseConfig, firebaseVapidKey, isFirebaseConfigured } from '@/lib/firebaseConfig';

let messagingInstance: ReturnType<typeof getMessaging> | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;
let currentToken: string | null = null;

function app() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/** True when the app runs inside an iframe (preview) where prompts are blocked. */
export function inIframe(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

export async function fcmSupported(): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}


async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistration) return swRegistration;
  try {
    // Config is passed via query string so the worker can boot standalone.
    const params = new URLSearchParams(
      Object.entries(firebaseConfig).filter(([, v]) => Boolean(v)) as [string, string][],
    );
    swRegistration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${params.toString()}`,
      { scope: '/firebase-cloud-messaging-push-scope' },
    );
    await navigator.serviceWorker.ready;
    return swRegistration;
  } catch (err) {
    console.warn('[FCM] Service worker registration failed:', err);
    return null;
  }
}

async function messaging() {
  if (messagingInstance) return messagingInstance;
  messagingInstance = getMessaging(app());
  return messagingInstance;
}

export type PushRegisterStatus =
  | 'registered'
  | 'not-configured'
  | 'unsupported'
  | 'open-in-new-tab'
  | 'permission-default'
  | 'denied'
  | 'failed';

export interface PushRegisterResult {
  status: PushRegisterStatus;
  token?: string;
}

/**
 * Store the FCM token for the signed-in user.
 * Pass `{ requestPermission: true }` only from a user gesture (button click).
 */
export async function registerDeviceForPush(
  userId: string,
  opts: { requestPermission?: boolean } = {},
): Promise<PushRegisterResult> {
  if (!userId) return { status: 'failed' };
  if (!isFirebaseConfigured()) return { status: 'not-configured' };
  if (!(await fcmSupported())) return { status: 'unsupported' };

  let permission = Notification.permission;
  if (permission === 'default') {
    if (!opts.requestPermission) return { status: 'permission-default' };
    // Browsers silently reject permission prompts in cross-origin iframes.
    if (inIframe()) return { status: 'open-in-new-tab' };
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return { status: 'denied' };

  const registration = await ensureServiceWorker();
  if (!registration) return { status: 'failed' };

  try {
    const token = await getToken(await messaging(), {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return { status: 'failed' };
    currentToken = token;

    const { error } = await supabase.from('device_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: 'web',
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );
    if (error) {
      console.warn('[FCM] Failed to save device token:', error.message);
      return { status: 'failed', token };
    }
    return { status: 'registered', token };
  } catch (err) {
    console.warn('[FCM] getToken failed:', err);
    return { status: 'failed' };
  }
}


/** Remove this device's token (used on logout / disabling notifications). */
export async function unregisterDeviceForPush(): Promise<void> {
  try {
    const token = currentToken;
    if (token) {
      await supabase.from('device_tokens').delete().eq('token', token);
    }
    if (messagingInstance) await deleteToken(messagingInstance).catch(() => {});
    currentToken = null;
  } catch (err) {
    console.warn('[FCM] Failed to unregister device:', err);
  }
}

/** Foreground messages: FCM does not show a notification automatically. */
export async function listenForegroundMessages(
  handler: (payload: { title: string; body: string; data: Record<string, string> }) => void,
): Promise<() => void> {
  if (!(await fcmSupported())) return () => {};
  try {
    const unsub = onMessage(await messaging(), (payload) => {
      handler({
        title: payload.notification?.title ?? 'Echat',
        body: payload.notification?.body ?? '',
        data: (payload.data ?? {}) as Record<string, string>,
      });
    });
    return unsub;
  } catch {
    return () => {};
  }
}
