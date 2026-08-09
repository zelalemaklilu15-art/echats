/**
 * Firebase Web config for push notifications.
 *
 * Fill these in from Firebase Console → Project settings → Your apps → Web app,
 * and the Web Push certificate key pair (VAPID key) under Cloud Messaging.
 * They are publishable client values, safe to keep in the frontend.
 *
 * Values can also be provided as Vite env vars (VITE_FIREBASE_*).
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
export const firebaseVapidKey = env.VITE_FIREBASE_VAPID_KEY ?? '';

export const isFirebaseConfigured = (): boolean =>
  Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId && firebaseVapidKey);
