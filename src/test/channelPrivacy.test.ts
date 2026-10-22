import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  viewer: 'viewer-a',
  authChanged: undefined as undefined | ((event: string, session: { user: { id: string } }) => void),
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock('@/lib/profileAccess', () => ({ PROFILE_ACCESS_EVENT: 'echat:profile-access' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {
    getUser: async () => ({ data: { user: { id: mock.viewer } } }),
    onAuthStateChange: (callback: typeof mock.authChanged) => { mock.authChanged = callback; },
  },
  rpc: mock.rpc,
  from: mock.from,
} }));
import { CHANNELS_SYNC_EVENT, getChannelMessages, syncChannelMessages, syncChannels } from '@/lib/channelService';

const post = { created_at: '2026-10-22T09:00:00Z', id: 'post', channel_id: 'channel', sender_id: 'subject', sender_name: 'Authorized name', content: 'Hello' };
beforeEach(() => {
  localStorage.clear();
  mock.rpc.mockReset();
  mock.from.mockReset();
  mock.viewer = 'viewer-a';
  mock.authChanged?.('SIGNED_IN', { user: { id: mock.viewer } });
});

describe('viewer-scoped channel identity', () => {
  it('does not clear posts for repeated sign-in events on the same account', async () => {
    mock.rpc.mockResolvedValue({ data: [post], error: null });
    await syncChannelMessages('channel');
    mock.authChanged?.('SIGNED_IN', { user: { id: mock.viewer } });
    expect(getChannelMessages('channel')).toHaveLength(1);
  });
  it('shows authorized names only in memory and hides them immediately when access changes', async () => {
    mock.rpc.mockResolvedValue({ data: [post], error: null });
    await syncChannelMessages('channel');
    expect(getChannelMessages('channel')[0].senderName).toBe('Authorized name');
    expect(localStorage.getItem('echat_channel_messages_channel')).toBeNull();
    const rerender = vi.fn();
    window.addEventListener(CHANNELS_SYNC_EVENT, rerender);
    try {
      window.dispatchEvent(new Event('echat:profile-access'));
      expect(getChannelMessages('channel')).toEqual([]);
      expect(rerender).toHaveBeenCalledTimes(1);
    } finally { window.removeEventListener(CHANNELS_SYNC_EVENT, rerender); }
  });

  it('discards an identity response that was started before access was revoked', async () => {
    let complete: ((value: { data: typeof post[]; error: null }) => void) | undefined;
    mock.rpc.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const pending = syncChannelMessages('channel');
    await vi.waitFor(() => expect(mock.rpc).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new Event('echat:profile-access'));
    complete?.({ data: [post], error: null });
    await pending;
    expect(getChannelMessages('channel')).toEqual([]);
  });

  it('does not write the previous account subscriptions after an account switch', async () => {
    localStorage.setItem('echat_channels_migrated_v1', mock.viewer);
    let complete: ((value: { data: { id: string }[]; error: null }) => void) | undefined;
    const channels = new Promise(resolve => { complete = resolve; });
    mock.from.mockImplementation((table: string) => table === 'channels'
      ? { select: () => ({ order: () => ({ limit: () => channels }) }) }
      : { select: () => ({ eq: async () => ({ data: [{ channel_id: 'private-channel' }] }) }) });
    const pending = syncChannels();
    await vi.waitFor(() => expect(mock.from).toHaveBeenCalledWith('channel_subscribers'));
    mock.viewer = 'viewer-b';
    mock.authChanged?.('SIGNED_IN', { user: { id: mock.viewer } });
    complete?.({ data: [{ id: 'private-channel' }], error: null });
    await pending;
    expect(localStorage.getItem('echat_channels')).toBeNull();
    expect(localStorage.getItem('echat_channel_subscribers_private-channel')).toBeNull();
  });
});