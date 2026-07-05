// @ts-nocheck
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useCallManager, CallState, ActiveCall } from '@/hooks/useCallManager';
import { CallType } from '@/hooks/useWebRTC';
import { useAuth } from '@/contexts/AuthContext';
import { getPublicProfile } from '@/lib/supabaseService';

interface CallContextType {
  // State
  callState: CallState;
  activeCall: ActiveCall | null;
  callDuration: number;
  isMuted: boolean;
  isCameraOff: boolean;
  errorMessage: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState | null;
  isReady: boolean;

  // Actions
  startCall: (peerId: string, peerName: string, callType: CallType, peerAvatar?: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  resetCall: () => void;
}

export const CallContext = createContext<CallContextType | null>(null);

export const useCall = (): CallContextType => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

interface CallProviderProps {
  children: ReactNode;
}

export const CallProvider: React.FC<CallProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('User');
  const [userAvatar, setUserAvatar] = useState<string | undefined>();
  const [isReady, setIsReady] = useState(false);

  // Load current user from the single AuthProvider source (no extra auth subscriptions)
  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!user?.id) {
        setUserId(null);
        setUserName('User');
        setUserAvatar(undefined);
        setIsReady(false);
        return;
      }

      setUserId(user.id);

      try {
        const profile = await getPublicProfile(user.id);

        if (cancelled) return;

        if (profile) {
          setUserName(profile.name || 'User');
          setUserAvatar(profile.avatar_url || undefined);
        }
      } catch (e) {
        if (!cancelled) console.warn('[CallProvider] Failed to load profile:', e);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const callManager = useCallManager({
    userId,
    userName,
    userAvatar,
  });

  const value: CallContextType = {
    ...callManager,
    isReady,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};
