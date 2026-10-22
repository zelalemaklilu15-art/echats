import { act, renderHook } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ ice: vi.fn(), media: vi.fn(), display: vi.fn() }));
vi.mock('@/lib/etokIceServers', () => ({ getEtokIceServers: mocks.ice }));
import { useWebRTC } from '@/hooks/useWebRTC';

class Track {
  enabled = true; readyState = 'live'; onended = null;
  stop = vi.fn(() => { this.readyState = 'ended'; });
  constructor(public kind: string) {}
}
class Stream {
  constructor(private tracks: Track[] = []) {}
  getTracks() { return [...this.tracks]; }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  addTrack(track: Track) { this.tracks.push(track); }
  removeTrack(track: Track) { this.tracks = this.tracks.filter(t => t !== track); }
}
class Sender {
  constructor(public track: Track | null) {}
  replaceTrack = vi.fn(async (track: Track | null) => { this.track = track; });
  getParameters() { return { encodings: [{}] }; }
  setParameters = vi.fn().mockResolvedValue(undefined);
}
class Peer {
  senders: Sender[] = []; close = vi.fn();
  addTrack = vi.fn((track: Track) => { const sender = new Sender(track); this.senders.push(sender); return sender; });
  getSenders() { return this.senders; }
  getTransceivers() { return this.senders.map(sender => ({ sender, receiver: { track: sender.track } })); }
}
const asStream = (s: Stream) => s as unknown as MediaStream;

describe('call media lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.ice.mockResolvedValue([{ urls: 'stun:test' }]);
    mocks.media.mockImplementation(async (constraints) => new Stream([
      ...(constraints.audio ? [new Track('audio')] : []), ...(constraints.video ? [new Track('video')] : []),
    ]));
    mocks.display.mockResolvedValue(new Stream([new Track('video')]));
    vi.stubGlobal('MediaStream', Stream); vi.stubGlobal('RTCPeerConnection', Peer);
    vi.stubGlobal('RTCRtpSender', {});
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: mocks.media, getDisplayMedia: mocks.display, enumerateDevices: vi.fn().mockResolvedValue([]),
    } });
  });
  afterEach(() => vi.unstubAllGlobals());

  for (const kind of ['audio', 'video'] as const) {
    it(`reuses the negotiated ${kind} sender after repeated hardware off/on`, async () => {
      const { result } = renderHook(() => useWebRTC());
      let peer: Peer = new Peer();
      await act(async () => {
        const stream = await result.current.getUserMedia('video');
        peer = await result.current.createPeerConnection(vi.fn()) as unknown as Peer;
        result.current.addLocalTracks(stream);
      });
      const original = peer.senders.find(s => s.track?.kind === kind);
      expect(original).toBeDefined();
      for (let n = 0; n < 2; n++) {
        await act(async () => {
          if (kind === 'audio') await result.current.setMicrophoneEnabled(false);
          else await result.current.setCameraEnabled(false);
        });
        expect(original?.track).toBeNull();
        await act(async () => {
          if (kind === 'audio') await result.current.setMicrophoneEnabled(true);
          else await result.current.setCameraEnabled(true);
        });
        expect(original?.track?.kind).toBe(kind);
        expect(original?.track?.readyState).toBe('live');
      }
      expect(peer.addTrack).toHaveBeenCalledTimes(2);
    });
  }

  it('stops a pending media result after cleanup instead of republishing it', async () => {
    let resolve: (s: MediaStream) => void = () => {};
    mocks.media.mockReturnValueOnce(new Promise<MediaStream>(yes => { resolve = yes; }));
    const { result } = renderHook(() => useWebRTC());
    const pending = result.current.getUserMedia('video').catch(() => null);
    act(() => result.current.cleanup());
    const track = new Track('audio');
    await act(async () => { resolve(asStream(new Stream([track]))); await pending; });
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(result.current.state.localStream).toBeNull();
  });

  it('does not create a peer when a cancelled ICE lookup resolves', async () => {
    let resolve: (s: RTCIceServer[]) => void = () => {};
    mocks.ice.mockReturnValueOnce(new Promise<RTCIceServer[]>(yes => { resolve = yes; }));
    const { result } = renderHook(() => useWebRTC());
    const pending = result.current.createPeerConnection(vi.fn()).catch(() => null);
    act(() => result.current.cleanup());
    await act(async () => { resolve([{ urls: 'stun:test' }]); await pending; });
    expect(result.current.getPeerConnection()).toBeNull();
  });

  it('restores an enabled live camera after screen sharing ends', async () => {
    const { result } = renderHook(() => useWebRTC());
    let camera: MediaStreamTrack | undefined;
    await act(async () => {
      const stream = await result.current.getUserMedia('video'); camera = stream.getVideoTracks()[0];
      await result.current.createPeerConnection(vi.fn()); result.current.addLocalTracks(stream);
      await result.current.startScreenShare();
    });
    expect(camera?.enabled).toBe(false);
    await act(async () => { await result.current.stopScreenShare(); });
    expect(camera?.enabled).toBe(true);
    expect(result.current.state.localStream?.getVideoTracks()[0]).toBe(camera);
  });

  it('releases all media and closes the peer on unmount', async () => {
    const { result, unmount } = renderHook(() => useWebRTC());
    let stream: MediaStream | undefined; let peer: Peer | undefined;
    await act(async () => {
      stream = await result.current.getUserMedia('video');
      peer = await result.current.createPeerConnection(vi.fn()) as unknown as Peer;
    });
    unmount();
    expect(stream?.getTracks().every(t => t.readyState === 'ended')).toBe(true);
    expect(peer?.close).toHaveBeenCalledTimes(1);
  });

  for (const kind of ['audio', 'video'] as const) {
    it(`keeps ${kind} stopped when a superseded on request resolves after off`, async () => {
      const { result } = renderHook(() => useWebRTC());
      await act(async () => {
        const stream = await result.current.getUserMedia('video');
        await result.current.createPeerConnection(vi.fn()); result.current.addLocalTracks(stream);
      });
      let resolve: (s: MediaStream) => void = () => {};
      mocks.media.mockReturnValueOnce(new Promise<MediaStream>(yes => { resolve = yes; }));
      const pending = (kind === 'audio' ? result.current.setMicrophoneEnabled(true) : result.current.setCameraEnabled(true)).catch(() => null);
      await act(async () => {
        if (kind === 'audio') await result.current.setMicrophoneEnabled(false);
        else await result.current.setCameraEnabled(false);
      });
      const track = new Track(kind);
      await act(async () => { resolve(asStream(new Stream([track]))); await pending; });
      expect(track.readyState).toBe('ended');
      expect(result.current.state.localStream?.getTracks().filter(t => t.kind === kind)).toHaveLength(0);
    });

    it(`stops a pending ${kind} sender replacement immediately on hangup`, async () => {
      const { result } = renderHook(() => useWebRTC());
      let peer = new Peer();
      await act(async () => {
        const stream = await result.current.getUserMedia('video');
        peer = await result.current.createPeerConnection(vi.fn()) as unknown as Peer;
        result.current.addLocalTracks(stream);
      });
      const sender = peer.senders.find(s => s.track?.kind === kind);
      if (!sender) throw new Error('Missing sender');
      let release: () => void = () => {};
      sender.replaceTrack.mockImplementationOnce(async track => {
        await new Promise<void>(resolve => { release = resolve; }); sender.track = track;
      });
      const track = new Track(kind);
      mocks.media.mockResolvedValueOnce(new Stream([track]));
      let pending = Promise.resolve();
      await act(async () => {
        pending = (kind === 'audio' ? result.current.setMicrophoneEnabled(true) : result.current.setCameraEnabled(true)).catch(() => {});
      });
      act(() => result.current.cleanup());
      expect(track.readyState).toBe('ended');
      await act(async () => { release(); await pending; });
      expect(result.current.state.localStream).toBeNull();
    });
  }

  it('does not restore a camera turned off during screen sharing', async () => {
    const { result } = renderHook(() => useWebRTC());
    let camera: MediaStreamTrack | undefined;
    await act(async () => {
      const stream = await result.current.getUserMedia('video'); camera = stream.getVideoTracks()[0];
      await result.current.createPeerConnection(vi.fn()); result.current.addLocalTracks(stream);
      await result.current.startScreenShare();
      await result.current.setCameraEnabled(false);
      await result.current.stopScreenShare();
    });
    expect(camera?.readyState).toBe('ended');
    expect(result.current.state.localStream?.getVideoTracks()).toHaveLength(0);
    expect(mocks.media).toHaveBeenCalledTimes(1);
  });
});