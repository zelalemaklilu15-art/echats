import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { getLinkPreview, getHostname, getFaviconUrl, type LinkPreview } from "@/lib/linkPreviewService";

interface LinkPreviewCardProps {
  url: string;
}

function Shimmer() {
  return (
    <div className="mt-1.5 p-2 rounded-xl border border-border/30 bg-background/10 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-sm bg-white/10 animate-shimmer" />
        <div className="h-3 w-24 rounded bg-white/10 animate-shimmer" />
      </div>
      <div className="h-2.5 w-full rounded bg-white/10 animate-shimmer" />
      <div className="h-2 w-3/4 rounded bg-white/10 animate-shimmer" />
    </div>
  );
}

export function LinkPreviewCard({ url }: LinkPreviewCardProps) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getLinkPreview(url).then((data) => {
      if (!cancelled) { setPreview(data); setLoading(false); }
    }).catch(() => {
      if (!cancelled) {
        setPreview({ url, title: getHostname(url), hostname: getHostname(url) });
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return <Shimmer />;
  if (!preview) return null;

  const hostname = preview.hostname;
  const faviconUrl = getFaviconUrl(hostname);
  const hasRichData = preview.image || preview.description;

  return (
    <AnimatePresence>
      <motion.a
        initial={{ opacity: 0, y: 6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="block mt-1.5 rounded-xl border border-border/30 bg-background/10 hover:bg-background/20 transition-colors overflow-hidden cursor-pointer no-underline"
        data-testid={`link-preview-${hostname}`}
      >
        {preview.image && (
          <motion.img
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            src={preview.image}
            alt=""
            className="w-full max-h-32 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            data-testid="link-preview-image"
          />
        )}
        <div className="p-2 space-y-0.5">
          <div className="flex items-center gap-1.5">
            {faviconUrl && <img src={faviconUrl} alt="" className="w-3.5 h-3.5 rounded-sm flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide truncate">{hostname}</span>
            <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/50 flex-shrink-0 ml-auto" />
          </div>
          {preview.title && preview.title !== hostname && (
            <p className="text-xs font-semibold leading-snug line-clamp-2" data-testid="link-preview-title">{preview.title}</p>
          )}
          {hasRichData && preview.description && (
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2" data-testid="link-preview-desc">{preview.description}</p>
          )}
        </div>
      </motion.a>
    </AnimatePresence>
  );
}
