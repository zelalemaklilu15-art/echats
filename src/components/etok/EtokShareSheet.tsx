import { useState } from "react";
import { X, Link, Download, QrCode, MessageCircle, Bookmark, BookmarkCheck } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { type EtokVideo, formatCount } from "@/lib/etokService";
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

  const link = `https://echat.app/etok/v/${video.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copied!");
  };

  const handleShare = (app: string) => {
    shareContent({ title: "Watch this on Etok!", url: link }).then((ok) => {
      if (!ok) toast.success(`Opening ${app}...`);
    });
  };

  const handleSave = () => {
    setSaved(!saved);
    toast.success(saved ? "Removed from favorites" : "Added to favorites");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col justify-end"
      onClick={e => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="relative bg-[#1a1a1a] rounded-t-2xl pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-4" />

        <div className="flex items-center gap-3 px-4 mb-5">
          <div className="w-10 h-14 rounded-lg bg-gradient-to-b from-purple-900 to-pink-900 flex items-center justify-center text-2xl flex-shrink-0">
            🎬
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-semibold line-clamp-2">{video.description.slice(0, 60)}...</p>
            <p className="text-white/50 text-[12px] mt-0.5">{formatCount(video.views)} views · {formatCount(video.likes)} likes</p>
          </div>
          <button onClick={handleSave}>
            {saved ? <BookmarkCheck className="h-6 w-6 text-yellow-400" /> : <Bookmark className="h-6 w-6 text-white/60" />}
          </button>
        </div>

        <div className="px-4 mb-5 grid grid-cols-4 gap-4">
          <button onClick={() => toast.success("Opening chat...")} className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-[#ff0050] flex items-center justify-center">
              <MessageCircle className="h-7 w-7 text-white" />
            </div>
            <span className="text-white/70 text-[11px]">Send</span>
          </button>
          <button onClick={handleCopy} className="flex flex-col items-center gap-2">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-colors", copied ? "bg-green-600" : "bg-white/10")}>
              <Link className="h-7 w-7 text-white" />
            </div>
            <span className="text-white/70 text-[11px]">{copied ? "Copied!" : "Copy"}</span>
          </button>
          <button onClick={() => toast.success("Saved!")} className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
              <Download className="h-7 w-7 text-white" />
            </div>
            <span className="text-white/70 text-[11px]">Save</span>
          </button>
          <button onClick={() => setShowQr(!showQr)} className="flex flex-col items-center gap-2">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-colors", showQr ? "bg-[#ff0050]" : "bg-white/10")}>
              <QrCode className="h-7 w-7 text-white" />
            </div>
            <span className="text-white/70 text-[11px]">QR Code</span>
          </button>
        </div>

        <div className="flex gap-4 px-4 overflow-x-auto pb-1">
          {APPS.map(a => (
            <button key={a.label} onClick={() => handleShare(a.label)} className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: a.bg }}>{a.emoji}</div>
              <span className="text-white/60 text-[11px]">{a.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
