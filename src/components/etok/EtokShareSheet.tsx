import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Link, Download, QrCode, MessageCircle, Bookmark, BookmarkCheck } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { type EtokVideo, formatCount, isVideoSaved, setVideoSaved, recordVideoInteractionAsync } from "@/lib/etokService";
import { shareContent } from "@/lib/native";

interface EtokShareSheetProps {
  video: EtokVideo;
  currentUserId?: string;
  onClose: () => void;
}

const APPS = [
  { emoji: "💬", label: "WhatsApp", bg: "#25d366" },
  { emoji: "✈️", label: "Telegram", bg: "#229ed9" },
  { emoji: "📸", label: "Instagram", bg: "#e1306c" },
  { emoji: "🐦", label: "X", bg: "#000000" },
  { emoji: "📘", label: "Facebook", bg: "#1877f2" },
  { emoji: "📧", label: "Email", bg: "#666" },
  { emoji: "💬", label: "SMS", bg: "#34c759" },
  { emoji: "🔗", label: "More", bg: "#333" },
];

export function EtokShareSheet({ video, currentUserId, onClose }: EtokShareSheetProps) {
  const [saved, setSaved] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = `${window.location.origin}/etok?video=${encodeURIComponent(video.id)}`;
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  const saveLock = useRef(false);
  useEffect(() => {
    const started = ++version.current;
    setSaved(false);
    if (currentUserId) void isVideoSaved(currentUserId, video.id)
      .then(value => { if (started === version.current) setSaved(value); })
      .catch(() => {});
    return () => { version.current += 1; };
  }, [currentUserId, video.id]);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); toast.success('Link copied'); void recordVideoInteractionAsync(video.id, 'share').catch(() => {}); }
    catch { toast.error('Could not copy link'); }
  };
  const handleShare = async () => {
    if (await shareContent({ title: 'Watch this on eTok', url: link })) void recordVideoInteractionAsync(video.id, 'share').catch(() => {});
  };
  const handleSave = async () => {
    if (!currentUserId || saveLock.current) return;
    const started = ++version.current;
    const next = !saved;
    saveLock.current = true; setBusy(true);
    try { await setVideoSaved(currentUserId, video.id, next); if (started === version.current) setSaved(next); }
    catch { toast.error('Could not save favorite'); }
    finally { saveLock.current = false; if (started === version.current) setBusy(false); }
  };
  const download = async () => {
    if (!video.allowDownload || !video.videoUrl) return;
    try {
      const response = await fetch(video.videoUrl); if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `etok-${video.id}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`; a.click(); URL.revokeObjectURL(url);
    } catch { toast.error('Could not download video'); }
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex min-h-0 flex-col justify-end"
      onClick={e => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-background/70" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="relative max-h-[85dvh] overflow-y-auto bg-card rounded-t-2xl pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-muted rounded-full mx-auto mt-3 mb-4" />

        <div className="flex items-center gap-3 px-4 mb-5">
          <div className="w-10 h-14 rounded-lg bg-gradient-to-b from-primary to-secondary flex items-center justify-center text-2xl flex-shrink-0">
            🎬
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-foreground text-[13px] font-semibold line-clamp-2">{video.description.slice(0, 60)}...</p>
            <p className="text-muted-foreground text-[12px] mt-0.5">{formatCount(video.views)} views · {formatCount(video.likes)} likes</p>
          </div>
          <Button variant="ghost" size="icon" disabled={busy} aria-label={saved ? "Remove favorite" : "Save favorite"} onClick={handleSave}>
            {saved ? <BookmarkCheck className="h-6 w-6 text-tertiary" /> : <Bookmark className="h-6 w-6 text-muted-foreground" />}
          </Button>
        </div>

        <div className="px-4 mb-5 grid grid-cols-4 gap-4">
          <button onClick={() => void handleShare()} className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
              <MessageCircle className="h-7 w-7 text-foreground" />
            </div>
            <span className="text-muted-foreground text-[11px]">Send</span>
          </button>
          <button onClick={handleCopy} className="flex flex-col items-center gap-2">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-colors", copied ? "bg-mint" : "bg-muted")}>
              <Link className="h-7 w-7 text-foreground" />
            </div>
            <span className="text-muted-foreground text-[11px]">{copied ? "Copied!" : "Copy"}</span>
          </button>
          <button disabled={!video.allowDownload} onClick={() => void download()} className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <Download className="h-7 w-7 text-foreground" />
            </div>
            <span className="text-muted-foreground text-[11px]">Save</span>
          </button>
          <button onClick={() => setShowQr(!showQr)} className="flex flex-col items-center gap-2">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-colors", showQr ? "bg-secondary" : "bg-muted")}>
              <QrCode className="h-7 w-7 text-foreground" />
            </div>
            <span className="text-muted-foreground text-[11px]">QR Code</span>
          </button>
        </div>

        {showQr && <div className="mx-auto mb-4 w-fit bg-card p-3"><QRCodeSVG value={link} size={160} /></div>}
        <div className="flex gap-4 px-4 overflow-x-auto pb-1">
          {APPS.map(a => (
            <button key={a.label} onClick={() => void handleShare()} className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: a.bg }}>{a.emoji}</div>
              <span className="text-muted-foreground text-[11px]">{a.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>, document.body
  );
}
