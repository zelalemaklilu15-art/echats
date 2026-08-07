// @ts-nocheck
import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { CallType } from './useWebRTC';

export interface CallOffer {
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: CallType;
  offer: RTCSessionDescriptionInit;
  roomId: string;
}

export interface CallAnswer {
  answer: RTCSessionDescriptionInit;
  roomId: string;
}

export interface IceCandidate {
  candidate: RTCIceCandidateInit;
  senderId: string;
  roomId: string;
}

export interface CallStateEvent {
  type: 'rejected' | 'ended' | 'busy' | 'timeout';
  roomId: string;
  senderId: string;
}

interface SignalingCallbacks {
  onIncomingCall?: (offer: CallOffer) => void;
  onCallAnswer?: (answer: CallAnswer) => void;
  onIceCandidate?: (candidate: IceCandidate) => void;
  onCallStateChange?: (event: CallStateEvent) => void;
}

const SUBSCRIBE_TIMEOUT_MS = 8000;

export const useCallSignaling = (userId: string | null) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedUserRef = useRef<string | null>(null);
  const callbacksRef = useRef<SignalingCallbacks>({});
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Persistent outgoing channels per peer: peerId -> { channel, ready }
  const peerChannelsRef = useRef<
    Map<string, { channel: RealtimeChannel; ready: Promise<boolean> }>
  >(new Map());

  const generateRoomId = useCallback((user1: string, user2: string): string => {
    const sorted = [user1, user2].sort();
    return `call_${sorted[0]}_${sorted[1]}_${Date.now()}`;
  }, []);

  // ---- Inbound (listening) channel -------------------------------------
  const createChannel = useCallback((uid: string) => {
    const channel = supabase.channel(`calls:${uid}`, {
      config: { broadcast: { self: false, ack: true } },
    });

    channel
      .on('broadcast', { event: 'call_offer' }, ({ payload }) => {
        console.log('[Signaling] Received call offer');
        callbacksRef.current.onIncomingCall?.(payload as CallOffer);
      })
      .on('broadcast', { event: 'call_answer' }, ({ payload }) => {
        console.log('[Signaling] Received call answer');
        callbacksRef.current.onCallAnswer?.(payload as CallAnswer);
      })
      .on('broadcast', { event: 'ice_candidate' }, ({ payload }) => {
        callbacksRef.current.onIceCandidate?.(payload as IceCandidate);
      })
      .on('broadcast', { event: 'call_state' }, ({ payload }) => {
        console.log('[Signaling] Received call state:', (payload as CallStateEvent)?.type);
        callbacksRef.current.onCallStateChange?.(payload as CallStateEvent);
      })
      .subscribe((status) => {
        console.log('[Signaling] Inbound channel status:', status);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            if (subscribedUserRef.current !== uid) return;
            console.log('[Signaling] Reconnecting inbound channel...');
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
            channelRef.current = createChannel(uid);
          }, 2000);
        }
      });

    return channel;
  }, []);

  // Keeps the inbound channel alive across re-renders/state changes.
  const subscribeToSignaling = useCallback(
    (callbacks: SignalingCallbacks) => {
      callbacksRef.current = callbacks;
      if (!userId) return;
      if (channelRef.current && subscribedUserRef.current === userId) return;

      if (channelRef.current) supabase.removeChannel(channelRef.current);
      subscribedUserRef.current = userId;
      channelRef.current = createChannel(userId);
    },
    [userId, createChannel],
  );

  // ---- Outbound channels ------------------------------------------------
  const getPeerChannel = useCallback((peerId: string) => {
    const existing = peerChannelsRef.current.get(peerId);
    if (existing) return existing;

    const channel = supabase.channel(`calls:${peerId}`, {
      config: { broadcast: { self: false, ack: true } },
    });

    const ready = new Promise<boolean>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      }, SUBSCRIBE_TIMEOUT_MS);

      channel.subscribe((status) => {
        if (settled) return;
        if (status === 'SUBSCRIBED') {
          settled = true;
          clearTimeout(timer);
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          settled = true;
          clearTimeout(timer);
          resolve(false);
        }
      });
    });

    const entry = { channel, ready };
    peerChannelsRef.current.set(peerId, entry);
    return entry;
  }, []);

  const dropPeerChannel = useCallback((peerId: string) => {
    const entry = peerChannelsRef.current.get(peerId);
    if (entry) {
      supabase.removeChannel(entry.channel);
      peerChannelsRef.current.delete(peerId);
    }
  }, []);

  // Send with one retry on a fresh channel.
  const sendToPeer = useCallback(
    async (peerId: string, event: string, payload: unknown): Promise<boolean> => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const entry = getPeerChannel(peerId);
        const ok = await entry.ready;
        if (ok) {
          try {
            const res = await entry.channel.send({ type: 'broadcast', event, payload });
            if (res === 'ok' || res === undefined) return true;
          } catch (e) {
            console.warn('[Signaling] send failed:', e);
          }
        }
        dropPeerChannel(peerId);
      }
      console.error('[Signaling] Failed to deliver', event, 'to', peerId);
      return false;
    },
    [getPeerChannel, dropPeerChannel],
  );

  const sendOffer = useCallback(
    async (
      receiverId: string,
      offer: RTCSessionDescriptionInit,
      callType: CallType,
      callerName: string,
      callerAvatar?: string,
      roomId?: string,
    ): Promise<string> => {
      if (!userId) throw new Error('User not authenticated');
      const finalRoomId = roomId || generateRoomId(userId, receiverId);

      const delivered = await sendToPeer(receiverId, 'call_offer', {
        callerId: userId,
        callerName,
        callerAvatar,
        callType,
        offer,
        roomId: finalRoomId,
      } as CallOffer);

      if (!delivered) throw new Error('Could not reach the other user. Check your connection.');
      return finalRoomId;
    },
    [userId, generateRoomId, sendToPeer],
  );

  const sendAnswer = useCallback(
    async (callerId: string, answer: RTCSessionDescriptionInit, roomId: string) => {
      if (!userId) throw new Error('User not authenticated');
      const ok = await sendToPeer(callerId, 'call_answer', { answer, roomId } as CallAnswer);
      if (!ok) throw new Error('Could not answer the call. Check your connection.');
    },
    [userId, sendToPeer],
  );

  const sendIceCandidate = useCallback(
    async (targetId: string, candidate: RTCIceCandidateInit, roomId: string) => {
      if (!userId) return;
      await sendToPeer(targetId, 'ice_candidate', {
        candidate,
        senderId: userId,
        roomId,
      } as IceCandidate);
    },
    [userId, sendToPeer],
  );

  const sendCallState = useCallback(
    async (targetId: string, type: CallStateEvent['type'], roomId: string) => {
      if (!userId) return;
      await sendToPeer(targetId, 'call_state', { type, roomId, senderId: userId } as CallStateEvent);
    },
    [userId, sendToPeer],
  );

  // Close outbound channel for a peer once the call is over.
  const releasePeer = useCallback(
    (peerId?: string | null) => {
      if (peerId) dropPeerChannel(peerId);
    },
    [dropPeerChannel],
  );

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    subscribedUserRef.current = null;
    peerChannelsRef.current.forEach(({ channel }) => supabase.removeChannel(channel));
    peerChannelsRef.current.clear();
    callbacksRef.current = {};
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    subscribeToSignaling,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    sendCallState,
    releasePeer,
    cleanup,
  };
};
