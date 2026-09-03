// @ts-nocheck
// App-wide push notifications: registers the device with Firebase Cloud Messaging
// and surfaces foreground pushes (messages, calls, wallet activity) as toasts.
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  registerDeviceForPush,
  listenForegroundMessages,
  fcmSupported,
} from '@/lib/firebaseMessaging';

export function useAppPushNotifications(userId: string | null) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      if (!(await fcmSupported())) return;
      // Never prompt automatically — permission is requested from a button
      // in Notification settings. Here we only refresh an already-granted token.
      const result = await registerDeviceForPush(userId);
      if (result.status !== 'registered' && result.status !== 'permission-default') {
        console.error('[FCM] Background token registration failed:', {
          status: result.status,
          stage: result.stage,
          error: result.error,
        });
      }
      if (cancelled) return;


      unsubscribe = await listenForegroundMessages(({ title, body, data }) => {
        // Incoming calls already have their own full-screen UI.
        if (data?.type === 'incoming_call') return;
        toast(title, {
          description: body,
          action: data?.url
            ? { label: 'Open', onClick: () => navigate(data.url as string) }
            : undefined,
        });
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [userId, navigate]);
}
