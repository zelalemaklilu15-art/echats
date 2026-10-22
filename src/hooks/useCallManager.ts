import { useState, useCallback, useRef, useEffect } from 'react';
import { useWebRTC, CallType, NetworkQuality } from './useWebRTC';
import { useCallSignaling, CallOffer, CallAnswer, IceCandidate, CallStateEvent } from './useCallSignaling';
import { callLogService } from '@/lib/callLogService';
import { pushNotificationService } from '@/lib/pushNotificationService';
import { supabase } from '@/integrations/supabase/client';
import { getAccessProfile, PROFILE_ACCESS_EVENT } from '@/lib/profileAccess';
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
const OFFER_RETRY_INTERVAL_MS = 2000;
const OFFER_RETRY_MAX = 10; // ~20s of re-ringing before giving up
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
  const offerRetryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetCallRef = useRef<() => void>(() => {});
  const stopResourcesRef = useRef<() => void>(() => {});
  // Single, cancellable post-call cleanup. A stale timer from the previous call
  // must never tear down a new call, so every new call clears it first.
  const scheduleReset = useCallback((ms: number) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = null;
      resetCallRef.current();
    }, ms);
  }, []);
  const offerAckedRef = useRef(false);

  // Live mirrors so async handlers never read stale state
  const callStateRef = useRef<CallState>('idle');
  const activeCallRef = useRef<ActiveCall | null>(null);
  const durationRef = useRef(0);
  const callLogIdRef = useRef<string | null>(null);
  const logFinalizedRef = useRef(false);
  const mutedRef = useRef(false);
  const cameraOffRef = useRef(false);
  const isCurrentCall = useCallback((roomId: string) =>
    activeCallRef.current?.roomId === roomId &&
    ['outgoing_calling', 'incoming_ringing', 'connecting', 'in_call'].includes(callStateRef.current), []);

  // ICE buffers
  const pendingRemoteIce = useRef<RTCIceCandidateInit[]>([]);
  const pendingLocalIce = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<CallOffer | null>(null);


  const webRTC = useWebRTC();
  const signaling = useCallSignaling(userId);

  // ---- Supabase Realtime Presence --------------------------------------
  useEffect(() => {
    if (!userId) {
      leaveCallPresence();
      return;
    }
    joinCallPresence(userId);
    return () => {
      leaveCallPresence();
    };
  }, [userId]);

  // ---- In-call chat over the RTCDataChannel -----------------------------
  useEffect(() => {
    webRTC.setDataMessageHandler((text) => {
      setChatMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text, fromSelf: false, at: Date.now() },
      ]);
      setUnreadChatCount((n) => n + 1);
    });
    return () => webRTC.setDataMessageHandler(null);
  }, [webRTC]);

  const sendCallChatMessage = useCallback(
    (text: string): boolean => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      const ok = webRTC.sendDataMessage(trimmed);
      if (ok) {
        setChatMessages((prev) => [
          ...prev,
          { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: trimmed, fromSelf: true, at: Date.now() },
        ]);
      }
      return ok;
    },
    [webRTC],
  );

  const markChatRead = useCallback(() => setUnreadChatCount(0), []);


  const setCallStateSafe = useCallback((s: CallState) => {
    callStateRef.current = s;
    setCallState(s);
    if (['call_ended', 'call_failed', 'rejected', 'missed'].includes(s)) stopResourcesRef.current();
  }, []);

  const setActiveCallSafe = useCallback(
    (updater: ActiveCall | null | ((prev: ActiveCall | null) => ActiveCall | null)) => {
      // Async call setup must see this immediately, not only after React renders.
      const next = typeof updater === 'function' ? updater(activeCallRef.current) : updater;
      activeCallRef.current = next;
      setActiveCall(next);
    },
    [],
  );

  const stopOfferRetries = useCallback(() => {
    if (offerRetryTimerRef.current) {
      clearInterval(offerRetryTimerRef.current);
      offerRetryTimerRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = null;
    }
    stopOfferRetries();
  }, [stopOfferRetries]);

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

  const stopCallResources = useCallback(() => {
    const roomId = activeCallRef.current?.roomId;
    if (roomId) signaling.cancelCall(roomId);
    clearTimers();
    stopDurationTimer();
    webRTC.cleanup();
    pendingOfferRef.current = null;
    pendingRemoteIce.current = [];
    pendingLocalIce.current = [];
    pushNotificationService.closeCallNotification();
  }, [clearTimers, stopDurationTimer, webRTC.cleanup, signaling.cancelCall]);
  stopResourcesRef.current = stopCallResources;

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
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    clearTimers();
    stopDurationTimer();
    const roomId = activeCallRef.current?.roomId;
    if (roomId) signaling.cancelCall(roomId);
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
    offerAckedRef.current = false;

    setCallState('idle');
    setActiveCall(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsCameraOff(false);
    mutedRef.current = false;
    cameraOffRef.current = false;
    setErrorMessage(null);
    setChatMessages([]);
    setUnreadChatCount(0);

  }, [clearTimers, stopDurationTimer, webRTC, signaling]);
  resetCallRef.current = resetCall;

  // ---- ICE plumbing -----------------------------------------------------
  const flushLocalIce = useCallback(() => {
    const call = activeCallRef.current;
    if (!call || pendingLocalIce.current.length === 0) return;
    const queued = pendingLocalIce.current;
    pendingLocalIce.current = [];
    queued.forEach((c) => signaling.sendIceCandidate(call.peerId, c, call.roomId));
  }, [signaling]);

  const flushRemoteIce = useCallback(async () => {
    const roomId = activeCallRef.current?.roomId;
    if (!roomId || !isCurrentCall(roomId)) return;
    if (!webRTC.hasRemoteDescription()) return;
    const queued = pendingRemoteIce.current;
    pendingRemoteIce.current = [];
    for (const c of queued) {
      if (!isCurrentCall(roomId)) return;
      await webRTC.addIceCandidate(c);
    }
  }, [webRTC, isCurrentCall]);

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
      if (!isCurrentCall(call.roomId)) return;
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
  }, [webRTC, signaling, userName, userAvatar, isCurrentCall]);

  const handleConnectionStateChange = useCallback(
    (state: RTCPeerConnectionState) => {
      const roomId = activeCallRef.current?.roomId;
      if (!roomId || !isCurrentCall(roomId)) return;
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
              scheduleReset(2500);
            }
          }, ICE_RECOVERY_MS);
          break;
        }
        case 'failed': {
          setCallStateSafe('call_failed');
          setErrorMessage('Connection failed');
          finalizeLog('failed');
          scheduleReset(2500);
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
    [setCallStateSafe, setActiveCallSafe, startDurationTimer, attemptIceRestart, finalizeLog, resetCall, isCurrentCall],
  );

  // ---- Outgoing call ----------------------------------------------------
  const startCall = useCallback(
    async (peerId: string, peerName: string, callType: CallType, peerAvatar?: string) => {
      if (!userId) {
        setErrorMessage('Not authenticated');
        return;
      }
      if (peerId === userId) {
        setCallStateSafe('call_failed');
        setErrorMessage('You cannot call yourself');
        scheduleReset(2000);
        return;
      }
      // A finished call that is only showing its end screen must not block redialing.
      if (['call_ended','missed','rejected','call_failed'].includes(callStateRef.current)) resetCallRef.current();
      if (callStateRef.current !== 'idle') {
        setErrorMessage('Already in a call');
        return;
      }

      // Presence is informational only — the call still rings and the callee
      // still gets a push even when presence has not synced yet.
      joinCallPresence(userId).catch(() => {});
      const presenceSaysOffline = isPresenceReady() && !isPeerAvailable(peerId);

      const sorted = [userId, peerId].sort();
      const roomId = `call_${sorted[0]}_${sorted[1]}_${crypto.randomUUID()}`;

      try {
        logFinalizedRef.current = false;
        offerAckedRef.current = false;
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

        // History + device ring happen immediately, independent of signalling.
        const callLogId = await callLogService
          .createCallLog({ callerId: userId, receiverId: peerId, callType, roomId })
          .catch(() => null);
        if (!isCurrentCall(roomId)) {
          if (callLogId) void callLogService.updateCallLog(callLogId, 'missed', 0);
          return;
        }
        callLogIdRef.current = callLogId;
        setActiveCallSafe(prev => prev?.roomId === roomId ? { ...prev, callLogId: callLogId || undefined } : prev);

        supabase.functions
          .invoke('send-call-notification', {
            body: { receiverId: peerId, callType, roomId },
          })
          .catch(() => {});

        const localStream = await webRTC.getUserMedia(callType);
        if (!isCurrentCall(roomId)) return;
        await webRTC.createPeerConnection(
          candidate => { if (isCurrentCall(roomId)) handleIceCandidate(candidate); },
          state => { if (isCurrentCall(roomId)) handleConnectionStateChange(state); }, {
          createDataChannel: true,
        });
        if (!isCurrentCall(roomId)) return;
        webRTC.addLocalTracks(localStream);

        const offer = await webRTC.createOffer();
        if (!isCurrentCall(roomId)) return;

        const deliver = () =>
          signaling
            .sendOffer(peerId, offer, callType, userName, userAvatar, roomId)
            .catch((e) => console.warn('[CallManager] Offer send failed:', e));

        await deliver();
        if (!isCurrentCall(roomId)) return;
        flushLocalIce();

        // Keep re-ringing until the callee's device confirms it received the
        // offer, so a dropped realtime message can never silence the call.
        stopOfferRetries();
        let attempts = 0;
        offerRetryTimerRef.current = setInterval(() => {
          attempts += 1;
          if (
            !isCurrentCall(roomId) ||
            offerAckedRef.current ||
            attempts > OFFER_RETRY_MAX ||
            (callStateRef.current !== 'outgoing_calling' && callStateRef.current !== 'connecting')
          ) {
            stopOfferRetries();
            if (!offerAckedRef.current && callStateRef.current === 'outgoing_calling') {
              setCallStateSafe('call_failed');
              setErrorMessage(
                presenceSaysOffline
                  ? `${peerName} is not online right now`
                  : `Could not reach ${peerName}`,
              );
              finalizeLog('missed');
              scheduleReset(3000);
            }
            return;
          }
          deliver();
        }, OFFER_RETRY_INTERVAL_MS);

        callTimeoutRef.current = setTimeout(() => {
          if (isCurrentCall(roomId) && (callStateRef.current === 'outgoing_calling' || callStateRef.current === 'connecting')) {
            signaling.sendCallState(peerId, 'timeout', roomId);
            setCallStateSafe('call_failed');
            setErrorMessage('Call timed out - no answer');
            finalizeLog('missed');
            scheduleReset(3000);
          }
        }, CALL_TIMEOUT_MS);
      } catch (err) {
        if (!isCurrentCall(roomId)) return;
        console.error('[CallManager] Start call error:', err);
        setCallStateSafe('call_failed');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to start call');
        finalizeLog('failed');
        scheduleReset(3000);
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
      stopOfferRetries,
      isCurrentCall,
    ],
  );


  // ---- Incoming call ----------------------------------------------------
  const acceptCall = useCallback(async () => {
    const incomingCall = pendingOfferRef.current;
    if (!incomingCall || !userId || callStateRef.current !== 'incoming_ringing') return;
    const roomId = incomingCall.roomId;

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
        peerName: activeCallRef.current?.peerName ?? 'Hidden profile',
        peerAvatar: activeCallRef.current?.peerAvatar,
        callType: incomingCall.callType,
        isOutgoing: false,
      });

      const localStream = await webRTC.getUserMedia(incomingCall.callType);
      if (!isCurrentCall(roomId)) return;
      await webRTC.createPeerConnection(
        candidate => { if (isCurrentCall(roomId)) handleIceCandidate(candidate); },
        state => { if (isCurrentCall(roomId)) handleConnectionStateChange(state); },
      );
      if (!isCurrentCall(roomId)) return;
      webRTC.addLocalTracks(localStream);

      const answer = await webRTC.handleOffer(incomingCall.offer);
      if (!isCurrentCall(roomId)) return;
      // Only the authenticated receiver can establish call-based profile access.
      const { data: accepted, error: acceptanceError } = await supabase.rpc('accept_profile_call', { p_room_id: incomingCall.roomId });
      if (!isCurrentCall(roomId)) return;
      if (acceptanceError || !accepted) console.warn('[CallManager] Could not record profile acceptance');
      if (accepted) window.dispatchEvent(new Event(PROFILE_ACCESS_EVENT));
      await signaling.sendAnswer(incomingCall.callerId, answer, incomingCall.roomId);
      if (!isCurrentCall(roomId)) return;
      getAccessProfile(incomingCall.callerId).then(profile => {
        setActiveCallSafe(prev => prev?.roomId === incomingCall.roomId && profile
          ? { ...prev, peerName: profile.name ?? profile.username ?? 'Hidden profile', peerAvatar: profile.avatar_url ?? undefined } : prev);
      }).catch(() => {});

      flushLocalIce();
      await flushRemoteIce();
      if (!isCurrentCall(roomId)) return;

      pendingOfferRef.current = null;

      // Connection watchdog for the answering side
      callTimeoutRef.current = setTimeout(() => {
        if (isCurrentCall(roomId) && callStateRef.current === 'connecting') {
          setCallStateSafe('call_failed');
          setErrorMessage('Could not connect');
          finalizeLog('failed');
          scheduleReset(2500);
        }
      }, CALL_TIMEOUT_MS);
    } catch (err) {
      if (!isCurrentCall(roomId)) return;
      console.error('[CallManager] Accept call error:', err);
      setCallStateSafe('call_failed');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to accept call');
      finalizeLog('failed');
      scheduleReset(3000);
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
    isCurrentCall,
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
      // Logging must never block hangup/redial.
      finalizeLog(wasConnected ? 'completed' : call.isOutgoing ? 'missed' : 'rejected').catch(() => {});
      pushNotificationService.closeCallNotification();
    }

    stopDurationTimer();
    setCallStateSafe('call_ended');
    scheduleReset(1500);
  }, [signaling, finalizeLog, resetCall, stopDurationTimer, setCallStateSafe]);

  // True mute: the microphone hardware is released, not just silenced.
  const toggleMute = useCallback(async () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setIsMuted(next);
    try {
      await webRTC.setMicrophoneEnabled(!next);
    } catch (e) {
      console.warn('[CallManager] Mic toggle failed:', e);
      mutedRef.current = !next;
      setIsMuted(!next);
      setErrorMessage('Could not access the microphone');
    }
  }, [webRTC]);

  // True camera off: the capture device stops so the LED turns off.
  const toggleCamera = useCallback(async () => {
    const next = !cameraOffRef.current;
    cameraOffRef.current = next;
    setIsCameraOff(next);
    try {
      await webRTC.setCameraEnabled(!next);
    } catch (e) {
      console.warn('[CallManager] Camera toggle failed:', e);
      cameraOffRef.current = !next;
      setIsCameraOff(!next);
      setErrorMessage('Could not access the camera');
    }
  }, [webRTC]);

  const toggleScreenShare = useCallback(async () => {
    try {
      await webRTC.toggleScreenShare();
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name !== 'NotAllowedError' && name !== 'AbortError') {
        console.warn('[CallManager] Screen share failed:', e);
        setErrorMessage('Screen sharing is not available on this device');
      }
    }
  }, [webRTC]);

  const switchCamera = useCallback(
    async (deviceId?: string) => {
      try {
        if (deviceId) await webRTC.switchVideoInput(deviceId);
        else await webRTC.flipCamera();
      } catch (e) {
        console.warn('[CallManager] Camera switch failed:', e);
        setErrorMessage('Could not switch camera');
      }
    },
    [webRTC],
  );

  const switchMicrophone = useCallback(
    async (deviceId: string) => {
      try {
        await webRTC.switchAudioInput(deviceId);
      } catch (e) {
        console.warn('[CallManager] Mic switch failed:', e);
        setErrorMessage('Could not switch microphone');
      }
    },
    [webRTC],
  );


  // ---- Signaling handlers ----------------------------------------------
  const handleIncomingCall = useCallback(
    (offer: CallOffer) => {
      console.log('[CallManager] Incoming call from', offer.callerName);

      // Confirm receipt immediately so the caller stops re-ringing.
      signaling.sendOfferAck(offer.callerId, offer.roomId).catch(() => {});

      const current = activeCallRef.current;

      // Repeated offer for the call that is already ringing here
      if (
        current &&
        current.roomId === offer.roomId &&
        callStateRef.current === 'incoming_ringing'
      ) {
        return;
      }

      // ICE-restart offer for the call we are already in
      if (current && current.roomId === offer.roomId) {
        if (!isCurrentCall(offer.roomId) || current.isOutgoing || !webRTC.hasRemoteDescription()) return;
        webRTC
          .handleOffer(offer.offer)
          .then((answer) => { if (isCurrentCall(offer.roomId)) return signaling.sendAnswer(offer.callerId, answer, offer.roomId); })
          .then(() => { if (isCurrentCall(offer.roomId)) return flushRemoteIce(); })
          .catch((e) => console.warn('[CallManager] Renegotiation failed:', e));
        return;
      }

      if (['call_ended','missed','rejected','call_failed'].includes(callStateRef.current)) resetCallRef.current();
      if (callStateRef.current !== 'idle') {
        signaling.sendCallState(offer.callerId, 'busy', offer.roomId);
        return;
      }


      logFinalizedRef.current = false;
      pendingOfferRef.current = offer;
      setActiveCallSafe({
        roomId: offer.roomId,
        peerId: offer.callerId,
        peerName: 'Hidden profile',
        callType: offer.callType,
        isOutgoing: false,
      });
      setCallStateSafe('incoming_ringing');

      pushNotificationService.showIncomingCallNotification('Hidden profile', offer.callType);
      getAccessProfile(offer.callerId).then(profile => {
        if (!profile || activeCallRef.current?.roomId !== offer.roomId) return;
        setActiveCallSafe(prev => prev ? { ...prev, peerName: profile.name ?? profile.username ?? 'Hidden profile', peerAvatar: profile.avatar_url ?? undefined } : prev);
      }).catch(() => {});

      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'incoming_ringing') {
          signaling.sendCallState(offer.callerId, 'timeout', offer.roomId);
          pushNotificationService.closeCallNotification();
          setCallStateSafe('missed');
          finalizeLog('missed');
          scheduleReset(3000);
        }
      }, CALL_TIMEOUT_MS);
    },
    [signaling, webRTC, flushRemoteIce, resetCall, finalizeLog, setActiveCallSafe, setCallStateSafe, isCurrentCall],
  );

  const handleCallAnswer = useCallback(
    async (answer: CallAnswer) => {
      const call = activeCallRef.current;
      if (!call || !isCurrentCall(answer.roomId)) return;

      try {
        if (callStateRef.current === 'outgoing_calling') setCallStateSafe('connecting');
        getAccessProfile(call.peerId).then(profile => {
          setActiveCallSafe(prev => prev?.roomId === call.roomId && profile
            ? { ...prev, peerName: profile.name ?? profile.username ?? 'Hidden profile', peerAvatar: profile.avatar_url ?? undefined } : prev);
        }).catch(() => {});
        await webRTC.handleAnswer(answer.answer);
        if (!isCurrentCall(call.roomId)) return;
        await flushRemoteIce();
      } catch (err) {
        if (!isCurrentCall(call.roomId)) return;
        console.error('[CallManager] Handle answer error:', err);
        setCallStateSafe('call_failed');
        setErrorMessage('Failed to connect');
        finalizeLog('failed');
        scheduleReset(2500);
      }
    },
    [webRTC, flushRemoteIce, finalizeLog, resetCall, setCallStateSafe, isCurrentCall],
  );

  const handleReceivedIceCandidate = useCallback(
    async (data: IceCandidate) => {
      const call = activeCallRef.current;
      if (!call || !isCurrentCall(data.roomId)) return;

      if (!webRTC.hasRemoteDescription()) {
        pendingRemoteIce.current.push(data.candidate);
        return;
      }
      await webRTC.addIceCandidate(data.candidate);
    },
    [webRTC, isCurrentCall],
  );

  const handleCallStateEvent = useCallback(
    (event: CallStateEvent) => {
      const call = activeCallRef.current;
      // Ignore late events from a previous call.
      if (!call || event.roomId !== call.roomId) return;
      if (!isCurrentCall(event.roomId)) return;

      switch (event.type) {
        case 'rejected':
          setCallStateSafe('rejected');
          setErrorMessage('Call was declined');
          finalizeLog('rejected');
          scheduleReset(2500);
          break;
        case 'ended':
          stopDurationTimer();
          setCallStateSafe('call_ended');
          finalizeLog(call.startTime ? 'completed' : 'missed');
          scheduleReset(1500);
          break;
        case 'busy':
          setCallStateSafe('call_failed');
          setErrorMessage('User is busy');
          finalizeLog('missed');
          scheduleReset(2500);
          break;
        case 'timeout':
          setCallStateSafe('missed');
          finalizeLog('missed');
          scheduleReset(2500);
          break;
      }
    },
    [resetCall, finalizeLog, stopDurationTimer, setCallStateSafe, isCurrentCall],
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
      onOfferAck: (roomId) => {
        if (activeCallRef.current?.roomId === roomId) {
          offerAckedRef.current = true;
          if (offerRetryTimerRef.current) {
            clearInterval(offerRetryTimerRef.current);
            offerRetryTimerRef.current = null;
          }
        }
      },
    });
    // Intentionally only re-run when the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Account changes and unmount invalidate all in-flight setup and capture.
  useEffect(() => {
    return () => {
      resetCallRef.current();
    };
  }, [userId]);

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
    networkStats: webRTC.networkStats,
    networkQuality: webRTC.networkStats.quality as NetworkQuality,
    isScreenSharing: webRTC.isScreenSharing,
    devices: webRTC.devices,
    chatMessages,
    unreadChatCount,

    // Actions
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    switchCamera,
    switchMicrophone,
    refreshDevices: webRTC.refreshDevices,
    sendCallChatMessage,
    markChatRead,
    resetCall,

  };
};
