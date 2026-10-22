import { supabase } from '@/integrations/supabase/client';
import { PROFILE_ACCESS_EVENT } from '@/lib/profileAccess';
let friends = new Set<string>();
let generation = 0;
window.addEventListener(PROFILE_ACCESS_EVENT, () => { generation += 1; friends.clear(); });
export function getCloseFriends(): string[] { return [...friends]; }
export function isCloseFriend(id: string): boolean { return friends.has(id); }
export async function syncCloseFriends(): Promise<string[]> {
  const started = generation;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || started !== generation) return [];
  const { data, error } = await supabase.from('story_close_friends').select('contact_user_id').eq('owner_id', user.id);
  if (error) throw error;
  if (started !== generation) return [];
  friends = new Set((data ?? []).map(row => row.contact_user_id));
  return getCloseFriends();
}
export async function toggleCloseFriend(id: string): Promise<boolean> {
  const started = generation;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || started !== generation) throw new Error('Please sign in');
  const added = !friends.has(id);
  const query = added ? supabase.from('story_close_friends').upsert({ owner_id: user.id, contact_user_id: id }, { onConflict: 'owner_id,contact_user_id', ignoreDuplicates: true })
    : supabase.from('story_close_friends').delete().eq('owner_id', user.id).eq('contact_user_id', id);
  const { error } = await query;
  if (error) throw error;
  if (started !== generation) throw new Error('Account changed');
  if (added) friends.add(id); else friends.delete(id);
  return added;
}
