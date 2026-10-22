import { useEffect, useState } from 'react';
import { CHANNELS_SYNC_EVENT, syncChannels, syncChannelMessages } from '@/lib/channelService';
import { PROFILE_ACCESS_EVENT } from '@/lib/profileAccess';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/** Re-renders when channel data arrives from the server; returns a changing version number. */
export function useChannelSync(channelId?: string): number {
  const { userId } = useAuth();
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let refreshing = false;
    const bump = () => setVersion(v => v + 1);
    const refresh = () => {
      if (refreshing) return;
      refreshing = true;
      void (async () => {
        try {
          await syncChannels();
          if (active && channelId) await syncChannelMessages(channelId);
          if (active) bump();
        } catch { if (active) toast.error('Could not load channels. Please retry.'); }
        finally { refreshing = false; }
      })();
    };
    window.addEventListener(CHANNELS_SYNC_EVENT, bump);
    window.addEventListener(PROFILE_ACCESS_EVENT, refresh);
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 15000);
    refresh();
    return () => {
      active = false;
      window.removeEventListener(CHANNELS_SYNC_EVENT, bump);
      window.removeEventListener(PROFILE_ACCESS_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      window.clearInterval(interval);
    };
  }, [channelId, userId]);
  return version;
}
