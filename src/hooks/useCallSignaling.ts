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
  onOfferAck?: (roomId: string) => void;
}

const SUBSCRIBE_TIMEOUT_MS = 6000;
const SEND_TIMEOUT_MS = 4000;

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(fallback);
      }
    }, ms);
    p.then((v) => {
      if (!done) {
        done = true;
        clearTimeout(t);
        resolve(v);
      }
    }).catch(() => {
      if (!done) {
        done = true;
        clearTimeout(t);
        resolve(fallback);
      }
    });
  });
}


export const useCallSignaling = (userId: string | null) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedUserRef = useRef<string | null>(null);
  const callbacksRef = useRef<SignalingCallbacks>({});
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);
  const activeUserRef = useRef(userId);
  const cancelledRoomsRef = useRef(new Set<string>());
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
    const generation = generationRef.current;
    const isCurrent = () => generation === generationRef.current && activeUserRef.current === uid && subscribedUserRef.current === uid;
    const channel = supabase.channel(`calls:${uid}`, {
      config: { broadcast: { self: false, ack: true } },
    });

    channel
      .on('broadcast', { event: 'call_offer' }, ({ payload }) => {
        if (!isCurrent()) return;
        console.log('[Signaling] Received call offer');
        callbacksRef.current.onIncomingCall?.(payload as CallOffer);
      })
      .on('broadcast', { event: 'call_answer' }, ({ payload }) => {
        if (!isCurrent()) return;
        console.log('[Signaling] Received call answer');
        callbacksRef.current.onCallAnswer?.(payload as CallAnswer);
      })
      .on('broadcast', { event: 'ice_candidate' }, ({ payload }) => {
        if (!isCurrent()) return;
        callbacksRef.current.onIceCandidate?.(payload as IceCandidate);
      })
      .on('broadcast', { event: 'call_offer_ack' }, ({ payload }) => {
        if (!isCurrent()) return;
        console.log('[Signaling] Offer acknowledged');
        callbacksRef.current.onOfferAck?.((payload as { roomId: string })?.roomId);
      })
      .on('broadcast', { event: 'call_state' }, ({ payload }) => {
        if (!isCurrent()) return;
        console.log('[Signaling] Received call state:', (payload as CallStateEvent)?.type);
        callbacksRef.current.onCallStateChange?.(payload as CallStateEvent);
      })
      .subscribe((status) => {
        if (!isCurrent()) return;
        console.log('[Signaling] Inbound channel status:', status);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            if (!isCurrent()) return;
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

  // Await full removal before the same topic is re-created: realtime-js returns
  // the existing (still leaving) instance for a topic, which breaks the retry.
  const dropPeerChannel = useCallback(async (peerId: string) => {
    const entry = peerChannelsRef.current.get(peerId);
    if (entry) {
      peerChannelsRef.current.delete(peerId);
      await withTimeout(Promise.resolve(supabase.removeChannel(entry.channel)) as Promise<unknown>, 3000, 'timed_out');
    }
  }, []);

  // Send with one retry on a fresh channel. Every await is time-boxed so a
  // stalled socket can never leave the UI hanging on "Calling...".
  const sendToPeer = useCallback(
    async (peerId: string, event: string, payload: unknown): Promise<boolean> => {
      const generation = generationRef.current;
      const roomId = (payload as { roomId?: string })?.roomId;
      const isCurrent = () => generation === generationRef.current && activeUserRef.current === userId && Boolean(userId)
        && (event === 'call_state' || !roomId || !cancelledRoomsRef.current.has(roomId));
      if (!isCurrent()) return false;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!isCurrent()) return false;
        const entry = getPeerChannel(peerId);
        const ok = await entry.ready;
        if (!isCurrent()) return false;
        if (ok) {
          const res = await withTimeout(
            Promise.resolve(entry.channel.send({ type: 'broadcast', event, payload })) as Promise<unknown>,
            SEND_TIMEOUT_MS,
            'timed_out',
          );
          if (!isCurrent()) return false;
          if (res === 'ok' || res === undefined) return true;
          console.warn('[Signaling] send result:', res);
        }
        if (peerChannelsRef.current.get(peerId) === entry) await dropPeerChannel(peerId);
      }
      console.error('[Signaling] Failed to deliver', event, 'to', peerId);
      return false;
    },
    [getPeerChannel, dropPeerChannel, userId],
  );

  const sendOfferAck = useCallback(
    async (callerId: string, roomId: string) => {
      await sendToPeer(callerId, 'call_offer_ack', { roomId });
    },
    [sendToPeer],
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
        // Identity is resolved for the receiver, never trusted from a broadcast.
        callerName: 'Hidden profile',
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

  // Outbound peer channels stay open between calls. Closing and immediately
  // re-opening the same topic raced the leave and broke the next call; a
  // channel is only replaced when a send actually fails (see sendToPeer).
  const releasePeer = useCallback((_peerId?: string | null) => {}, []);

  const cancelCall = useCallback((roomId: string) => {
    cancelledRoomsRef.current.add(roomId);
    if (cancelledRoomsRef.current.size > 100) {
      const oldest = cancelledRoomsRef.current.values().next().value;
      if (oldest) cancelledRoomsRef.current.delete(oldest);
    }
  }, []);

  const cleanup = useCallback(() => {
    generationRef.current += 1;
    activeUserRef.current = null;
    subscribedUserRef.current = null;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    peerChannelsRef.current.forEach(({ channel }) => supabase.removeChannel(channel));
    peerChannelsRef.current.clear();
    callbacksRef.current = {};
  }, []);

  useEffect(() => {
    activeUserRef.current = userId;
    return () => {
      cleanup();
    };
  }, [cleanup, userId]);

  return {
    subscribeToSignaling,
    sendOffer,
    sendOfferAck,
    sendAnswer,
    sendIceCandidate,
    sendCallState,
    releasePeer,
    cancelCall,
    cleanup,
  };
};
