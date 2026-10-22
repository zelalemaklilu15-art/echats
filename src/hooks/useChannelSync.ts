import { useEffect, useState } from 'react';
import { CHANNELS_SYNC_EVENT, syncChannels, syncChannelMessages } from '@/lib/channelService';
import { PROFILE_ACCESS_EVENT } from '@/lib/profileAccess';

/** Re-renders when channel data arrives from the server; returns a changing version number. */
export function useChannelSync(channelId?: string): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion(v => v + 1);
    const refresh = () => {
      void syncChannels();
      if (channelId) void syncChannelMessages(channelId);
    };
    window.addEventListener(CHANNELS_SYNC_EVENT, bump);
    window.addEventListener(PROFILE_ACCESS_EVENT, refresh);
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 15000);
    refresh();
    return () => {
      window.removeEventListener(CHANNELS_SYNC_EVENT, bump);
      window.removeEventListener(PROFILE_ACCESS_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      window.clearInterval(interval);
    };
  }, [channelId]);
  return version;
}
