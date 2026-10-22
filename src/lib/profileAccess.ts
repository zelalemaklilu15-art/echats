import { supabase } from '@/integrations/supabase/client';

export const HIDDEN_PROFILE_NAME = 'Hidden profile';
export const PROFILE_ACCESS_EVENT = 'echat:profile-access';

export interface AccessProfile {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_online: boolean;
  last_seen: string | null;
  is_active: boolean;
  profile_hidden: boolean;
}

export function hiddenProfile(id: string): AccessProfile {
  return { id, username: null, name: HIDDEN_PROFILE_NAME, avatar_url: null,
    bio: null, is_online: false, last_seen: null, is_active: false, profile_hidden: true };
}

/** Accept legacy URLs but always retrieve managed photos through authenticated storage. */
export function avatarObjectPath(source: string): string | null {
  if (source.startsWith('avatars/')) return source.slice('avatars/'.length);
  try {
    const url = new URL(source);
    const base = new URL(import.meta.env.VITE_SUPABASE_URL);
    if (url.origin !== base.origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/avatars\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}

const avatarObjects = new Set<string>();
let identityGeneration = 0;
supabase.auth.onAuthStateChange(event => {
  if (event === 'TOKEN_REFRESHED') return;
  identityGeneration += 1;
  avatarObjects.forEach(url => URL.revokeObjectURL(url));
  avatarObjects.clear();
  window.dispatchEvent(new Event(PROFILE_ACCESS_EVENT));
});

export async function resolveProfileAvatar(source: string | null | undefined): Promise<string | null> {
  if (!source) return null;
  const path = avatarObjectPath(source);
  if (!path) return source;
  const generation = identityGeneration;
  const { data, error } = await supabase.storage.from('avatars').download(path);
  if (error || !data || generation !== identityGeneration) return null;
  const url = URL.createObjectURL(data);
  avatarObjects.add(url);
  return url;
}

export async function getAccessProfiles(ids: string[]): Promise<AccessProfile[]> {
  const unique = [...new Set(ids)].slice(0, 200);
  if (!unique.length) return [];
  const generation = identityGeneration;
  const { data, error } = await supabase.rpc('get_profiles_safe', { p_ids: unique });
  if (error) throw error;
  if (generation !== identityGeneration) return unique.map(hiddenProfile);
  const rows = (Array.isArray(data) ? data : []) as unknown as AccessProfile[];
  const resolved = await Promise.all(rows.map(async row => ({ ...row,
    avatar_url: row.profile_hidden ? null : await resolveProfileAvatar(row.avatar_url),
  })));
  return generation === identityGeneration ? resolved : unique.map(hiddenProfile);
}

export async function getAccessProfile(id: string): Promise<AccessProfile | null> {
  return (await getAccessProfiles([id]))[0] ?? null;
}

export async function searchAccessProfiles(term: string): Promise<AccessProfile[]> {
  if (term.replace(/^@/, '').trim().length < 3) return [];
  const { data, error } = await supabase.rpc('search_users_public', { search_term: term });
  if (error) throw error;
  const profiles = await getAccessProfiles((data ?? []).map(row => row.id));
  const byId = new Map(profiles.map(p => [p.id, p]));
  return (data ?? []).map(row => ({ ...(byId.get(row.id) ?? hiddenProfile(row.id)), username: row.username }));
}

/** Saving a contact authorizes that person to see OUR identity, not theirs. */
export async function saveProfileContact(subjectId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in');
  const { error } = await supabase.from('profile_contacts')
    .upsert({ owner_id: user.id, contact_user_id: subjectId }, { onConflict: 'owner_id,contact_user_id', ignoreDuplicates: true });
  if (error) throw error;
  window.dispatchEvent(new Event(PROFILE_ACCESS_EVENT));
}

export async function removeProfileContact(subjectId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in');
  const { error } = await supabase.from('profile_contacts').delete()
    .eq('owner_id', user.id).eq('contact_user_id', subjectId);
  if (error) throw error;
  window.dispatchEvent(new Event(PROFILE_ACCESS_EVENT));
}