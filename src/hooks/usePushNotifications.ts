import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  fcmSupported,
  registerDeviceForPush,
  unregisterDeviceForPush,
  type PushRegisterResult,
} from '@/lib/firebaseMessaging';

type RegistrationStage = NonNullable<PushRegisterResult['stage']>;

const SUBSCRIPTION_CHANGED_EVENT = 'echat:push-subscription-changed';

function getRawError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationStage, setRegistrationStage] = useState<RegistrationStage | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // Check support and current permission on mount
  useEffect(() => {
    let active = true;
    void fcmSupported().then((supported) => {
      if (!active) return;
      setIsSupported(supported);
      setPermission('Notification' in window ? Notification.permission : 'denied');
    });
    return () => { active = false; };
  }, []);

  // Request permission and subscribe
  const requestPermission = useCallback(async () => {
    setIsLoading(true);
    setRegistrationError(null);
    try {
      if (!isSupported) throw new Error('This browser does not support push notifications');

      alert('Step 1: Getting permission');
      setRegistrationStage('permission');
      const newPermission = await Notification.requestPermission();
      setPermission(newPermission);
      if (newPermission !== 'granted') throw new Error(`Notification permission is ${newPermission}`);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw new Error(`authentication: ${sessionError.message}`);
      const user = session?.user;
      if (!user) throw new Error('authentication: No signed-in session');

      const fcm = await registerDeviceForPush(user.id, {
        requestPermission: false,
        onStage: (stage) => {
          setRegistrationStage(stage);
          if (stage === 'get-token') alert('Step 2: Fetching FCM token from Firebase');
          if (stage === 'database') alert('Step 3: Upserting to Supabase');
        },
      });
      if (fcm.status !== 'registered') {
        throw new Error(`${fcm.stage ?? fcm.status}: ${fcm.error ?? 'Registration failed without an error message'}`);
      }

      setIsSubscribed(true);
      setRegistrationStage(null);
      window.dispatchEvent(new CustomEvent(SUBSCRIPTION_CHANGED_EVENT, { detail: true }));
      alert('SUCCESS: Notifications enabled');
      toast.success('Notifications enabled!');
      return true;
    } catch (error) {
      console.error('[Push] Error requesting permission:', error);
      const message = getRawError(error);
      setRegistrationError(message);
      setIsSubscribed(false);
      alert(`FAIL: ${message}`);
      toast.error('Notification registration failed', {
        description: `Stage: ${registrationStage ?? 'initialization'} — Error: ${message}`,
        duration: 20000,
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, registrationStage]);

  // Unsubscribe from push
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await unregisterDeviceForPush();
      }
      setIsSubscribed(false);
      setRegistrationError(null);
      window.dispatchEvent(new CustomEvent(SUBSCRIPTION_CHANGED_EVENT, { detail: false }));
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
      const { data, error } = await supabase
        .from('device_tokens')
        .select('id')
        .eq('user_id', user.id)
        .eq('platform', 'web')
        .limit(1);

      if (error) {
        console.error('[Push][database] Failed to check device token:', error);
        return;
      }
      setIsSubscribed(Boolean(data?.length));
    };

    const handleSubscriptionChange = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      setIsSubscribed(Boolean(detail));
    };
    window.addEventListener(SUBSCRIPTION_CHANGED_EVENT, handleSubscriptionChange);
    void checkSubscription();
    return () => window.removeEventListener(SUBSCRIPTION_CHANGED_EVENT, handleSubscriptionChange);
  }, [permission, isSupported]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    registrationStage,
    registrationError,
    requestPermission,
    unsubscribe,
  };
};
