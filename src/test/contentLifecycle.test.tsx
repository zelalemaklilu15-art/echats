import { act, render, renderHook, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), ice: vi.fn(), media: vi.fn(), send: vi.fn(), subscribe: vi.fn() }));
vi.mock('@/lib/etokService', () => ({ formatCount: (n: number) => `${n}`, isVideoSaved: mock.read, setVideoSaved: mock.save, recordVideoInteractionAsync: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/native', () => ({ shareContent: vi.fn() }));
vi.mock('@/lib/etokIceServers', () => ({ getEtokIceServers: mock.ice }));
vi.mock('@/lib/etokLiveService', () => ({ sendWebRTCSignal: mock.send, subscribeToWebRTCSignals: mock.subscribe }));
import { EtokShareSheet } from '@/components/etok/EtokShareSheet';
import { useEtokLiveBroadcast } from '@/hooks/useEtokLiveBroadcast';
import type { EtokVideo } from '@/lib/etokService';
const video = { id: 'video', description: 'Test', views: 0, likes: 0, allowDownload: false } as EtokVideo;
describe('content async lifecycle', () => {
  beforeEach(() => { vi.clearAllMocks(); mock.save.mockResolvedValue(undefined); mock.ice.mockResolvedValue([]); mock.send.mockResolvedValue(undefined); mock.subscribe.mockReturnValue(vi.fn()); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it('a late favorite status read cannot undo a successful save', async () => {
    let finish: ((v: boolean) => void) | undefined;
    mock.read.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<EtokShareSheet video={video} currentUserId="viewer" onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save favorite' }));
    await waitFor(() => expect(mock.save).toHaveBeenCalledWith('viewer', 'video', true));
    await screen.findByRole('button', { name: 'Remove favorite' });
    await act(async () => { finish?.(false); });
    expect(screen.getByRole('button', { name: 'Remove favorite' })).toBeEnabled();
  });
  it('rapid favorite clicks submit only one mutation', async () => {
    mock.read.mockResolvedValue(false); mock.save.mockImplementation(() => new Promise(() => {}));
    render(<EtokShareSheet video={video} currentUserId="viewer" onClose={() => {}} />);
    const button = screen.getByRole('button', { name: 'Save favorite' });
    fireEvent.click(button); fireEvent.click(button);
    expect(mock.save).toHaveBeenCalledTimes(1);
  });
  it('Live capture becomes connected only when usable video is playing and stops on closure', async () => {
    const stop = vi.fn(); const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    mock.media.mockResolvedValue(stream);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: mock.media } });
    const { result, rerender } = renderHook(({ id }) => useEtokLiveBroadcast({ streamId: id, userId: 'host', isHost: true }), { initialProps: { id: 'live' as string | undefined } });
    const player = { srcObject: null, readyState: 2, play: vi.fn().mockResolvedValue(undefined) };
    result.current.videoRef.current = player as unknown as HTMLVideoElement;
    await act(async () => {});
    expect(player.srcObject).toBe(stream); expect(result.current.isConnected).toBe(false);
    act(() => result.current.onPlaying()); expect(result.current.isConnected).toBe(true);
    rerender({ id: undefined }); expect(stop).toHaveBeenCalledTimes(1); expect(player.srcObject).toBeNull();
  });
  it('delayed Live capture after unmount is stopped without attaching it', async () => {
    let finish: ((v: MediaStream) => void) | undefined;
    const stop = vi.fn();
    mock.media.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: mock.media } });
    const { unmount } = renderHook(() => useEtokLiveBroadcast({ streamId: 'live', userId: 'host', isHost: true }));
    await act(async () => {}); unmount();
    await act(async () => { finish?.({ getTracks: () => [{ stop }] } as unknown as MediaStream); });
    expect(stop).toHaveBeenCalledTimes(1);
  });
  it('a failed Live peer does not block the same viewer reconnecting', async () => {
    class Peer {
      static instances: Peer[] = [];
      connectionState = 'new';
      onconnectionstatechange?: () => void;
      addTrack = vi.fn();
      close = vi.fn(() => { this.connectionState = 'closed'; });
      createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'test' });
      setLocalDescription = vi.fn().mockResolvedValue(undefined);
      constructor() { Peer.instances.push(this); }
    }
    vi.stubGlobal('RTCPeerConnection', Peer);
    mock.media.mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: mock.media } });
    const { result } = renderHook(() => useEtokLiveBroadcast({ streamId: 'live', userId: 'host', isHost: true }));
    await act(async () => {});
    const receive = mock.subscribe.mock.calls[0][1];
    const request = { streamId: 'live', fromUserId: 'viewer', signalType: 'request', payload: {} };
    await act(async () => { await receive(request); });
    const first = Peer.instances[0];
    expect(first).toBeDefined();
    act(() => { first.connectionState = 'failed'; first.onconnectionstatechange?.(); });
    expect(result.current.error).toBe('Could not connect live video. Please leave and retry.');
    await act(async () => { await receive(request); });
    expect(Peer.instances).toHaveLength(2); expect(first.close).toHaveBeenCalled();
    expect(mock.send).toHaveBeenCalledTimes(2);
  });
});