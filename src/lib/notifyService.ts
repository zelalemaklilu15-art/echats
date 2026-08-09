// @ts-nocheck
// Thin client for the app-wide push notification Edge Function.
import { supabase } from '@/integrations/supabase/client';

type NotifyKind = 'direct_message' | 'group_message' | 'gift' | 'story' | 'payment_request';

interface NotifyOptions {
  kind: NotifyKind;
  receiverId?: string;
  groupId?: string;
  preview?: string;
  url?: string;
}

/** Fire-and-forget push notification; never throws so it can't break the UI flow. */
export function notifyPush(options: NotifyOptions): void {
  try {
    supabase.functions.invoke('send-notification', { body: options }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export function previewForMessage(content: string, messageType: string): string {
  switch (messageType) {
    case 'image':
      return '📷 Photo';
    case 'voice':
      return '🎤 Voice message';
    case 'video':
      return '🎥 Video';
    case 'file':
      return '📎 File';
    default:
      return (content || '').slice(0, 120) || 'New message';
  }
}
