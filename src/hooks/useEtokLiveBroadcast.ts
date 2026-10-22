import { useEffect, useRef, useState } from 'react';
import { sendWebRTCSignal, subscribeToWebRTCSignals } from '@/lib/etokLiveService';
import { getEtokIceServers } from '@/lib/etokIceServers';

interface BroadcastOptions { streamId?: string; userId: string; isHost: boolean; hostId?: string; }
export function useEtokLiveBroadcast({ streamId, userId, isHost, hostId }: BroadcastOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  useEffect(() => {
    setError(null); setIsConnected(false);
    if (!streamId || !userId || (!isHost && !hostId)) return;
    let active = true;
    let local: MediaStream | null = null;
    const peers = new Map<string, RTCPeerConnection>();
    const chains = new Map<string, Promise<void>>();
    const candidates = new Map<string, RTCIceCandidateInit[]>();
    const report = () => { if (active) setError('Could not connect live video. Please leave and retry.'); };
    const attach = (stream: MediaStream) => { if (active && videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play().catch(() => {}); } };
    const ready = (async () => {
      const iceServers = await getEtokIceServers();
      if (!active) return null;
      if (isHost) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 720 },height: { ideal: 1280 },facingMode: 'user' },audio: true });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return null; }
        local = stream; attach(stream);
      }
      return iceServers;
    })();
    void ready.catch(report);
    const send = async (to: string,kind: 'offer' | 'answer' | 'ice' | 'request',payload: any) => { if (active) await sendWebRTCSignal(streamId,userId,to,kind,payload); };
    const flush = async (id: string, pc: RTCPeerConnection) => {
      const queued = candidates.get(id) ?? []; candidates.delete(id);
      for (const item of queued) { if (!active || peers.get(id) !== pc) return; await pc.addIceCandidate(item); }
    };
    const createPeer = (id: string, iceServers: RTCIceServer[]) => {
      peers.get(id)?.close();
      const pc = new RTCPeerConnection({ iceServers }); peers.set(id,pc);
      pc.onicecandidate = event => { if (active && peers.get(id) === pc && event.candidate) void send(id,'ice',event.candidate.toJSON()).catch(report); };
      pc.onconnectionstatechange = () => {
        if (!active || peers.get(id) !== pc) return;
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          const failed = pc.connectionState === 'failed';
          peers.delete(id); candidates.delete(id); pc.close();
          if (!isHost) setIsConnected(false);
          if (failed) report();
        }
      };
      return pc;
    };
    const unsubscribe = subscribeToWebRTCSignals(userId, signal => {
      if (!active || signal.streamId !== streamId || (!isHost && signal.fromUserId !== hostId)) return;
      const id = signal.fromUserId;
      const job = (chains.get(id) ?? Promise.resolve()).catch(() => {}).then(async () => {
        const iceServers = await ready;
        if (!active || !iceServers) return;
        if (signal.signalType === 'ice') {
          const pc = peers.get(id);
          if (pc?.remoteDescription) await pc.addIceCandidate(signal.payload);
          else candidates.set(id,[...(candidates.get(id) ?? []),signal.payload].slice(-100));
          return;
        }
        if (isHost && signal.signalType === 'request') {
          if (peers.has(id) || !local) return;
          const pc = createPeer(id,iceServers); const capture = local;
          capture.getTracks().forEach(track => pc.addTrack(track,capture));
          const offer = await pc.createOffer(); if (!active || peers.get(id) !== pc) return;
          await pc.setLocalDescription(offer); if (!active || peers.get(id) !== pc) return;
          await send(id,'offer',offer);
        } else if (isHost && signal.signalType === 'answer') {
          const pc = peers.get(id); if (!pc) return;
          await pc.setRemoteDescription(signal.payload); if (active) await flush(id,pc);
        } else if (!isHost && signal.signalType === 'offer') {
          const pc = createPeer(id,iceServers);
          const remote = new MediaStream(); attach(remote);
          pc.ontrack = event => { if (!active || peers.get(id) !== pc) return; remote.addTrack(event.track); attach(remote); };
          await pc.setRemoteDescription(signal.payload); if (!active || peers.get(id) !== pc) return;
          await flush(id,pc);
          const answer = await pc.createAnswer(); if (!active || peers.get(id) !== pc) return;
          await pc.setLocalDescription(answer); if (!active || peers.get(id) !== pc) return;
          await send(id,'answer',answer);
        }
      });
      chains.set(id,job); return job;
    }, () => { if (!isHost && hostId) void ready.then(servers => { if (servers && active) return send(hostId,'request',{}); }).catch(report); }, report);
    return () => {
      active = false; unsubscribe(); local?.getTracks().forEach(t => t.stop()); local = null;
      peers.forEach(pc => pc.close()); peers.clear(); candidates.clear(); chains.clear();
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [streamId,userId,isHost,hostId]);
  const onPlaying = () => { if (videoRef.current?.srcObject && videoRef.current.readyState >= 2) setIsConnected(true); };
  return { videoRef,error,isConnected,onPlaying };
}
