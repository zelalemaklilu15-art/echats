import { useEffect, useState } from 'react';
import { CHANNELS_SYNC_EVENT, syncChannels, syncChannelMessages } from '@/lib/channelService';

/** Re-renders when channel data arrives from the server; returns a changing version number. */
export function useChannelSync(channelId?: string): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion(v => v + 1);
    window.addEventListener(CHANNELS_SYNC_EVENT, bump);
    syncChannels();
    if (channelId) syncChannelMessages(channelId);
    return () => window.removeEventListener(CHANNELS_SYNC_EVENT, bump);
  }, [channelId]);
  return version;
}
