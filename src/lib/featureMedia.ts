import { supabase } from '@/integrations/supabase/client';
import { PROFILE_ACCESS_EVENT } from '@/lib/profileAccess';

const objects = new Map<string, Promise<string | null>>();
const urls = new Set<string>();
let generation = 0;
window.addEventListener(PROFILE_ACCESS_EVENT, () => {
  generation += 1;
  objects.clear();
  urls.forEach(url => URL.revokeObjectURL(url));
  urls.clear();
});

export function mediaObjectPath(source: string, bucket: string): string | null {
  if (source.startsWith(`${bucket}/`)) return source.slice(bucket.length + 1);
  try {
    const url = new URL(source);
    if (url.origin !== new URL(import.meta.env.VITE_SUPABASE_URL).origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    return match?.[1] === bucket ? decodeURIComponent(match[2]) : null;
  } catch { return null; }
}

/** Managed media is fetched with the current session, not persisted bearer URLs. */
export async function resolveFeatureMedia(source: string | null | undefined, bucket: string): Promise<string | null> {
  if (!source) return null;
  const path = mediaObjectPath(source, bucket);
  if (!path) return source;
  const key = `${bucket}/${path}`;
  const existing = objects.get(key);
  if (existing) return existing;
  const started = generation;
  const pending = (async () => {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data || started !== generation) return null;
    const url = URL.createObjectURL(data);
    urls.add(url);
    return url;
  })();
  objects.set(key, pending);
  const result = await pending;
  if (!result && objects.get(key) === pending) objects.delete(key);
  return result;
}