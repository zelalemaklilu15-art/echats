import { useCallback, useRef, useState } from 'react';
import { getEtokIceServers } from '@/lib/etokIceServers';

export type CallType = 'voice' | 'video';

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

export const useWebRTC = () => {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<WebRTCState>({
    localStream: null,
    remoteStream: null,
    connectionState: null,
    iceConnectionState: null,
  });

  const [error, setError] = useState<string | null>(null);

  // Get user media based on call type
  const getUserMedia = useCallback(async (callType: CallType): Promise<MediaStream> => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video:
          callType === 'video'
            ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setState((prev) => ({ ...prev, localStream: stream }));
      return stream;
    } catch (err) {
      const name = (err as DOMException)?.name || '';
      const errorMessage = err instanceof Error ? err.message : 'Failed to access media devices';
      if (name === 'NotAllowedError' || errorMessage.includes('Permission denied')) {
        throw new Error(
          callType === 'video'
            ? 'Camera and microphone permission denied. Please allow access to make video calls.'
            : 'Microphone permission denied. Please allow access to make voice calls.',
        );
      }
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        throw new Error(
          callType === 'video'
            ? 'No camera or microphone found on this device.'
            : 'No microphone found on this device.',
        );
      }
      if (name === 'NotReadableError') {
        throw new Error('Your camera or microphone is already in use by another app.');
      }
      throw new Error(
        `Failed to access ${callType === 'video' ? 'camera/microphone' : 'microphone'}: ${errorMessage}`,
      );
    }
  }, []);

  // Create peer connection (async: fetches fresh TURN credentials)
  const createPeerConnection = useCallback(
    async (
      onIceCandidate: (candidate: RTCIceCandidate) => void,
      onConnectionStateChange?: (state: RTCPeerConnectionState) => void,
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

      const pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 4 });
      peerConnectionRef.current = pc;

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
        onConnectionStateChange?.(pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        setState((prev) => ({ ...prev, iceConnectionState: pc.iceConnectionState }));
      };

      return pc;
    },
    [],
  );

  const addLocalTracks = useCallback((stream: MediaStream) => {
    if (!peerConnectionRef.current) throw new Error('Peer connection not initialized');
    stream.getTracks().forEach((track) => {
      peerConnectionRef.current!.addTrack(track, stream);
    });
  }, []);

  const createOffer = useCallback(
    async (options?: { iceRestart?: boolean }): Promise<RTCSessionDescriptionInit> => {
      if (!peerConnectionRef.current) throw new Error('Peer connection not initialized');
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: options?.iceRestart ?? false,
      });
      await peerConnectionRef.current.setLocalDescription(offer);
      return offer;
    },
    [],
  );

  const handleOffer = useCallback(
    async (offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> => {
      if (!peerConnectionRef.current) throw new Error('Peer connection not initialized');
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
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

  const hasRemoteDescription = useCallback(
    () => !!peerConnectionRef.current?.remoteDescription,
    [],
  );

  const getPeerConnection = useCallback(() => peerConnectionRef.current, []);

  const toggleMute = useCallback((muted: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }, []);

  const toggleCamera = useCallback((disabled: boolean) => {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !disabled;
    });
  }, []);

  const cleanup = useCallback(() => {
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
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setState({
      localStream: null,
      remoteStream: null,
      connectionState: null,
      iceConnectionState: null,
    });

    setError(null);
  }, []);

  return {
    state,
    error,
    setError,
    getUserMedia,
    createPeerConnection,
    addLocalTracks,
    createOffer,
    handleOffer,
    handleAnswer,
    addIceCandidate,
    hasRemoteDescription,
    getPeerConnection,
    toggleMute,
    toggleCamera,
    cleanup,
    peerConnection: peerConnectionRef.current,
  };
};
