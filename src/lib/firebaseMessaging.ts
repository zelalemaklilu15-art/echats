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


async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (swRegistration) return swRegistration;
  // Config is passed via query string so the public worker can boot standalone.
  const params = new URLSearchParams(
    Object.entries(firebaseConfig).filter(([, v]) => Boolean(v)) as [string, string][],
  );
  const workerUrl = `/firebase-messaging-sw.js?${params.toString()}`;

  // Fail with a useful message when a published frontend is missing the worker.
  // Without this check, mobile browsers often surface only an opaque Firebase error.
  const workerResponse = await fetch(workerUrl, { cache: 'no-store' });
  if (!workerResponse.ok) {
    throw new Error(`Firebase messaging worker is unavailable (HTTP ${workerResponse.status})`);
  }
  const contentType = workerResponse.headers.get('content-type') ?? '';
  if (!contentType.includes('javascript')) {
    throw new Error(`Firebase messaging worker returned an invalid content type (${contentType || 'unknown'})`);
  }

  const registration = await navigator.serviceWorker.register(
    workerUrl,
    { scope: '/firebase-cloud-messaging-push-scope' },
  );

  const worker = registration.active ?? registration.waiting ?? registration.installing;
  if (!worker) throw new Error('Firebase messaging service worker was registered but no worker was created');
  if (worker.state !== 'activated') {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error(`Firebase messaging service worker activation timed out (state: ${worker.state})`)),
        15000,
      );
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') {
          window.clearTimeout(timeout);
          resolve();
        } else if (worker.state === 'redundant') {
          window.clearTimeout(timeout);
          reject(new Error('Firebase messaging service worker became redundant during activation'));
        }
      });
    });
  }
  swRegistration = registration;
  return registration;
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
  stage?: 'configuration' | 'support' | 'permission' | 'service-worker' | 'get-token' | 'authentication' | 'database';
  error?: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

/**
 * Store the FCM token for the signed-in user.
 * Pass `{ requestPermission: true }` only from a user gesture (button click).
 */
export async function registerDeviceForPush(
  userId: string,
  opts: {
    requestPermission?: boolean;
    onStage?: (stage: NonNullable<PushRegisterResult['stage']>) => void;
  } = {},
): Promise<PushRegisterResult> {
  if (!userId) return { status: 'failed', stage: 'authentication', error: 'Missing user ID' };
  if (!isFirebaseConfigured()) {
    return { status: 'not-configured', stage: 'configuration', error: 'Firebase web configuration is incomplete' };
  }
  if (!(await fcmSupported())) {
    return { status: 'unsupported', stage: 'support', error: 'Firebase messaging is not supported by this browser' };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    if (!opts.requestPermission) return { status: 'permission-default', stage: 'permission' };
    // Browsers silently reject permission prompts in cross-origin iframes.
    if (inIframe()) return { status: 'open-in-new-tab', stage: 'permission', error: 'Notification prompts are blocked inside the preview frame' };
    try {
      permission = await Notification.requestPermission();
    } catch (error) {
      const message = errorMessage(error);
      console.error('[FCM][permission] Notification.requestPermission failed:', error);
      return { status: 'failed', stage: 'permission', error: message };
    }
  }
  if (permission !== 'granted') return { status: 'denied', stage: 'permission', error: `Permission state is ${permission}` };

  let registration: ServiceWorkerRegistration;
  try {
    opts.onStage?.('service-worker');
    registration = await ensureServiceWorker();
  } catch (error) {
    const message = errorMessage(error);
    console.error('[FCM][service-worker] Registration failed:', error);
    return { status: 'failed', stage: 'service-worker', error: message };
  }

  let token: string;
  try {
    opts.onStage?.('get-token');
    token = await getToken(await messaging(), {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) {
      console.error('[FCM][get-token] Firebase returned an empty token');
      return { status: 'failed', stage: 'get-token', error: 'Firebase returned an empty token' };
    }
  } catch (error) {
    const message = errorMessage(error);
    console.error('[FCM][get-token] Firebase getToken() failed:', error);
    return { status: 'failed', stage: 'get-token', error: message };
  }
  currentToken = token;

  // Verify a fresh authenticated session immediately before the protected RPC.
  opts.onStage?.('authentication');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || user.id !== userId) {
    const message = userError?.message ?? 'No matching authenticated session';
    console.error('[FCM][authentication] Cannot save device token:', message);
    return { status: 'failed', stage: 'authentication', error: message, token };
  }

  // Secure upsert: reassigns the token if this device was used by another account.
  opts.onStage?.('database');
  const { error } = await supabase.rpc('register_device_token', {
    p_token: token,
    p_platform: 'web',
    p_user_agent: navigator.userAgent,
  });
  if (error) {
    const message = [error.message, error.details, error.hint, error.code].filter(Boolean).join(' | ');
    console.error('[FCM][database] register_device_token RPC failed:', error);
    return { status: 'failed', stage: 'database', error: message, token };
  }
  console.info('[FCM][database] Device token saved successfully');
  return { status: 'registered', token };
}


/** Remove this device's token (used on logout / disabling notifications). */
export async function unregisterDeviceForPush(): Promise<void> {
  try {
    const token = currentToken;
    if (token) {
      await supabase.rpc('unregister_device_token', { p_token: token });
    } else {
      // After a page reload the in-memory token is gone — delete this user's
      // web tokens directly (RLS scopes this to the signed-in user).
      await supabase
        .from('device_tokens')
        .delete()
        .eq('platform', 'web');
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
