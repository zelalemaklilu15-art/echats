import { describe, it, expect, vi, afterEach } from 'vitest';
import { pushNotificationService } from '@/lib/pushNotificationService';

describe('incoming call alert', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not crash the incoming call when the browser rejects alert buttons', () => {
    const calls: NotificationOptions[] = [];
    class StrictNotification {
      static permission = 'granted';
      constructor(_title: string, options?: NotificationOptions & { actions?: unknown }) {
        if (options && 'actions' in options) throw new TypeError('Actions are only supported for persistent notifications');
        calls.push(options ?? {});
      }
    }
    vi.stubGlobal('Notification', StrictNotification);
    vi.spyOn(pushNotificationService, 'getPermissionStatus').mockReturnValue('granted');

    expect(() => pushNotificationService.showIncomingCallNotification('Someone', 'voice')).not.toThrow();
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toBe('Someone is calling you');
    vi.unstubAllGlobals();
  });
});
