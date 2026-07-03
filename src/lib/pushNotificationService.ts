// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private vapidPublicKey: string | null = null;

  // Check if push notifications are supported
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  // Request notification permission
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      console.warn('[Push] Push notifications not supported');
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  // Get current permission status
  getPermissionStatus(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  // Register service worker and get push subscription
  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) return null;

    try {
      this.registration = await navigator.serviceWorker.register('/push-sw.js', {
        scope: '/',
      });
      console.log('[Push] Service Worker registered');
      return this.registration;
    } catch (error) {
      console.error('[Push] Service Worker registration failed:', error);
      return null;
    }
  }

  // Subscribe to push notifications
  async subscribeToPush(userId: string): Promise<boolean> {
    if (!this.registration) {
      await this.registerServiceWorker();
    }

    if (!this.registration) {
      console.error('[Push] No service worker registration');
      return false;
    }

    try {
      // Check if already subscribed
      let subscription = await (this.registration as any).pushManager.getSubscription();

      if (!subscription) {
        // Get VAPID key from environment or generate
        const vapidKey = this.getVapidPublicKey();
        if (!vapidKey) {
          console.warn('[Push] No VAPID public key configured');
          return false;
        }

        // Subscribe to push
        const applicationServerKey = this.urlBase64ToUint8Array(vapidKey);
        subscription = await (this.registration as any).pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
      }

      // Save subscription to database
      const pushSub = subscription.toJSON();
      const keys = pushSub.keys as { p256dh?: string; auth?: string } | undefined;
      
      if (!pushSub.endpoint || !keys?.p256dh || !keys?.auth) {
        console.error('[Push] Invalid subscription data');
        return false;
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          endpoint: pushSub.endpoint,
          p256dh_key: keys.p256dh,
          auth_key: keys.auth,
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,endpoint',
        });

      if (error) {
        console.error('[Push] Failed to save subscription:', error);
        return false;
      }

      console.log('[Push] Subscription saved successfully');
      return true;
    } catch (error) {
      console.error('[Push] Failed to subscribe:', error);
      return false;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribe(userId: string): Promise<boolean> {
    if (!this.registration) return true;

    try {
      const subscription = await (this.registration as any).pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        
        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', subscription.endpoint);
      }
      return true;
    } catch (error) {
      console.error('[Push] Failed to unsubscribe:', error);
      return false;
    }
  }

  // Show local notification (for when app is in foreground)
  showLocalNotification(title: string, options?: NotificationOptions): void {
    if (this.getPermissionStatus() !== 'granted') return;
    
    if (this.registration) {
      this.registration.showNotification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        requireInteraction: true,
        ...options,
      });
    } else {
      new Notification(title, options);
    }
  }

  // Show incoming call notification
  showIncomingCallNotification(callerName: string, callType: 'voice' | 'video'): void {
    const callTypeText = callType === 'video' ? 'Video' : 'Voice';
    
    this.showLocalNotification(`Incoming ${callTypeText} Call`, {
      body: `${callerName} is calling you`,
      tag: 'incoming-call',
      renotify: true,
      requireInteraction: true,
      actions: [
        { action: 'accept', title: 'Accept' },
        { action: 'reject', title: 'Reject' },
      ],
    } as NotificationOptions);
  }

  // Close call notification
  closeCallNotification(): void {
    if (this.registration) {
      this.registration.getNotifications({ tag: 'incoming-call' }).then(notifications => {
        notifications.forEach(n => n.close());
      });
    }
  }

  // Convert VAPID key to Uint8Array
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Get VAPID public key (should be set via environment)
  private getVapidPublicKey(): string | null {
    // For now, return null - VAPID key needs to be configured
    // In production, this would come from environment variable
    return this.vapidPublicKey;
  }

  // Set VAPID public key (called from settings or initialization)
  setVapidPublicKey(key: string): void {
    this.vapidPublicKey = key;
  }
}

export const pushNotificationService = new PushNotificationService();
