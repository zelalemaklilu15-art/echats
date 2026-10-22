import { act, renderHook } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ channel: vi.fn(), remove: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { channel: mocks.channel, removeChannel: mocks.remove } }));
import { useCallSignaling } from '@/hooks/useCallSignaling';

describe('call signaling disposal', () => {
  let statuses: Array<(status: string) => void>;
  let channels: Array<{ send: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> }>;
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks(); statuses = []; channels = [];
    mocks.remove.mockResolvedValue('ok');
    mocks.channel.mockImplementation(() => {
      const channel = { send: vi.fn().mockResolvedValue('ok'), on: vi.fn(), subscribe: vi.fn() };
      channel.on.mockReturnValue(channel);
      channel.subscribe.mockImplementation((callback) => { statuses.push(callback); return channel; });
      channels.push(channel); return channel;
    });
  });
  afterEach(() => vi.useRealTimers());

  it('does not recreate or send through channels after cleanup during subscription', async () => {
    const { result } = renderHook(() => useCallSignaling('self'));
    const pending = result.current.sendOffer('peer', { type: 'offer' }, 'voice', 'Self', undefined, 'old-room').catch(() => null);
    act(() => result.current.cleanup());
    await act(async () => { statuses[0]('CHANNEL_ERROR'); await pending; });
    expect(mocks.channel).toHaveBeenCalledTimes(1);
    expect(channels[0].send).not.toHaveBeenCalled();
  });

  it('disposes listening and peer channels when the account changes', async () => {
    const { result, rerender } = renderHook(({ user }) => useCallSignaling(user), { initialProps: { user: 'self' } });
    act(() => result.current.subscribeToSignaling({}));
    const pending = result.current.sendOffer('peer', { type: 'offer' }, 'voice', 'Self', undefined, 'room').catch(() => null);
    rerender({ user: 'other' });
    await act(async () => { statuses[1]('SUBSCRIBED'); await pending; });
    expect(mocks.remove).toHaveBeenCalledTimes(2);
    expect(channels[1].send).not.toHaveBeenCalled();
  });

  it('cancels a queued old offer while still allowing its hangup signal', async () => {
    const { result } = renderHook(() => useCallSignaling('self'));
    const pending = result.current.sendOffer('peer', { type: 'offer' }, 'voice', 'Self', undefined, 'room').catch(() => null);
    act(() => result.current.cancelCall('room'));
    await act(async () => { statuses[0]('SUBSCRIBED'); await pending; });
    expect(channels[0].send).not.toHaveBeenCalled();
    await result.current.sendCallState('peer', 'ended', 'room');
    expect(channels[0].send).toHaveBeenCalledWith(expect.objectContaining({ event: 'call_state' }));
  });

  it('ignores late broadcasts and reconnects from a previous account', () => {
    const incoming = vi.fn();
    const { result, rerender } = renderHook(({ user }) => useCallSignaling(user), { initialProps: { user: 'self' } });
    act(() => result.current.subscribeToSignaling({ onIncomingCall: incoming }));
    const oldOffer = channels[0].on.mock.calls.find(([, filter]) => filter.event === 'call_offer')?.[2];
    if (!oldOffer) throw new Error('No call offer handler');
    rerender({ user: 'other' });
    act(() => result.current.subscribeToSignaling({ onIncomingCall: incoming }));
    act(() => { oldOffer({ payload: { roomId: 'old-room' } }); statuses[0]('CHANNEL_ERROR'); vi.advanceTimersByTime(2000); });
    expect(incoming).not.toHaveBeenCalled();
    expect(mocks.channel).toHaveBeenCalledTimes(2);
  });
});