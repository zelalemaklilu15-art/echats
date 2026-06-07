export interface LinkPreview {
  url: string;
  title: string;
  description?: string;
  image?: string;
  hostname: string;
}

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
const previewCache = new Map<string, LinkPreview | null>();

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches ? [...new Set(matches)] : [];
}

export function getHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

export function getFaviconUrl(hostname: string): string {
  return "";
}

export function truncateUrl(url: string, maxLength = 50): string {
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength) + "...";
}

function extractMeta(html: string, property: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property.replace("og:", "")}["'][^>]+content=["']([^"']+)["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim();
}

export async function getLinkPreview(url: string): Promise<LinkPreview | null> {
  if (previewCache.has(url)) return previewCache.get(url)!;

  const hostname = getHostname(url);
  const fallback: LinkPreview = { url, title: hostname, hostname };
  previewCache.set(url, fallback);
  return fallback;
}
