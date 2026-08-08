import { useCallback, useEffect, useRef, useState } from 'react';
import { getEtokIceServers } from '@/lib/etokIceServers';

export type CallType = 'voice' | 'video';
export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export interface MediaDeviceOption {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export interface NetworkStats {
  quality: NetworkQuality;
  packetLossPercent: number;
  roundTripMs: number;
  outboundKbps: number;
  frameHeight: number | null;
}

export interface WebRTCState {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState | null;
  iceConnectionState: RTCIceConnectionState | null;
}

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

// Premium-first media constraints. `min` is intentionally omitted for width/height
// so browsers can degrade gracefully on weak devices instead of throwing
// OverconstrainedError; adaptive bitrate handles the downscaling at runtime.
const HD_VIDEO: MediaTrackConstraints = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30, max: 30 },
  facingMode: 'user',
};

const HQ_AUDIO: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  sampleRate: 48000,
};

const PREFERRED_VIDEO_CODECS = ['video/VP9', 'video/H264', 'video/VP8'];
const MAX_VIDEO_BITRATE = 2_500_000; // 2.5 Mbps for 1080p
const STATS_INTERVAL_MS = 3000;

/** Reorders the transceiver codec list so high quality codecs win negotiation. */
function preferVideoCodecs(pc: RTCPeerConnection) {
  try {
    const caps = RTCRtpSender.getCapabilities?.('video');
    if (!caps?.codecs?.length) return;
    const ranked = [...caps.codecs].sort((a, b) => {
      const ia = PREFERRED_VIDEO_CODECS.indexOf(a.mimeType);
      const ib = PREFERRED_VIDEO_CODECS.indexOf(b.mimeType);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    pc.getTransceivers().forEach((t) => {
      if (t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video') {
        t.setCodecPreferences?.(ranked);
      }
    });
  } catch (e) {
    console.warn('[WebRTC] Codec preference failed:', e);
  }
}

/** Applies adaptive-bitrate friendly encoding params to the video sender. */
async function tuneVideoSender(sender: RTCRtpSender) {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    params.encodings[0].maxBitrate = MAX_VIDEO_BITRATE;
    params.encodings[0].maxFramerate = 30;
    // Keep motion smooth but let the browser drop resolution when bandwidth dips.
    (params as any).degradationPreference = 'balanced';
    await sender.setParameters(params);
  } catch (e) {
    console.warn('[WebRTC] Failed to tune video sender:', e);
  }
}

export const useWebRTC = () => {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const callTypeRef = useRef<CallType>('voice');
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const cameraTrackBeforeShareRef = useRef<MediaStreamTrack | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const dataMessageHandlerRef = useRef<((text: string) => void) | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStatsRef = useRef<{ packets: number; lost: number; bytes: number; ts: number } | null>(null);
  const selectedAudioInputRef = useRef<string | undefined>(undefined);
  const selectedVideoInputRef = useRef<string | undefined>(undefined);

  const [state, setState] = useState<WebRTCState>({
    localStream: null,
    remoteStream: null,
    connectionState: null,
    iceConnectionState: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceOption[]>([]);
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    quality: 'unknown',
    packetLossPercent: 0,
    roundTripMs: 0,
    outboundKbps: 0,
    frameHeight: null,
  });

  // ---- Media -----------------------------------------------------------
  const buildConstraints = useCallback((callType: CallType): MediaStreamConstraints => {
    const audio: MediaTrackConstraints = { ...HQ_AUDIO };
    if (selectedAudioInputRef.current) audio.deviceId = { exact: selectedAudioInputRef.current };

    if (callType !== 'video') return { audio, video: false };

    const video: MediaTrackConstraints = { ...HD_VIDEO };
    if (selectedVideoInputRef.current) {
      video.deviceId = { exact: selectedVideoInputRef.current };
      delete (video as any).facingMode;
    }
    return { audio, video };
  }, []);

  const mapMediaError = useCallback((err: unknown, callType: CallType): Error => {
    const name = (err as DOMException)?.name || '';
    const errorMessage = err instanceof Error ? err.message : 'Failed to access media devices';
    if (name === 'NotAllowedError' || errorMessage.includes('Permission denied')) {
      return new Error(
        callType === 'video'
          ? 'Camera and microphone permission denied. Please allow access to make video calls.'
          : 'Microphone permission denied. Please allow access to make voice calls.',
      );
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return new Error(
        callType === 'video'
          ? 'No camera or microphone found on this device.'
          : 'No microphone found on this device.',
      );
    }
    if (name === 'NotReadableError') {
      return new Error('Your camera or microphone is already in use by another app.');
    }
    return new Error(
      `Failed to access ${callType === 'video' ? 'camera/microphone' : 'microphone'}: ${errorMessage}`,
    );
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const mapped = list
        .filter((d) => d.kind === 'audioinput' || d.kind === 'videoinput' || d.kind === 'audiooutput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          kind: d.kind,
          label: d.label || `${d.kind.replace('input', ' input').replace('output', ' output')} ${i + 1}`,
        }));
      setDevices(mapped);
      return mapped;
    } catch {
      return [];
    }
  }, []);

  const getUserMedia = useCallback(
    async (callType: CallType): Promise<MediaStream> => {
      callTypeRef.current = callType;
      try {
        const stream = await navigator.mediaDevices.getUserMedia(buildConstraints(callType));
        localStreamRef.current = stream;
        setState((prev) => ({ ...prev, localStream: stream }));
        refreshDevices();
        return stream;
      } catch (err) {
        throw mapMediaError(err, callType);
      }
    },
    [buildConstraints, mapMediaError, refreshDevices],
  );

  // ---- Stats monitoring -------------------------------------------------
  const startStatsMonitor = useCallback(() => {
    if (statsTimerRef.current) return;
    statsTimerRef.current = setInterval(async () => {
      const pc = peerConnectionRef.current;
      if (!pc || pc.connectionState !== 'connected') return;
      try {
        const report = await pc.getStats();
        let packets = 0;
        let lost = 0;
        let bytes = 0;
        let rtt = 0;
        let frameHeight: number | null = null;

        report.forEach((s: any) => {
          if (s.type === 'outbound-rtp' && !s.isRemote) {
            bytes += s.bytesSent || 0;
            packets += s.packetsSent || 0;
            if (s.frameHeight) frameHeight = s.frameHeight;
          }
          if (s.type === 'remote-inbound-rtp') {
            lost += s.packetsLost || 0;
            if (s.roundTripTime) rtt = Math.max(rtt, s.roundTripTime * 1000);
          }
          if (s.type === 'inbound-rtp' && !s.isRemote) {
            lost += s.packetsLost || 0;
            packets += s.packetsReceived || 0;
          }
          if (s.type === 'candidate-pair' && s.state === 'succeeded' && s.currentRoundTripTime) {
            rtt = Math.max(rtt, s.currentRoundTripTime * 1000);
          }
        });

        const prev = lastStatsRef.current;
        const now = Date.now();
        const dPackets = prev ? packets - prev.packets : packets;
        const dLost = prev ? lost - prev.lost : lost;
        const dBytes = prev ? bytes - prev.bytes : bytes;
        const dSeconds = prev ? Math.max((now - prev.ts) / 1000, 0.001) : STATS_INTERVAL_MS / 1000;
        lastStatsRef.current = { packets, lost, bytes, ts: now };

        const lossPercent = dPackets > 0 ? Math.max(0, (dLost / (dPackets + dLost)) * 100) : 0;
        const kbps = (dBytes * 8) / 1000 / dSeconds;

        let quality: NetworkQuality = 'excellent';
        if (lossPercent > 8 || rtt > 500) quality = 'poor';
        else if (lossPercent > 3 || rtt > 300) quality = 'fair';
        else if (lossPercent > 1 || rtt > 150) quality = 'good';

        setNetworkStats({
          quality,
          packetLossPercent: Math.round(lossPercent * 10) / 10,
          roundTripMs: Math.round(rtt),
          outboundKbps: Math.round(kbps),
          frameHeight,
        });
      } catch {
        /* stats unavailable */
      }
    }, STATS_INTERVAL_MS);
  }, []);

  const stopStatsMonitor = useCallback(() => {
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }
    lastStatsRef.current = null;
  }, []);

  // ---- Data channel (in-call chat) -------------------------------------
  const wireDataChannel = useCallback((channel: RTCDataChannel) => {
    dataChannelRef.current = channel;
    channel.onmessage = (e) => {
      if (typeof e.data === 'string') dataMessageHandlerRef.current?.(e.data);
    };
    channel.onclose = () => {
      if (dataChannelRef.current === channel) dataChannelRef.current = null;
    };
  }, []);

  const setDataMessageHandler = useCallback((fn: ((text: string) => void) | null) => {
    dataMessageHandlerRef.current = fn;
  }, []);

  const sendDataMessage = useCallback((text: string): boolean => {
    const ch = dataChannelRef.current;
    if (!ch || ch.readyState !== 'open') return false;
    try {
      ch.send(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  // ---- Peer connection --------------------------------------------------
  const createPeerConnection = useCallback(
    async (
      onIceCandidate: (candidate: RTCIceCandidate) => void,
      onConnectionStateChange?: (state: RTCPeerConnectionState) => void,
      options?: { createDataChannel?: boolean },
    ): Promise<RTCPeerConnection> => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      let iceServers: RTCIceServer[] = FALLBACK_ICE_SERVERS;
      try {
        const fetched = await getEtokIceServers();
        if (fetched?.length) iceServers = fetched;
      } catch {
        // keep fallback
      }

      const pc = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 4,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      });
      peerConnectionRef.current = pc;

      if (options?.createDataChannel) {
        try {
          wireDataChannel(pc.createDataChannel('echat-call-chat', { ordered: true }));
        } catch (e) {
          console.warn('[WebRTC] Data channel creation failed:', e);
        }
      }

      pc.ondatachannel = (event) => wireDataChannel(event.channel);

      pc.onicecandidate = (event) => {
        if (event.candidate) onIceCandidate(event.candidate);
      };

      pc.ontrack = (event) => {
        let remoteStream = event.streams?.[0];
        if (!remoteStream) {
          remoteStream = remoteStreamRef.current || new MediaStream();
          remoteStream.addTrack(event.track);
        }
        remoteStreamRef.current = remoteStream;
        setState((prev) => ({ ...prev, remoteStream }));
      };

      pc.onconnectionstatechange = () => {
        setState((prev) => ({ ...prev, connectionState: pc.connectionState }));
        if (pc.connectionState === 'connected') startStatsMonitor();
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') stopStatsMonitor();
        onConnectionStateChange?.(pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        setState((prev) => ({ ...prev, iceConnectionState: pc.iceConnectionState }));
      };

      return pc;
    },
    [wireDataChannel, startStatsMonitor, stopStatsMonitor],
  );

  const addLocalTracks = useCallback((stream: MediaStream) => {
    const pc = peerConnectionRef.current;
    if (!pc) throw new Error('Peer connection not initialized');
    stream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, stream);
      if (track.kind === 'video') tuneVideoSender(sender);
    });
    preferVideoCodecs(pc);
  }, []);

  const createOffer = useCallback(
    async (options?: { iceRestart?: boolean }): Promise<RTCSessionDescriptionInit> => {
      const pc = peerConnectionRef.current;
      if (!pc) throw new Error('Peer connection not initialized');
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: options?.iceRestart ?? false,
      });
      await pc.setLocalDescription(offer);
      return offer;
    },
    [],
  );

  const handleOffer = useCallback(
    async (offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> => {
      const pc = peerConnectionRef.current;
      if (!pc) throw new Error('Peer connection not initialized');
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      preferVideoCodecs(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer;
    },
    [],
  );

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) throw new Error('Peer connection not initialized');
    if (pc.signalingState === 'stable') return; // answer already applied
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }, []);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return false;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      return true;
    } catch (err) {
      console.warn('[WebRTC] Failed to add ICE candidate:', err);
      return false;
    }
  }, []);

  const hasRemoteDescription = useCallback(() => !!peerConnectionRef.current?.remoteDescription, []);
  const getPeerConnection = useCallback(() => peerConnectionRef.current, []);

  // ---- Track replacement helpers ---------------------------------------
  const replaceOutgoingTrack = useCallback(
    async (kind: 'audio' | 'video', track: MediaStreamTrack | null) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      const sender = pc.getSenders().find((s) => s.track?.kind === kind);
      if (sender) {
        await sender.replaceTrack(track);
        if (kind === 'video' && track) await tuneVideoSender(sender);
      } else if (track && localStreamRef.current) {
        const added = pc.addTrack(track, localStreamRef.current);
        if (kind === 'video') await tuneVideoSender(added);
      }
    },
    [],
  );

  const swapLocalTrack = useCallback((kind: 'audio' | 'video', track: MediaStreamTrack | null) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getTracks().filter((t) => t.kind === kind).forEach((t) => stream.removeTrack(t));
    if (track) stream.addTrack(track);
    // Emit a new MediaStream reference so React consumers re-render video elements.
    const next = new MediaStream(stream.getTracks());
    localStreamRef.current = next;
    setState((prev) => ({ ...prev, localStream: next }));
  }, []);

  // ---- True mute / hardware stop ---------------------------------------
  /** Fully stops the microphone hardware when muting; re-acquires it on unmute. */
  const setMicrophoneEnabled = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        localStreamRef.current?.getAudioTracks().forEach((t) => {
          t.enabled = false;
          t.stop();
        });
        await replaceOutgoingTrack('audio', null);
        swapLocalTrack('audio', null);
        return;
      }
      const audio: MediaTrackConstraints = { ...HQ_AUDIO };
      if (selectedAudioInputRef.current) audio.deviceId = { exact: selectedAudioInputRef.current };
      const stream = await navigator.mediaDevices.getUserMedia({ audio });
      const track = stream.getAudioTracks()[0];
      await replaceOutgoingTrack('audio', track);
      swapLocalTrack('audio', track);
    },
    [replaceOutgoingTrack, swapLocalTrack],
  );

  /** Fully stops the camera (LED off, battery saved) and re-acquires on demand. */
  const setCameraEnabled = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        localStreamRef.current?.getVideoTracks().forEach((t) => {
          t.enabled = false;
          t.stop();
        });
        await replaceOutgoingTrack('video', null);
        swapLocalTrack('video', null);
        return;
      }
      const video: MediaTrackConstraints = { ...HD_VIDEO };
      if (selectedVideoInputRef.current) {
        video.deviceId = { exact: selectedVideoInputRef.current };
        delete (video as any).facingMode;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video });
      const track = stream.getVideoTracks()[0];
      await replaceOutgoingTrack('video', track);
      swapLocalTrack('video', track);
    },
    [replaceOutgoingTrack, swapLocalTrack],
  );

  // Legacy soft-mute helpers kept for compatibility
  const toggleMute = useCallback((muted: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, []);
  const toggleCamera = useCallback((disabled: boolean) => {
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !disabled));
  }, []);

  // ---- Device switching (no renegotiation needed) -----------------------
  const switchAudioInput = useCallback(
    async (deviceId: string) => {
      selectedAudioInputRef.current = deviceId;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { ...HQ_AUDIO, deviceId: { exact: deviceId } },
      });
      const track = stream.getAudioTracks()[0];
      localStreamRef.current?.getAudioTracks().forEach((t) => t.stop());
      await replaceOutgoingTrack('audio', track);
      swapLocalTrack('audio', track);
    },
    [replaceOutgoingTrack, swapLocalTrack],
  );

  const switchVideoInput = useCallback(
    async (deviceId: string) => {
      if (isScreenSharing) return;
      selectedVideoInputRef.current = deviceId;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { ...HD_VIDEO, deviceId: { exact: deviceId }, facingMode: undefined } as MediaTrackConstraints,
      });
      const track = stream.getVideoTracks()[0];
      localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
      await replaceOutgoingTrack('video', track);
      swapLocalTrack('video', track);
    },
    [isScreenSharing, replaceOutgoingTrack, swapLocalTrack],
  );

  /** Flips between front and back cameras on mobile. */
  const flipCamera = useCallback(async () => {
    if (isScreenSharing) return;
    const current = localStreamRef.current?.getVideoTracks()[0];
    const currentFacing = (current?.getSettings().facingMode as string) || 'user';
    const nextFacing = currentFacing === 'user' ? 'environment' : 'user';
    selectedVideoInputRef.current = undefined;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { ...HD_VIDEO, facingMode: { ideal: nextFacing } },
    });
    const track = stream.getVideoTracks()[0];
    current?.stop();
    await replaceOutgoingTrack('video', track);
    swapLocalTrack('video', track);
  }, [isScreenSharing, replaceOutgoingTrack, swapLocalTrack]);

  // ---- Screen sharing ---------------------------------------------------
  const stopScreenShare = useCallback(async () => {
    const screenTrack = screenTrackRef.current;
    if (screenTrack) {
      screenTrack.onended = null;
      screenTrack.stop();
      screenTrackRef.current = null;
    }

    let cameraTrack = cameraTrackBeforeShareRef.current;
    cameraTrackBeforeShareRef.current = null;

    if (cameraTrack && cameraTrack.readyState !== 'live') cameraTrack = null;
    if (!cameraTrack && callTypeRef.current === 'video') {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { ...HD_VIDEO } });
        cameraTrack = s.getVideoTracks()[0];
      } catch {
        cameraTrack = null;
      }
    }

    await replaceOutgoingTrack('video', cameraTrack);
    swapLocalTrack('video', cameraTrack);
    setIsScreenSharing(false);
  }, [replaceOutgoingTrack, swapLocalTrack]);

  const startScreenShare = useCallback(async () => {
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    const track = display.getVideoTracks()[0];
    screenTrackRef.current = track;
    cameraTrackBeforeShareRef.current = localStreamRef.current?.getVideoTracks()[0] ?? null;
    // Pause (not stop) the camera so it can be restored instantly.
    cameraTrackBeforeShareRef.current && (cameraTrackBeforeShareRef.current.enabled = false);

    await replaceOutgoingTrack('video', track);
    swapLocalTrack('video', track);
    setIsScreenSharing(true);

    track.onended = () => {
      stopScreenShare();
    };
  }, [replaceOutgoingTrack, swapLocalTrack, stopScreenShare]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) await stopScreenShare();
    else await startScreenShare();
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  // ---- Cleanup ----------------------------------------------------------
  const cleanup = useCallback(() => {
    stopStatsMonitor();

    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    cameraTrackBeforeShareRef.current?.stop();
    cameraTrackBeforeShareRef.current = null;

    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close();
      } catch {
        /* noop */
      }
      dataChannelRef.current = null;
    }
    dataMessageHandlerRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.ondatachannel = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    selectedAudioInputRef.current = undefined;
    selectedVideoInputRef.current = undefined;

    setIsScreenSharing(false);
    setNetworkStats({
      quality: 'unknown',
      packetLossPercent: 0,
      roundTripMs: 0,
      outboundKbps: 0,
      frameHeight: null,
    });
    setState({
      localStream: null,
      remoteStream: null,
      connectionState: null,
      iceConnectionState: null,
    });
    setError(null);
  }, [stopStatsMonitor]);

  useEffect(() => {
    const onChange = () => refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
  }, [refreshDevices]);

  return {
    state,
    error,
    setError,
    networkStats,
    devices,
    isScreenSharing,

    getUserMedia,
    refreshDevices,
    createPeerConnection,
    addLocalTracks,
    createOffer,
    handleOffer,
    handleAnswer,
    addIceCandidate,
    hasRemoteDescription,
    getPeerConnection,

    // media control
    setMicrophoneEnabled,
    setCameraEnabled,
    toggleMute,
    toggleCamera,
    switchAudioInput,
    switchVideoInput,
    flipCamera,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,

    // data channel
    sendDataMessage,
    setDataMessageHandler,

    cleanup,
    peerConnection: peerConnectionRef.current,
  };
};
