import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  media: vi.fn(), createPeer: vi.fn(), cleanup: vi.fn(), offer: vi.fn(),
  sendOffer: vi.fn(), sendState: vi.fn(), createLog: vi.fn(), updateLog: vi.fn(),
  subscribe: vi.fn(),
}));
vi.mock('@/hooks/useWebRTC', () => ({ useWebRTC: () => ({
  state: {}, networkStats: {}, getUserMedia: mocks.media, createPeerConnection: mocks.createPeer,
  addLocalTracks: vi.fn(), createOffer: mocks.offer, cleanup: mocks.cleanup,
  setDataMessageHandler: vi.fn(),
}) }));
vi.mock('@/hooks/useCallSignaling', () => ({ useCallSignaling: () => ({
  subscribeToSignaling: mocks.subscribe, sendOffer: mocks.sendOffer, sendCallState: mocks.sendState,
  releasePeer: vi.fn(), cancelCall: vi.fn(), sendOfferAck: vi.fn().mockResolvedValue(undefined),
}) }));
vi.mock('@/lib/callLogService', () => ({ callLogService: {
  createCallLog: mocks.createLog, updateCallLog: mocks.updateLog,
} }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  functions: { invoke: vi.fn().mockResolvedValue({}) },
} }));
vi.mock('@/lib/profileAccess', () => ({ PROFILE_ACCESS_EVENT: 'profile-access', getAccessProfile: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/pushNotificationService', () => ({ pushNotificationService: { closeCallNotification: vi.fn() } }));
vi.mock('@/lib/callPresenceService', () => ({
  joinCallPresence: vi.fn().mockResolvedValue(undefined), leaveCallPresence: vi.fn(),
  isPeerAvailable: () => true, isPresenceReady: () => true,
}));
import { useCallManager } from '@/hooks/useCallManager';

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const props = { userId: 'self', userName: 'Self' };

describe('call termination and redial', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    mocks.media.mockResolvedValue({ getTracks: () => [] });
    mocks.createPeer.mockResolvedValue({}); mocks.offer.mockResolvedValue({ type: 'offer' });
    mocks.sendOffer.mockResolvedValue('room'); mocks.sendState.mockResolvedValue(undefined);
    mocks.createLog.mockResolvedValue('log'); mocks.updateLog.mockResolvedValue(true);
  });
  afterEach(() => vi.useRealTimers());

  it('stops media immediately on hangup instead of waiting for the end screen', async () => {
    const { result } = renderHook(() => useCallManager(props));
    await act(async () => { await result.current.startCall('peer', 'Peer', 'voice'); });
    mocks.cleanup.mockClear();
    await act(async () => { await result.current.endCall(); });
    expect(mocks.cleanup).toHaveBeenCalledTimes(1);
    expect(result.current.callState).toBe('call_ended');
  });

  it('ignores connected callbacks after hangup', async () => {
    const { result } = renderHook(() => useCallManager(props));
    await act(async () => { await result.current.startCall('peer', 'Peer', 'voice'); });
    const connectionChanged = mocks.createPeer.mock.calls[0][1];
    await act(async () => { await result.current.endCall(); });
    act(() => connectionChanged('connected'));
    expect(result.current.callState).toBe('call_ended');
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.callDuration).toBe(0);
  });

  it('does not send an old offer when cancelled media acquisition resolves during a redial', async () => {
    const oldMedia = deferred<MediaStream>();
    mocks.media.mockReturnValueOnce(oldMedia.promise);
    const { result } = renderHook(() => useCallManager(props));
    let oldStart: Promise<void> = Promise.resolve();
    await act(async () => { oldStart = result.current.startCall('peer', 'Peer', 'video'); });
    const oldRoom = result.current.activeCall?.roomId;
    await act(async () => { await result.current.endCall(); });
    act(() => vi.advanceTimersByTime(1));
    await act(async () => { await result.current.startCall('peer', 'Peer', 'voice'); });
    const newRoom = result.current.activeCall?.roomId;
    expect(newRoom).not.toBe(oldRoom);
    await act(async () => { oldMedia.resolve({ getTracks: () => [] } as unknown as MediaStream); await oldStart; });
    expect(mocks.sendOffer).toHaveBeenCalledTimes(1);
    expect(mocks.sendOffer.mock.calls[0][5]).toBe(newRoom);
    expect(result.current.callState).toBe('outgoing_calling');
  });

  it('does not fail or clean up a new call when old media permission rejects', async () => {
    const oldMedia = deferred<MediaStream>(); mocks.media.mockReturnValueOnce(oldMedia.promise);
    const { result } = renderHook(() => useCallManager(props));
    let oldStart: Promise<void> = Promise.resolve();
    await act(async () => { oldStart = result.current.startCall('peer', 'Peer', 'voice'); });
    await act(async () => { await result.current.endCall(); });
    act(() => vi.advanceTimersByTime(1));
    await act(async () => { await result.current.startCall('peer', 'Peer', 'voice'); });
    mocks.cleanup.mockClear();
    await act(async () => { oldMedia.reject(new Error('permission denied')); await oldStart; });
    expect(result.current.callState).toBe('outgoing_calling');
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });

  it('releases capture and cancels offer retries on unmount', async () => {
    const { result, unmount } = renderHook(() => useCallManager(props));
    await act(async () => { await result.current.startCall('peer', 'Peer', 'video'); });
    mocks.cleanup.mockClear(); mocks.sendOffer.mockClear(); unmount();
    act(() => vi.advanceTimersByTime(10000));
    expect(mocks.cleanup).toHaveBeenCalledTimes(1);
    expect(mocks.sendOffer).not.toHaveBeenCalled();
  });
});