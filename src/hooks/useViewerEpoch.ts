import { useEffect, useState } from 'react';
import { PROFILE_ACCESS_EVENT } from '@/lib/profileAccess';

/** Remount viewer-owned feature state immediately when identity authorization changes. */
export function useViewerEpoch(): number {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const invalidate = () => setEpoch(value => value + 1);
    window.addEventListener(PROFILE_ACCESS_EVENT, invalidate);
    return () => window.removeEventListener(PROFILE_ACCESS_EVENT, invalidate);
  }, []);
  return epoch;
}