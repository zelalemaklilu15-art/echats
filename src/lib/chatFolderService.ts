import { supabase } from '@/integrations/supabase/client';
import { publicOrigin } from '@/lib/native';

export interface FolderItem { kind: 'chat' | 'group' | 'channel'; id: string }
export interface ChatFolder { id: string; name: string; icon: string; color: string; items?: FolderItem[] }
export interface FolderCandidate extends FolderItem { name: string; shareable: boolean; joined?: boolean }
export interface FolderInvitePreview { name: string; icon: string; color: string; items: FolderCandidate[] }
export interface FolderInvite { token: string; created_at: string; revoked_at: string | null }
export const FOLDERS_SYNC_EVENT = 'echat:folders-sync';
let folders: ChatFolder[] = [];
let account: string | null = null;
let generation = 0;
let readVersion = 0;
const emit = () => window.dispatchEvent(new Event(FOLDERS_SYNC_EVENT));
supabase.auth.onAuthStateChange((_event, session) => {
  const next = session?.user.id ?? null;
  if (next === account) return;
  account = next; generation++; folders = []; emit();
});
async function owner() {
  const started = generation;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || started !== generation || (account && account !== user.id)) throw new Error('Account changed; please try again');
  account = user.id;
  return { id: user.id, generation };
}
async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const viewer = await owner();
  const { data, error } = await (supabase as any).rpc(name, args);
  if (viewer.generation !== generation || viewer.id !== account) throw new Error('Account changed; please try again');
  if (error) throw new Error(error.message);
  return data as T;
}
export async function syncChatFolders(): Promise<void> {
  const version = ++readVersion;
  const result = await rpc<ChatFolder[]>('get_chat_folder_state');
  if (version !== readVersion) return;
  folders = result ?? []; emit();
}
export function getChatFolders(): ChatFolder[] { return folders.map(f => ({ ...f, items: f.items?.map(i => ({ ...i })) })); }
export function getFolderChatIds(id: string): string[] { return folders.find(f => f.id === id)?.items?.map(i => i.id) ?? []; }
export function getChatFolderId(id: string): string | null { return folders.find(f => f.items?.some(i => i.id === id))?.id ?? null; }
export async function addChatFolder(folder: ChatFolder): Promise<void> {
  await rpc('save_chat_folder', { p_id: folder.id, p_name: folder.name, p_icon: folder.icon, p_color: folder.color, p_items: folder.items ?? [] });
  await syncChatFolders();
}
export async function updateChatFolder(id: string, updates: Partial<ChatFolder>): Promise<void> {
  const folder = folders.find(f => f.id === id);
  if (!folder) throw new Error('Folder unavailable');
  await addChatFolder({ ...folder, ...updates, id });
}
export async function removeChatFolder(id: string): Promise<void> { await rpc('delete_chat_folder', { p_id: id }); await syncChatFolders(); }
export async function addChatToFolder(id: string, chatId: string): Promise<void> {
  const folder = folders.find(f => f.id === id);
  if (!folder) throw new Error('Folder unavailable');
  if (!folder.items?.some(i => i.id === chatId)) await updateChatFolder(id, { items: [...(folder.items ?? []), { kind: 'chat', id: chatId }] });
}
export async function removeChatFromFolder(id: string, chatId: string): Promise<void> {
  await updateChatFolder(id, { items: folders.find(f => f.id === id)?.items?.filter(i => i.id !== chatId) ?? [] });
}
export const getFolderCandidates = () => rpc<FolderCandidate[]>('get_folder_candidates');
export const folderInviteUrl = (token: string) => `${publicOrigin()}/folder-invite/${encodeURIComponent(token)}`;
export const createFolderInvite = (id: string) => rpc<string>('create_chat_folder_invite', { p_folder_id: id });
export const previewFolderInvite = (token: string) => rpc<FolderInvitePreview>('preview_chat_folder_invite', { p_token: token });
export const revokeFolderInvite = (token: string) => rpc<void>('revoke_chat_folder_invite', { p_token: token });
export async function acceptFolderInvite(token: string, items: FolderItem[]): Promise<string> {
  const id = await rpc<string>('accept_chat_folder_invite', { p_token: token, p_items: items });
  await syncChatFolders(); return id;
}
export async function getFolderInvites(id: string): Promise<FolderInvite[]> {
  const viewer = await owner();
  const { data, error } = await supabase.from('chat_folder_invites').select('token,created_at,revoked_at').eq('folder_id', id).order('created_at', { ascending: false });
  if (viewer.generation !== generation) throw new Error('Account changed; please try again');
  if (error) throw new Error(error.message);
  return data ?? [];
}
