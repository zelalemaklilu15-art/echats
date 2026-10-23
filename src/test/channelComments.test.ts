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
import { getChannelComments, getChannelMessages, sendChannelComment, syncChannelComments, syncChannelMessages } from '@/lib/channelService';

const comment = { id: 'c1', post_id: 'post', channel_id: 'channel', author_id: 'author-a', author_name: 'Zelalem', body: 'Nice post', created_at: '2026-10-23T09:00:00Z' };
const post = { created_at: '2026-10-22T09:00:00Z', id: 'post', channel_id: 'channel', sender_id: 'author-a', sender_name: 'Zelalem', content: 'Hello', comments_enabled: true, comments_count: 3 };

beforeEach(() => {
  localStorage.clear();
  mock.rpc.mockReset();
  mock.from.mockReset();
  mock.viewer = 'viewer-a';
  mock.authChanged?.('SIGNED_IN', { user: { id: mock.viewer } });
});

describe('channel post comments', () => {
  it('keeps comment author names in memory only and drops them when access changes', async () => {
    mock.rpc.mockResolvedValue({ data: [comment], error: null });
    await syncChannelComments('post');
    expect(getChannelComments('post')[0].authorName).toBe('Zelalem');
    expect(localStorage.getItem('echat_channel_comments_post')).toBeNull();
    window.dispatchEvent(new Event('echat:profile-access'));
    expect(getChannelComments('post')).toEqual([]);
  });

  it('discards a comment list that arrived after the account switched', async () => {
    let complete: ((value: { data: typeof comment[]; error: null }) => void) | undefined;
    mock.rpc.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const pending = syncChannelComments('post');
    await vi.waitFor(() => expect(mock.rpc).toHaveBeenCalledTimes(1));
    mock.viewer = 'viewer-b';
    mock.authChanged?.('SIGNED_IN', { user: { id: mock.viewer } });
    complete?.({ data: [comment], error: null });
    await pending;
    expect(getChannelComments('post')).toEqual([]);
  });

  it('records a comment under the signed-in account only', async () => {
    const insert = vi.fn(() => ({ select: async () => ({ data: [{ id: 'c1' }], error: null }) }));
    mock.from.mockImplementation(() => ({ insert }));
    mock.rpc.mockResolvedValue({ data: [], error: null });
    await sendChannelComment('channel', 'post', 'Hello there');
    expect(insert).toHaveBeenCalledWith({ post_id: 'post', channel_id: 'channel', author_id: 'viewer-a', text: 'Hello there' });
  });

  it('takes the comment counter and open state from the server row', async () => {
    mock.rpc.mockResolvedValue({ data: [post], error: null });
    await syncChannelMessages('channel');
    const [msg] = getChannelMessages('channel');
    expect(msg.commentsCount).toBe(3);
    expect(msg.commentsEnabled).toBe(true);
  });

  it('reads comment text and author from the server response', async () => {
    mock.rpc.mockResolvedValue({ data: [comment], error: null });
    await syncChannelComments('post');
    expect(getChannelComments('post')[0].text).toBe('Nice post');
    expect(getChannelComments('post')[0].authorName).toBe('Zelalem');
  });

});
