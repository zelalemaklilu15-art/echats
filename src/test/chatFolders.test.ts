import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ viewer: 'a', changed: undefined as undefined | ((event: string, session: { user: { id: string } } | null) => void), rpc: vi.fn() }));
vi.mock('@/lib/native', () => ({ publicOrigin: () => 'https://echats.lovable.app' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: mock.viewer } } }), onAuthStateChange: (cb: typeof mock.changed) => { mock.changed = cb; } }, rpc: mock.rpc } }));
import { getChatFolders, syncChatFolders, addChatFolder } from '@/lib/chatFolderService';
const folder = { id: 'folder', name: 'Mine', icon: 'folder', color: 'primary', items: [] };
beforeEach(() => { mock.viewer = 'a'; mock.changed?.('SIGNED_OUT', null); mock.changed?.('SIGNED_IN', { user: { id: 'a' } }); mock.rpc.mockReset(); localStorage.clear(); });
describe('account-scoped folders', () => {
  it('loads folders when the initial session arrives during the first user read', async () => {
    mock.changed?.('SIGNED_OUT', null);
    mock.rpc.mockResolvedValue({ data: [folder], error: null });
    const pending = syncChatFolders();
    mock.changed?.('INITIAL_SESSION', { user: { id: 'a' } });
    await pending; expect(getChatFolders()).toHaveLength(1);
  });
  it('clears folders immediately when the account changes', async () => { mock.rpc.mockResolvedValue({ data: [folder], error: null }); await syncChatFolders(); mock.viewer = 'b'; mock.changed?.('SIGNED_IN', { user: { id: 'b' } }); expect(getChatFolders()).toEqual([]); });
  it('rejects responses from a previous account', async () => {
    let complete: ((result: any) => void) | undefined;
    mock.rpc.mockImplementation(() => new Promise(resolve => { complete = resolve; })); const pending = syncChatFolders();
    await vi.waitFor(() => expect(mock.rpc).toHaveBeenCalledTimes(1)); mock.viewer = 'b'; mock.changed?.('SIGNED_IN', { user: { id: 'b' } }); complete?.({ data: [folder], error: null });
    await expect(pending).rejects.toThrow('Account changed'); expect(getChatFolders()).toEqual([]);
  });
  it('never adopts legacy unscoped folders into a signed-in account', async () => { localStorage.setItem('echat_chat_folders', JSON.stringify([folder])); mock.rpc.mockResolvedValue({ data: [], error: null }); await syncChatFolders(); expect(getChatFolders()).toEqual([]); expect(mock.rpc).toHaveBeenCalledTimes(1); });
  it('does not report a folder as saved when the server rejects it', async () => { mock.rpc.mockResolvedValue({ data: null, error: { message: 'Folder unavailable' } }); await expect(addChatFolder(folder)).rejects.toThrow('Folder unavailable'); expect(getChatFolders()).toEqual([]); });
});