// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Pin, Trash2, CornerDownRight, X, SmilePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type EtokVideo, type EtokComment,
  fetchComments, addCommentAsync, deleteCommentAsync, formatCount,
} from "@/lib/etokService";

const QUICK_EMOJI = ["❤️", "🔥", "😂", "👏", "😍", "🎉", "💯", "🙌"];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(d / 365)}y`;
}

interface EtokCommentsProps {
  video: EtokVideo;
  currentUserId: string;
  onClose: () => void;
  onCommentAdded?: () => void;
  onCommentDeleted?: () => void;
}

export function EtokComments({ video, currentUserId, onClose, onCommentAdded, onCommentDeleted }: EtokCommentsProps) {
  const [comments, setComments] = useState<EtokComment[]>([]);
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<EtokComment | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const sendLock = useRef(false);
  const generation = useRef(0);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const loadComments = async () => {
    const started = generation.current;
    try { const data = await fetchComments(video.id); if (started === generation.current) setComments(data); }
    catch { if (started === generation.current) setError('Could not load comments. Please retry.'); }
    finally { if (started === generation.current) setLoading(false); }
  };
  useEffect(() => { setLoading(true); void loadComments(); return () => { generation.current += 1; }; }, [video.id]);
  const handleSend = async () => {
    const t = text.trim();
    if (!t || sendLock.current || !video.allowComments) return;
    sendLock.current = true; setSending(true); setError('');
    const started = generation.current;
    try {
      const comment = await addCommentAsync(video.id, currentUserId, t, replyingTo?.id);
      if (!comment) throw new Error('Not saved');
      if (started !== generation.current) return;
      setComments(prev => [comment, ...prev]); setText(''); setReplyingTo(null); setShowEmoji(false);
      onCommentAdded?.();
    } catch { if (started === generation.current) setError('Could not post comment. Your draft is still here.'); }
    finally { sendLock.current = false; if (started === generation.current) setSending(false); }
  };
  const handleDelete = async (commentId: string) => {
    try { await deleteCommentAsync(commentId); setComments(prev => prev.filter(c => c.id !== commentId && c.parentId !== commentId)); onCommentDeleted?.(); }
    catch { setError('Could not delete comment. Please retry.'); }
  };

  return createPortal(
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
      className="fixed inset-0 z-[60] flex min-h-0 flex-col justify-end"
      onClick={e => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-background/70" onClick={onClose} />

      <div className="relative max-h-[80dvh] min-h-0 bg-card rounded-t-2xl flex flex-col">
        <div className="w-10 h-1 bg-muted rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

        <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0">
          <div />
          <p className="text-foreground font-bold text-[15px]" data-testid="text-comment-count">
            {formatCount(comments.length)} {comments.length === 1 ? "comment" : "comments"}
          </p>
          <button onClick={onClose} data-testid="button-close-comments">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-5">
          {loading && (
            <div className="text-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-border border-t-primary animate-spin mx-auto" />
            </div>
          )}
          {!loading && comments.length === 0 && (
            <div className="text-center py-16">
              <p className="text-3xl mb-3">💬</p>
              <p className="text-foreground font-semibold text-[15px]">No comments yet</p>
              <p className="text-muted-foreground text-[13px] mt-1">Be the first to comment!</p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {comments.map(c => {
              const isOwn = c.authorId === currentUserId;
              const isVideoOwner = video.authorId === currentUserId;

              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={cn("flex gap-3", c.parentId && "ml-8 border-l border-border pl-3")}
                >
                  <div className="w-9 h-9 rounded-full bg-muted/60 flex items-center justify-center text-xl flex-shrink-0 overflow-hidden">
                    {c.author?.avatar ? (
                      <img src={c.author.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>👤</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-foreground font-semibold text-[13px]">{c.author?.displayName || "Hidden profile"}</span>
                      {c.isPinned && (
                        <span className="flex items-center gap-0.5 text-secondary text-[10px] font-semibold">
                          <Pin className="h-2.5 w-2.5" /> Pinned
                        </span>
                      )}
                    </div>
                    <p className="text-foreground/90 text-[13px] mt-0.5 leading-relaxed">{c.text}</p>
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="text-muted-foreground text-[11px]">{timeAgo(c.createdAt)}</span>
                      <button
                        onClick={() => {
                          setReplyingTo(c);
                          setText(`@${c.author?.username ?? ""} `);
                          inputRef.current?.focus();
                        }}
                        className="text-muted-foreground text-[11px] font-semibold active:text-foreground"
                      >
                        Reply
                      </button>
                      {(isOwn || isVideoOwner) && (
                        <Button variant="ghost" size="icon" aria-label="Delete comment" onClick={() => void handleDelete(c.id)}>
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </div>

                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {error && <div className="px-4 py-2 text-destructive" role="alert">{error}{comments.length === 0 && <Button variant="ghost" onClick={() => { setError(''); setLoading(true); void loadComments(); }}>Retry</Button>}</div>}
        <AnimatePresence>
          {showEmoji && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex gap-3 px-4 py-2 border-t border-border overflow-hidden flex-shrink-0"
            >
              {QUICK_EMOJI.map(e => (
                <button key={e} onClick={() => setText(t => t + e)} className="text-2xl active:scale-125 transition-transform">{e}</button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {replyingTo && (
          <div className="flex items-center justify-between px-4 py-1.5 bg-muted/30 border-t border-border flex-shrink-0">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[12px]">
              <CornerDownRight className="h-3 w-3" />
              Replying to @{replyingTo.author?.username ?? "user"}
            </div>
            <button onClick={() => { setReplyingTo(null); setText(""); }}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 px-4 py-3 border-t border-border pb-6 flex-shrink-0">
          <button onClick={() => setShowEmoji(!showEmoji)}>
            <SmilePlus className={cn("h-6 w-6 transition-colors", showEmoji ? "text-secondary" : "text-muted-foreground")} />
          </button>
          <div className="flex-1 bg-muted/60 rounded-full px-4 py-2.5 flex items-center gap-2">
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              disabled={!video.allowComments || sending}
              maxLength={2000}
              placeholder={video.allowComments ? "Add comment..." : "Comments are turned off"}
              className="flex-1 bg-transparent text-foreground text-[14px] outline-none placeholder:text-muted-foreground"
              data-testid="input-comment"
            />
            {text.trim() && (
              <Button variant="ghost" disabled={sending || !video.allowComments} onClick={handleSend} className="text-secondary font-bold text-[14px] flex-shrink-0" data-testid="button-post-comment">
                {sending ? "Posting…" : "Post"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>, document.body
  );
}
