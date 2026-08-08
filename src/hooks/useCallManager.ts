import { useState, useCallback, useRef, useEffect } from 'react';
import { useWebRTC, CallType, NetworkQuality } from './useWebRTC';
import { useCallSignaling, CallOffer, CallAnswer, IceCandidate, CallStateEvent } from './useCallSignaling';
import { callLogService } from '@/lib/callLogService';
import { pushNotificationService } from '@/lib/pushNotificationService';
import { supabase } from '@/integrations/supabase/client';
import {
  joinCallPresence,
  leaveCallPresence,
  isPeerAvailable,
  isPresenceReady,
} from '@/lib/callPresenceService';

export interface InCallMessage {
  id: string;
  text: string;
  fromSelf: boolean;
  at: number;
}


export type CallState =
  | 'idle'
  | 'outgoing_calling'
  | 'incoming_ringing'
  | 'connecting'
  | 'in_call'
  | 'call_ended'
  | 'call_failed'
  | 'rejected'
  | 'missed';

export interface ActiveCall {
  roomId: string;
  peerId: string;
  peerName: string;
  peerAvatar?: string;
  callType: CallType;
  isOutgoing: boolean;
  startTime?: Date;
  callLogId?: string;
}

interface UseCallManagerProps {
  userId: string | null;
  userName: string;
  userAvatar?: string;
}

const CALL_TIMEOUT_MS = 60000; // 60 seconds ring timeout
const ICE_RECOVERY_MS = 6000; // grace period before declaring the call failed

export const useCallManager = ({ userId, userName, userAvatar }: UseCallManagerProps) => {
  const [callState, setCallState] = useState<CallState>('idle');
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<InCallMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);


  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live mirrors so async handlers never read stale state
  const callStateRef = useRef<CallState>('idle');
  const activeCallRef = useRef<ActiveCall | null>(null);
  const durationRef = useRef(0);
  const callLogIdRef = useRef<string | null>(null);
  const logFinalizedRef = useRef(false);

  // ICE buffers
  const pendingRemoteIce = useRef<RTCIceCandidateInit[]>([]);
  const pendingLocalIce = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<CallOffer | null>(null);

  const webRTC = useWebRTC();
  const signaling = useCallSignaling(userId);

  const setCallStateSafe = useCallback((s: CallState) => {
    callStateRef.current = s;
    setCallState(s);
  }, []);

  const setActiveCallSafe = useCallback(
    (updater: ActiveCall | null | ((prev: ActiveCall | null) => ActiveCall | null)) => {
      setActiveCall((prev) => {
        const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
        activeCallRef.current = next;
        return next;
      });
    },
    [],
  );

  const clearTimers = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }
  }, []);

  const startDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) return;
    durationRef.current = 0;
    setCallDuration(0);
    durationIntervalRef.current = setInterval(() => {
      durationRef.current += 1;
      setCallDuration(durationRef.current);
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // Persist the final outcome of a call exactly once
  const finalizeLog = useCallback(
    async (status: 'completed' | 'missed' | 'rejected' | 'failed') => {
      if (logFinalizedRef.current) return;
      logFinalizedRef.current = true;

      const duration = status === 'completed' ? durationRef.current : 0;
      const logId = callLogIdRef.current;
      const roomId = activeCallRef.current?.roomId;

      try {
        if (logId) {
          await callLogService.updateCallLog(logId, status, duration);
        } else if (roomId) {
          await callLogService.updateCallLogByRoomId(roomId, status, duration);
        }
      } catch (e) {
        console.warn('[CallManager] Failed to finalize call log:', e);
      }
    },
    [],
  );

  const resetCall = useCallback(() => {
    clearTimers();
    stopDurationTimer();
    webRTC.cleanup();
    signaling.releasePeer(activeCallRef.current?.peerId);
    pushNotificationService.closeCallNotification();

    callStateRef.current = 'idle';
    activeCallRef.current = null;
    callLogIdRef.current = null;
    logFinalizedRef.current = false;
    durationRef.current = 0;
    pendingRemoteIce.current = [];
    pendingLocalIce.current = [];
    pendingOfferRef.current = null;

    setCallState('idle');
    setActiveCall(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsCameraOff(false);
    setErrorMessage(null);
  }, [clearTimers, stopDurationTimer, webRTC, signaling]);

  // ---- ICE plumbing -----------------------------------------------------
  const flushLocalIce = useCallback(() => {
    const call = activeCallRef.current;
    if (!call || pendingLocalIce.current.length === 0) return;
    const queued = pendingLocalIce.current;
    pendingLocalIce.current = [];
    queued.forEach((c) => signaling.sendIceCandidate(call.peerId, c, call.roomId));
  }, [signaling]);

  const flushRemoteIce = useCallback(async () => {
    if (!webRTC.hasRemoteDescription()) return;
    const queued = pendingRemoteIce.current;
    pendingRemoteIce.current = [];
    for (const c of queued) {
      await webRTC.addIceCandidate(c);
    }
  }, [webRTC]);

  const handleIceCandidate = useCallback(
    (candidate: RTCIceCandidate) => {
      const call = activeCallRef.current;
      const json = candidate.toJSON();
      if (!call) {
        pendingLocalIce.current.push(json);
        return;
      }
      signaling.sendIceCandidate(call.peerId, json, call.roomId);
    },
    [signaling],
  );

  // ---- Connection state -------------------------------------------------
  const attemptIceRestart = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call || !call.isOutgoing) return;
    try {
      const offer = await webRTC.createOffer({ iceRestart: true });
      await signaling.sendOffer(
        call.peerId,
        offer,
        call.callType,
        userName,
        userAvatar,
        call.roomId,
      );
      console.log('[CallManager] ICE restart offer sent');
    } catch (e) {
      console.warn('[CallManager] ICE restart failed:', e);
    }
  }, [webRTC, signaling, userName, userAvatar]);

  const handleConnectionStateChange = useCallback(
    (state: RTCPeerConnectionState) => {
      console.log('[CallManager] Connection state:', state);

      switch (state) {
        case 'connected': {
          if (recoveryTimeoutRef.current) {
            clearTimeout(recoveryTimeoutRef.current);
            recoveryTimeoutRef.current = null;
          }
          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
          }
          setCallStateSafe('in_call');
          setActiveCallSafe((prev) => (prev ? { ...prev, startTime: prev.startTime ?? new Date() } : prev));
          startDurationTimer();
          break;
        }
        case 'disconnected': {
          // Give ICE a chance to recover before failing the call
          if (recoveryTimeoutRef.current) clearTimeout(recoveryTimeoutRef.current);
          attemptIceRestart();
          recoveryTimeoutRef.current = setTimeout(() => {
            if (callStateRef.current === 'in_call' || callStateRef.current === 'connecting') {
              setCallStateSafe('call_failed');
              setErrorMessage('Connection lost');
              finalizeLog('failed');
              setTimeout(resetCall, 2500);
            }
          }, ICE_RECOVERY_MS);
          break;
        }
        case 'failed': {
          setCallStateSafe('call_failed');
          setErrorMessage('Connection failed');
          finalizeLog('failed');
          setTimeout(resetCall, 2500);
          break;
        }
        case 'closed': {
          if (callStateRef.current === 'in_call') {
            setCallStateSafe('call_ended');
            finalizeLog('completed');
          }
          break;
        }
      }
    },
    [setCallStateSafe, setActiveCallSafe, startDurationTimer, attemptIceRestart, finalizeLog, resetCall],
  );

  // ---- Outgoing call ----------------------------------------------------
  const startCall = useCallback(
    async (peerId: string, peerName: string, callType: CallType, peerAvatar?: string) => {
      if (!userId) {
        setErrorMessage('Not authenticated');
        return;
      }
      if (callStateRef.current !== 'idle') {
        setErrorMessage('Already in a call');
        return;
      }

      const sorted = [userId, peerId].sort();
      const roomId = `call_${sorted[0]}_${sorted[1]}_${Date.now()}`;

      try {
        logFinalizedRef.current = false;
        setCallStateSafe('outgoing_calling');
        setErrorMessage(null);

        // Register the peer target up-front so no ICE candidate is lost
        setActiveCallSafe({
          roomId,
          peerId,
          peerName,
          peerAvatar,
          callType,
          isOutgoing: true,
        });

        const localStream = await webRTC.getUserMedia(callType);
        await webRTC.createPeerConnection(handleIceCandidate, handleConnectionStateChange);
        webRTC.addLocalTracks(localStream);

        const offer = await webRTC.createOffer();

        await signaling.sendOffer(peerId, offer, callType, userName, userAvatar, roomId);
        flushLocalIce();

        // Persist the call log (starts as "missed" until answered)
        const callLogId = await callLogService.createCallLog({
          callerId: userId,
          receiverId: peerId,
          callType,
          roomId,
        });
        callLogIdRef.current = callLogId;
        setActiveCallSafe((prev) => (prev ? { ...prev, callLogId: callLogId || undefined } : prev));

        // Ring the callee even if their app is backgrounded (best effort)
        supabase.functions
          .invoke('send-call-notification', {
            body: { receiverId: peerId, callerName: userName, callType, roomId },
          })
          .catch(() => {});

        callTimeoutRef.current = setTimeout(() => {
          if (callStateRef.current === 'outgoing_calling' || callStateRef.current === 'connecting') {
            signaling.sendCallState(peerId, 'timeout', roomId);
            setCallStateSafe('call_failed');
            setErrorMessage('Call timed out - no answer');
            finalizeLog('missed');
            setTimeout(resetCall, 3000);
          }
        }, CALL_TIMEOUT_MS);
      } catch (err) {
        console.error('[CallManager] Start call error:', err);
        setCallStateSafe('call_failed');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to start call');
        finalizeLog('failed');
        webRTC.cleanup();
        setTimeout(resetCall, 3000);
      }
    },
    [
      userId,
      userName,
      userAvatar,
      webRTC,
      signaling,
      handleIceCandidate,
      handleConnectionStateChange,
      flushLocalIce,
      finalizeLog,
      resetCall,
      setActiveCallSafe,
      setCallStateSafe,
    ],
  );

  // ---- Incoming call ----------------------------------------------------
  const acceptCall = useCallback(async () => {
    const incomingCall = pendingOfferRef.current;
    if (!incomingCall || !userId) return;

    try {
      setCallStateSafe('connecting');
      setErrorMessage(null);
      pushNotificationService.closeCallNotification();
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      setActiveCallSafe({
        roomId: incomingCall.roomId,
        peerId: incomingCall.callerId,
        peerName: incomingCall.callerName,
        peerAvatar: incomingCall.callerAvatar,
        callType: incomingCall.callType,
        isOutgoing: false,
      });

      const localStream = await webRTC.getUserMedia(incomingCall.callType);
      await webRTC.createPeerConnection(handleIceCandidate, handleConnectionStateChange);
      webRTC.addLocalTracks(localStream);

      const answer = await webRTC.handleOffer(incomingCall.offer);
      await signaling.sendAnswer(incomingCall.callerId, answer, incomingCall.roomId);

      flushLocalIce();
      await flushRemoteIce();

      pendingOfferRef.current = null;

      // Connection watchdog for the answering side
      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'connecting') {
          setCallStateSafe('call_failed');
          setErrorMessage('Could not connect');
          finalizeLog('failed');
          setTimeout(resetCall, 2500);
        }
      }, CALL_TIMEOUT_MS);
    } catch (err) {
      console.error('[CallManager] Accept call error:', err);
      setCallStateSafe('call_failed');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to accept call');
      finalizeLog('failed');
      webRTC.cleanup();
      setTimeout(resetCall, 3000);
    }
  }, [
    userId,
    webRTC,
    signaling,
    handleIceCandidate,
    handleConnectionStateChange,
    flushLocalIce,
    flushRemoteIce,
    finalizeLog,
    resetCall,
    setActiveCallSafe,
    setCallStateSafe,
  ]);

  const rejectCall = useCallback(() => {
    const incomingCall = pendingOfferRef.current || activeCallRef.current;
    if (!incomingCall) {
      resetCall();
      return;
    }
    const peerId = (incomingCall as CallOffer).callerId || (incomingCall as ActiveCall).peerId;
    signaling.sendCallState(peerId, 'rejected', incomingCall.roomId);
    finalizeLog('rejected');
    pendingOfferRef.current = null;
    resetCall();
  }, [signaling, resetCall, finalizeLog]);

  const endCall = useCallback(async () => {
    const call = activeCallRef.current;
    const wasConnected = callStateRef.current === 'in_call';

    if (call) {
      signaling.sendCallState(call.peerId, wasConnected ? 'ended' : 'rejected', call.roomId);
      await finalizeLog(wasConnected ? 'completed' : call.isOutgoing ? 'missed' : 'rejected');
      pushNotificationService.closeCallNotification();
    }

    stopDurationTimer();
    setCallStateSafe('call_ended');
    setTimeout(resetCall, 1500);
  }, [signaling, finalizeLog, resetCall, stopDurationTimer, setCallStateSafe]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      webRTC.toggleMute(next);
      return next;
    });
  }, [webRTC]);

  const toggleCamera = useCallback(() => {
    setIsCameraOff((prev) => {
      const next = !prev;
      webRTC.toggleCamera(next);
      return next;
    });
  }, [webRTC]);

  // ---- Signaling handlers ----------------------------------------------
  const handleIncomingCall = useCallback(
    (offer: CallOffer) => {
      console.log('[CallManager] Incoming call from', offer.callerName);

      const current = activeCallRef.current;

      // ICE-restart offer for the call we are already in
      if (current && current.roomId === offer.roomId && callStateRef.current !== 'incoming_ringing') {
        webRTC
          .handleOffer(offer.offer)
          .then((answer) => signaling.sendAnswer(offer.callerId, answer, offer.roomId))
          .then(() => flushRemoteIce())
          .catch((e) => console.warn('[CallManager] Renegotiation failed:', e));
        return;
      }

      if (callStateRef.current !== 'idle') {
        signaling.sendCallState(offer.callerId, 'busy', offer.roomId);
        return;
      }

      logFinalizedRef.current = false;
      pendingOfferRef.current = offer;
      setActiveCallSafe({
        roomId: offer.roomId,
        peerId: offer.callerId,
        peerName: offer.callerName,
        peerAvatar: offer.callerAvatar,
        callType: offer.callType,
        isOutgoing: false,
      });
      setCallStateSafe('incoming_ringing');

      pushNotificationService.showIncomingCallNotification(offer.callerName, offer.callType);

      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'incoming_ringing') {
          signaling.sendCallState(offer.callerId, 'timeout', offer.roomId);
          pushNotificationService.closeCallNotification();
          setCallStateSafe('missed');
          finalizeLog('missed');
          setTimeout(resetCall, 3000);
        }
      }, CALL_TIMEOUT_MS);
    },
    [signaling, webRTC, flushRemoteIce, resetCall, finalizeLog, setActiveCallSafe, setCallStateSafe],
  );

  const handleCallAnswer = useCallback(
    async (answer: CallAnswer) => {
      const call = activeCallRef.current;
      if (!call || answer.roomId !== call.roomId) return;

      try {
        if (callStateRef.current === 'outgoing_calling') setCallStateSafe('connecting');
        await webRTC.handleAnswer(answer.answer);
        await flushRemoteIce();
      } catch (err) {
        console.error('[CallManager] Handle answer error:', err);
        setCallStateSafe('call_failed');
        setErrorMessage('Failed to connect');
        finalizeLog('failed');
        setTimeout(resetCall, 2500);
      }
    },
    [webRTC, flushRemoteIce, finalizeLog, resetCall, setCallStateSafe],
  );

  const handleReceivedIceCandidate = useCallback(
    async (data: IceCandidate) => {
      const call = activeCallRef.current;
      if (!call || data.roomId !== call.roomId) return;

      if (!webRTC.hasRemoteDescription()) {
        pendingRemoteIce.current.push(data.candidate);
        return;
      }
      await webRTC.addIceCandidate(data.candidate);
    },
    [webRTC],
  );

  const handleCallStateEvent = useCallback(
    (event: CallStateEvent) => {
      const call = activeCallRef.current;
      if (call && event.roomId !== call.roomId) return;
      if (callStateRef.current === 'idle') return;

      switch (event.type) {
        case 'rejected':
          setCallStateSafe('rejected');
          setErrorMessage('Call was declined');
          finalizeLog('rejected');
          setTimeout(resetCall, 2500);
          break;
        case 'ended':
          stopDurationTimer();
          setCallStateSafe('call_ended');
          finalizeLog(durationRef.current > 0 ? 'completed' : 'missed');
          setTimeout(resetCall, 1500);
          break;
        case 'busy':
          setCallStateSafe('call_failed');
          setErrorMessage('User is busy');
          finalizeLog('missed');
          setTimeout(resetCall, 2500);
          break;
        case 'timeout':
          setCallStateSafe('missed');
          finalizeLog('missed');
          setTimeout(resetCall, 2500);
          break;
      }
    },
    [resetCall, finalizeLog, stopDurationTimer, setCallStateSafe],
  );

  // Keep callbacks fresh without tearing down the realtime channel
  const handlersRef = useRef({
    handleIncomingCall,
    handleCallAnswer,
    handleReceivedIceCandidate,
    handleCallStateEvent,
  });
  handlersRef.current = {
    handleIncomingCall,
    handleCallAnswer,
    handleReceivedIceCandidate,
    handleCallStateEvent,
  };

  useEffect(() => {
    if (!userId) return;

    signaling.subscribeToSignaling({
      onIncomingCall: (o) => handlersRef.current.handleIncomingCall(o),
      onCallAnswer: (a) => handlersRef.current.handleCallAnswer(a),
      onIceCandidate: (c) => handlersRef.current.handleReceivedIceCandidate(c),
      onCallStateChange: (e) => handlersRef.current.handleCallStateEvent(e),
    });
    // Intentionally only re-run when the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      if (recoveryTimeoutRef.current) clearTimeout(recoveryTimeoutRef.current);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, []);

  return {
    // State
    callState,
    activeCall,
    callDuration,
    isMuted,
    isCameraOff,
    errorMessage,
    localStream: webRTC.state.localStream,
    remoteStream: webRTC.state.remoteStream,
    connectionState: webRTC.state.connectionState,

    // Actions
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    resetCall,
  };
};
