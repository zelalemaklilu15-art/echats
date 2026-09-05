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

  // Check support and current permission on mount
  useEffect(() => {
    setIsSupported(pushNotificationService.isSupported());
    setPermission(pushNotificationService.getPermissionStatus());
  }, []);

  // Request permission and subscribe
  const requestPermission = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!isSupported) throw new Error('This browser does not support push notifications');

      alert('Step 1: Getting permission');
      const newPermission = await pushNotificationService.requestPermission();
      setPermission(newPermission);
      if (newPermission !== 'granted') throw new Error(`Notification permission is ${newPermission}`);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw new Error(`authentication: ${sessionError.message}`);
      const user = session?.user;
      if (!user) throw new Error('authentication: No signed-in session');

      const fcm = await registerDeviceForPush(user.id, {
        requestPermission: false,
        onStage: (stage) => {
          if (stage === 'get-token') alert('Step 2: Fetching FCM token from Firebase');
          if (stage === 'database') alert('Step 3: Upserting to Supabase');
        },
      });
      if (fcm.status !== 'registered') {
        throw new Error(`${fcm.stage ?? fcm.status}: ${fcm.error ?? 'Registration failed without an error message'}`);
      }

      setIsSubscribed(true);
      alert('SUCCESS: Notifications enabled');
      toast.success('Notifications enabled!');
      return true;
    } catch (error) {
      console.error('[Push] Error requesting permission:', error);
      const message = error instanceof Error ? error.message : String(error);
      alert(`FAIL: ${message}`);
      toast.error('FAIL', { description: message, duration: 20000 });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

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
