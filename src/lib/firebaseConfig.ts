/**
 * Firebase Web config for push notifications.
 *
 * Values come from Firebase Console → Project settings → Your apps → Web app,
 * and the Web Push certificate key pair (VAPID key) under Cloud Messaging.
 * They are publishable client values, safe to keep in the frontend.
 *
 * Any value can be overridden with a Vite env var (VITE_FIREBASE_*).
 */
const env = import.meta.env as Record<string, string | undefined>;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? '',
};

/** Web Push certificate public key (VAPID) from Firebase Cloud Messaging settings. */
export const firebaseVapidKey =
  env.VITE_FIREBASE_VAPID_KEY ??
  'BB46AEPQzRcJJ1MSEfXPA5o933HTY1qt0b-fVXdMRPtxzPZAYUzj7ghVyfx1BmTDqYwtU_E--1GloLQSXZLkOC0';

export const isFirebaseConfigured = (): boolean =>
  Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId &&
      firebaseConfig.messagingSenderId &&
      firebaseVapidKey,
  );

/** Names of the config values that are still missing (for diagnostics/UI). */
export const missingFirebaseConfigKeys = (): string[] => {
  const missing: string[] = [];
  if (!firebaseConfig.apiKey) missing.push('apiKey');
  if (!firebaseConfig.projectId) missing.push('projectId');
  if (!firebaseConfig.appId) missing.push('appId');
  if (!firebaseConfig.messagingSenderId) missing.push('messagingSenderId');
  if (!firebaseVapidKey) missing.push('vapidKey');
  return missing;
};
