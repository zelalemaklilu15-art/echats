import { supabase } from '@/integrations/supabase/client';
import { PROFILE_ACCESS_EVENT } from '@/lib/profileAccess';

const objects = new Map<string, { pending: Promise<string | null>; expires: number; url?: string }>();
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

export function persistentMediaReference(source: string | null, bucket: string): string | null {
  if (!source || source.startsWith('blob:')) return null;
  const path = mediaObjectPath(source, bucket);
  return path ? `${bucket}/${path}` : source;
}

/** Managed media is fetched with the current session, not persisted bearer URLs. */
export async function resolveFeatureMedia(source: string | null | undefined, bucket: string, validUntil?: number): Promise<string | null> {
  if (!source) return null;
  if (validUntil !== undefined && validUntil <= Date.now()) return null;
  const path = mediaObjectPath(source, bucket);
  if (!path) return source;
  const key = `${bucket}/${path}`;
  const existing = objects.get(key);
  if (existing && existing.expires > Date.now()) return existing.pending;
  if (existing?.url) { URL.revokeObjectURL(existing.url); urls.delete(existing.url); }
  const started = generation;
  const pending = (async () => {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data || started !== generation || (validUntil !== undefined && validUntil <= Date.now())) return null;
    const url = URL.createObjectURL(data);
    urls.add(url);
    return url;
  })().catch(() => null);
  const entry = { pending, expires: Math.min(Date.now() + 30000, validUntil ?? Infinity), url: undefined as string | undefined };
  objects.set(key, entry);
  const result = await pending;
  if (result && objects.get(key) !== entry) {
    URL.revokeObjectURL(result); urls.delete(result);
    return null;
  }
  if (!result && objects.get(key) === entry) objects.delete(key);
  if (result && objects.get(key) === entry) {
    entry.url = result;
    if (validUntil && validUntil > Date.now()) window.setTimeout(() => {
      if (objects.get(key) !== entry) return;
      URL.revokeObjectURL(result); urls.delete(result); objects.delete(key);
    }, validUntil - Date.now());
  }
  return result;
}