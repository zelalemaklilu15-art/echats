// @ts-nocheck
import { useEffect, useState, useCallback } from 'react';
import { pushNotificationService } from '@/lib/pushNotificationService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { registerDeviceForPush, unregisterDeviceForPush } from '@/lib/firebaseMessaging';

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const showRegistrationError = useCallback((stage?: string, error?: string, status?: string) => {
    const visibleStage = stage || 'unknown';
    const visibleError = error || `Registration returned ${status || 'an unknown status'}`;
    console.error(`[Push][FCM ${visibleStage}] Registration failed: ${visibleError}`);
    toast.error('Notification registration failed', {
      description: `Stage: ${visibleStage} — ${visibleError}`,
      duration: 15000,
    });
  }, []);

  // Check support and current permission on mount
  useEffect(() => {
    setIsSupported(pushNotificationService.isSupported());
    setPermission(pushNotificationService.getPermissionStatus());
  }, []);

  // Request permission and subscribe
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    setIsLoading(true);

    try {
      const newPermission = await pushNotificationService.requestPermission();
      setPermission(newPermission);

      if (newPermission === 'granted') {
        // Require a live session (RLS needs an authenticated user)
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) {
          toast.error('Please log in to enable notifications');
          return false;
        }

        // Register this device with Firebase Cloud Messaging (used by the backend)
        const fcm = await registerDeviceForPush(user.id, { requestPermission: true });
        if (fcm.status === 'registered') {
          setIsSubscribed(true);
          toast.success('Notifications enabled!');
          return true;
        }
        if (fcm.status === 'open-in-new-tab') {
          showRegistrationError(fcm.stage, fcm.error, fcm.status);
          return false;
        }
        if (fcm.status === 'not-configured') {
          showRegistrationError(fcm.stage, fcm.error, fcm.status);
          return false;
        }
        if (fcm.status !== 'registered') {
          showRegistrationError(fcm.stage, fcm.error, fcm.status);
          return false;
        }
      } else if (newPermission === 'denied') {
        toast.error('Notification permission denied. Please enable in browser settings.');
        return false;
      }

      return false;
    } catch (error) {
      console.error('[Push] Error requesting permission:', error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to enable notifications: ${message}`, { duration: 10000 });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, showRegistrationError]);

  // Unsubscribe from push
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await pushNotificationService.unsubscribe(user.id);
        await unregisterDeviceForPush();
      }
      setIsSubscribed(false);
      toast.success('Notifications disabled');
      return true;
    } catch (error) {
      console.error('[Push] Error unsubscribing:', error);
      toast.error('Failed to disable notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check subscription status on mount
  useEffect(() => {
    const checkSubscription = async () => {
      if (permission !== 'granted' || !isSupported) {
        setIsSubscribed(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if we have a subscription in the database
      const { data } = await supabase
        .from('device_tokens')
        .select('id')
        .eq('user_id', user.id)
        .eq('platform', 'web')
        .limit(1);

      setIsSubscribed(data && data.length > 0);
    };

    checkSubscription();
  }, [permission, isSupported]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    requestPermission,
    unsubscribe,
  };
};
