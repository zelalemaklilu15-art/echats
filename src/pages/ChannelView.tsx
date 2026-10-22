import { useState, useEffect, useRef } from "react";
import { useChannelSync } from "@/hooks/useChannelSync";
import { syncChannels, syncChannelMessages, recordChannelViews } from "@/lib/channelService";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, MoreVertical, Send, Eye, Megaphone, Users, Trash2,
  Pencil, Pin, PinOff, Bell, BellOff, Share2, Info, ChevronRight,
  Link as LinkIcon, Forward, MessageCircle, Clock, Calendar,
  Bookmark, Copy, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  getChannel, getChannelMessages, sendChannelMessage, deleteChannelMessage,
  deleteChannel, updateChannel, subscribeToChannel, unsubscribeFromChannel,
  isSubscribed, getSubscriberCount, addReaction, removeReaction,
  pinMessage, unpinMessage, type Channel, type ChannelMessage,
} from "@/lib/channelService";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const REACTIONS = ["👍", "❤️", "🔥", "🎉", "😮", "😢"];

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

// ─── Scheduled Post Storage (localStorage) ────────────────────────────────────

function getScheduledKey(channelId: string) { return `zch_scheduled_${channelId}`; }

interface ScheduledPost { id: string; content: string; scheduledAt: string; type: string; }

function getScheduledPosts(channelId: string): ScheduledPost[] {
  try { return JSON.parse(localStorage.getItem(getScheduledKey(channelId)) || "[]"); } catch { return []; }
}

function addScheduledPost(channelId: string, content: string, scheduledAt: string, type: string): ScheduledPost {
  const posts = getScheduledPosts(channelId);
  const p: ScheduledPost = { id: `sp_${Date.now()}`, content, scheduledAt, type };
  posts.push(p);
  localStorage.setItem(getScheduledKey(channelId), JSON.stringify(posts));
  return p;
}

function removeScheduledPost(channelId: string, id: string) {
  const posts = getScheduledPosts(channelId).filter(p => p.id !== id);
  localStorage.setItem(getScheduledKey(channelId), JSON.stringify(posts));
}

// ─── Reaction Bar ─────────────────────────────────────────────────────────────

interface ReactionBarProps {
  message: ChannelMessage;
  channelId: string;
  userId: string;
  onReacted: () => void;
}

const ReactionBar = ({ message, channelId, userId, onReacted }: ReactionBarProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const existingReactions = Object.entries(message.reactions || {}).filter(([, users]) => users.length > 0);

  const handleReact = async (emoji: string) => {
    try {
    const reacted = message.reactions?.[emoji]?.includes(userId);
    if (reacted) await removeReaction(channelId, message.id, emoji, userId);
    else await addReaction(channelId, message.id, emoji, userId);
    setShowPicker(false);
    onReacted();
    } catch { toast.error("Could not save reaction"); }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      {existingReactions.map(([emoji, users]) => (
        <button key={emoji} onClick={() => handleReact(emoji)}
          className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] border transition-all",
            users.includes(userId) ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/10 text-foreground hover:bg-white/10")}>
          {emoji} <span className="font-medium">{users.length}</span>
        </button>
      ))}
      <div className="relative">
        <button onClick={() => setShowPicker(p => !p)}
          className="w-7 h-7 rounded-full bg-white/5 border border-white/10 text-[14px] hover:bg-white/10 transition-all flex items-center justify-center">
          +
        </button>
        <AnimatePresence>
          {showPicker && (
            <motion.div initial={{ opacity: 0, scale: 0.8, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 4 }}
              className="absolute bottom-full left-0 mb-1 flex gap-1 p-1.5 rounded-2xl bg-card border border-border/60 shadow-xl z-50">
              {REACTIONS.map(emoji => (
                <button key={emoji} onClick={() => handleReact(emoji)} className="text-[20px] hover:scale-125 transition-transform">{emoji}</button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Post Context Menu ────────────────────────────────────────────────────────

interface PostContextMenuProps {
  message: ChannelMessage;
  channelId: string;
  isOwner: boolean;
  isPinned: boolean;
  onClose: () => void;
  onPin: () => void;
  onDelete: () => void;
  onForward: () => void;
  onSave: () => void;
}

const PostContextMenu = ({ message, isOwner, isPinned, onClose, onPin, onDelete, onForward, onSave }: PostContextMenuProps) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 400, damping: 40 }}
      className="relative bg-card rounded-t-3xl border-t border-border/50 pb-8"
      onClick={e => e.stopPropagation()}>
      <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-muted-foreground/30" /></div>
      <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-muted/40 border-l-4 border-primary/50">
        <p className="text-[12px] text-muted-foreground truncate">{message.content}</p>
      </div>
      <div className="grid grid-cols-4 gap-1 px-4 pb-2">
        {[
          { icon: Copy, label: "Copy", action: () => { navigator.clipboard.writeText(message.content); toast.success("Copied"); onClose(); } },
          { icon: Forward, label: "Forward", action: onForward },
          { icon: Bookmark, label: "Save", action: onSave },
          { icon: isPinned ? PinOff : Pin, label: isPinned ? "Unpin" : "Pin", action: onPin, show: isOwner },
          { icon: Trash2, label: "Delete", action: onDelete, show: isOwner, destructive: true },
        ].filter(a => a.show !== false).map(action => {
          const Icon = action.icon;
          return (
            <button key={action.label} onClick={action.action}
              className={cn("flex flex-col items-center gap-1.5 py-3 rounded-2xl",
                action.destructive ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-foreground")}>
              <Icon className="h-5 w-5" /><span className="text-[11px] font-medium">{action.label}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  </motion.div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const ChannelView = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { userId, user } = useAuth();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [subCount, setSubCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [contextMsg, setContextMsg] = useState<ChannelMessage | null>(null);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [showScheduled, setShowScheduled] = useState(false);
  const [postType, setPostType] = useState<"text" | "announcement">("text");
  const [busy, setBusy] = useState(false);
  const sendLock = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isOwner = channel?.createdBy === userId;
  const pinnedMsg = messages.find(m => m.id === channel?.pinnedMessageId);

  const reload = () => {
    if (!id) return;
    const ch = getChannel(id);
    if (!ch) {
      setChannel(null); setMessages([]);
      return;
    }
    setChannel(ch);
    setMessages(getChannelMessages(id));
    if (userId) setSubscribed(isSubscribed(id, userId));
    setSubCount(getSubscriberCount(id));
    setScheduledPosts(getScheduledPosts(id).filter(() => isOwner));
  };

  const syncVersion = useChannelSync(id);
  useEffect(() => { reload(); }, [id, userId, syncVersion]);
  useEffect(() => { if (id) recordChannelViews(id); }, [id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const handleSend = async (scheduleAt?: string) => {
    if (!newMessage.trim() || !id || !userId || sendLock.current) return;
    if (scheduleAt) { toast.error('Scheduled publishing is not available yet. Your draft has not been sent.'); return; }
    sendLock.current = true; setBusy(true);
    try { await sendChannelMessage(id,newMessage.trim(),userId,'',postType); setNewMessage(''); reload(); }
    catch { toast.error('Could not post. Your draft is still here.'); }
    finally { sendLock.current = false; setBusy(false); }
  };
  const handleSchedule = () => { toast.error('Scheduled publishing is not available yet.'); };
  const handleSubscribeToggle = async () => {
    if (!id || !userId || busy) return; setBusy(true);
    try { if (subscribed) await unsubscribeFromChannel(id,userId); else await subscribeToChannel(id,userId); reload(); }
    catch { toast.error('Could not change subscription. Please retry.'); }
    finally { setBusy(false); }
  };
  const handleDelete = async () => { if (!id) return; try { await deleteChannel(id); toast.success('Deleted'); navigate('/channels'); } catch { toast.error('Could not delete channel'); } };
  const handleDeleteMessage = async (msgId: string) => { if (!id) return; try { await deleteChannelMessage(id,msgId); reload(); } catch { toast.error('Could not delete post'); } };
  const handlePin = async (msgId: string) => { if (!id) return; try { if (channel?.pinnedMessageId === msgId) await unpinMessage(id); else await pinMessage(id,msgId); reload(); } catch { toast.error('Could not change pinned post'); } };
  const handleEditSave = async () => { if (!id || !editName.trim()) return; try { await updateChannel(id,{ name: editName.trim(),description: editDescription.trim() }); setEditDialogOpen(false); reload(); } catch { toast.error('Could not save changes'); } };

  if (!channel) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-8 gap-4">
        <Megaphone className="h-16 w-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">Channel not found</p>
        <Button onClick={() => navigate("/channels")}>Back to Channels</Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden" data-testid="page-channel-view">

      {/* ── Header ── */}
      <div className="flex-shrink-0 z-20">
        <div className="relative h-[130px] flex flex-col justify-end px-4 pb-3"
          style={{ background: `linear-gradient(160deg, ${channel.avatarColor}cc 0%, ${channel.avatarColor}55 50%, transparent 100%)` }}>
          <div className="absolute inset-0 bg-background/30 backdrop-blur-sm" />
          <div className="relative flex items-end gap-3">
            <Button variant="ghost" size="icon" className="absolute top-[-80px] left-0 text-white/90 hover:bg-white/10 z-10"
              onClick={() => navigate("/channels")} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-2xl shrink-0 shadow-lg cursor-pointer"
              style={{ backgroundColor: channel.avatarColor }} onClick={() => setInfoOpen(true)}>
              {channel.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 pb-0.5 cursor-pointer" onClick={() => setInfoOpen(true)}>
              <h2 className="font-bold text-[16px] text-white leading-tight truncate drop-shadow">{channel.name}</h2>
              <p className="text-[12px] text-white/80 flex items-center gap-1">
                <Users className="h-3 w-3" />
                {formatCount(subCount)} subscriber{subCount !== 1 ? "s" : ""}
                {channel.isPublic && <span className="ml-1 opacity-70">· Public</span>}
              </p>
            </div>
            <div className="flex items-center gap-1 pb-0.5">
              <Button variant="ghost" size="icon" className="text-white/80 hover:bg-white/10 h-9 w-9" onClick={() => setMuted(m => !m)}>
                {muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white/80 hover:bg-white/10 h-9 w-9" data-testid="button-channel-menu">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => setInfoOpen(true)}><Info className="h-4 w-4 mr-2" /> Channel Info</DropdownMenuItem>
                  {!isOwner && <DropdownMenuItem onClick={handleSubscribeToggle} data-testid="menu-subscribe-toggle">
                    <Megaphone className="h-4 w-4 mr-2" />{subscribed ? "Unsubscribe" : "Subscribe"}
                  </DropdownMenuItem>}
                  <DropdownMenuItem onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/channel/${encodeURIComponent(id ?? '')}`); toast.success("Link copied!"); } catch { toast.error("Could not copy link"); } }}>
                    <Share2 className="h-4 w-4 mr-2" /> Share Channel
                  </DropdownMenuItem>
                  {isOwner && scheduledPosts.length > 0 && (
                    <DropdownMenuItem onClick={() => setShowScheduled(true)}>
                      <Clock className="h-4 w-4 mr-2" /> Scheduled Posts ({scheduledPosts.length})
                    </DropdownMenuItem>
                  )}
                  {isOwner && <><DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setEditName(channel.name); setEditDescription(channel.description); setEditDialogOpen(true); }} data-testid="menu-edit-channel">
                      <Pencil className="h-4 w-4 mr-2" /> Edit Channel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive" data-testid="menu-delete-channel">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Channel
                    </DropdownMenuItem>
                  </>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Pinned */}
        <AnimatePresence>
          {pinnedMsg && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20 cursor-pointer"
                onClick={() => { document.getElementById(`msg-${pinnedMsg.id}`)?.scrollIntoView({ behavior: "smooth" }); }}>
                <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-primary">Pinned Post</p>
                  <p className="text-[12px] text-foreground truncate">{pinnedMsg.content}</p>
                </div>
                {isOwner && <button onClick={e => { e.stopPropagation(); handlePin(pinnedMsg.id); }} className="text-muted-foreground hover:text-foreground">
                  <PinOff className="h-3.5 w-3.5" />
                </button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scheduled posts bar */}
        {isOwner && scheduledPosts.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 cursor-pointer"
            onClick={() => setShowScheduled(true)}>
            <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <p className="text-[12px] text-amber-600 font-medium flex-1">
              {scheduledPosts.length} scheduled post{scheduledPosts.length !== 1 ? "s" : ""}
            </p>
            <ChevronRight className="h-3.5 w-3.5 text-amber-500" />
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground py-20">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${channel.avatarColor}30, ${channel.avatarColor}10)` }}>
              <Megaphone className="h-10 w-10" style={{ color: channel.avatarColor }} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground mb-1" data-testid="text-no-messages">No posts yet</p>
              {isOwner && <p className="text-[13px]">Broadcast your first message</p>}
            </div>
          </motion.div>
        )}

        {messages.map((msg, i) => (
          <motion.div key={msg.id} id={`msg-${msg.id}`}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
            className="rounded-2xl border border-border/50 bg-card overflow-hidden"
            onContextMenu={e => { e.preventDefault(); setContextMsg(msg); }}
            data-testid={`message-${msg.id}`}>

            {/* Post header */}
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-[13px] shrink-0"
                  style={{ backgroundColor: channel.avatarColor }}>
                  {channel.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{channel.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(msg.createdAt), "MMM d · h:mm a")}
                    {msg.edited && <span className="ml-1">· edited</span>}
                  </p>
                </div>
                {msg.type === "announcement" && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-md bg-primary/15 text-primary text-[10px] font-semibold">📢</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setContextMsg(msg)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Post body */}
            <div className="px-4 pb-2">
              <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>

            {/* Reactions + meta */}
            <div className="px-4 pb-3">
              <ReactionBar message={msg} channelId={id ?? ""} userId={userId ?? ""} onReacted={reload} />
              <div className="flex items-center gap-3 mt-2 text-muted-foreground">
                <div className="flex items-center gap-1"><Eye className="h-3 w-3" /><span className="text-[11px]">{formatCount(msg.views)}</span></div>
                <div className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /><span className="text-[11px]">0</span></div>
                <button onClick={() => { navigator.clipboard.writeText(msg.content); toast.success("Copied"); }}
                  className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto">
                  <Forward className="h-3.5 w-3.5" /><span className="text-[11px]">Forward</span>
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {messages.length >= 100 && <Button variant="ghost" onClick={() => { if (id) void syncChannelMessages(id,true).then(reload).catch(() => toast.error('Could not load older posts')); }}>Load older posts</Button>}
      {/* ── Subscribe button (non-owners) ── */}
      {!isOwner && (
        <div className="flex-shrink-0 px-4 pb-3 pt-1">
          <button onClick={handleSubscribeToggle}
            className={cn("w-full py-3.5 rounded-2xl font-bold text-[15px] transition-all",
              subscribed ? "bg-muted text-muted-foreground border border-border" : "text-white shadow-lg")}
            style={!subscribed ? { background: "var(--gradient-primary)" } : {}}
            data-testid="button-subscribe">
            {subscribed ? "✓ Subscribed" : "Subscribe to Channel"}
          </button>
        </div>
      )}

      {/* ── Owner broadcast input ── */}
      {isOwner && (
        <div className="flex-shrink-0 bg-card/80 backdrop-blur border-t border-border/50 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            {(["text", "announcement"] as const).map(t => (
              <button key={t} onClick={() => setPostType(t)}
                className={cn("px-3 py-1 rounded-full text-[11px] font-bold transition-all border",
                  postType === t ? "text-white border-transparent" : "bg-muted/50 text-muted-foreground border-border/50")}
                style={postType === t ? { background: "var(--gradient-primary)" } : {}}>
                {t === "text" ? "📝 Post" : "📢 Announcement"}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <Textarea
              placeholder="Write a message to your subscribers..."
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              className="resize-none rounded-2xl bg-muted/60 border-border/50 text-[14px] min-h-[44px] max-h-[120px] py-3 flex-1"
              rows={1}
              data-testid="input-channel-message"
            />
            <div className="flex flex-col gap-1.5 shrink-0">
              <Button size="icon" onClick={() => toast.info("Scheduled publishing is not available yet")} disabled
                variant="outline" className="rounded-xl h-9 w-9 border-border/60" data-testid="button-schedule">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button size="icon" onClick={() => handleSend()} disabled={!newMessage.trim() || busy}
                className="rounded-xl h-9 w-9 text-white"
                style={{ background: "var(--gradient-primary)" }} data-testid="button-send-message">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Channel Info Sheet ── */}
      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent side="right" className="w-[320px] p-0 overflow-y-auto">
          <SheetHeader className="sr-only"><SheetTitle>Channel Info</SheetTitle></SheetHeader>
          <div className="h-32 flex items-end px-5 pb-4 relative"
            style={{ background: `linear-gradient(160deg, ${channel.avatarColor}cc, ${channel.avatarColor}44)` }}>
            <div className="absolute inset-0 bg-background/20" />
            <div className="relative flex items-end gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg"
                style={{ backgroundColor: channel.avatarColor }}>{channel.name.charAt(0).toUpperCase()}</div>
              <div className="pb-1">
                <h3 className="font-bold text-[17px] text-white drop-shadow">{channel.name}</h3>
                <p className="text-[12px] text-white/80">{formatCount(subCount)} subscribers</p>
              </div>
            </div>
          </div>
          <div className="px-5 py-4 space-y-5">
            {channel.description && (
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">About</p>
                <p className="text-[14px] text-foreground leading-relaxed">{channel.description}</p>
              </div>
            )}
            <div className="bg-muted/40 rounded-2xl overflow-hidden divide-y divide-border/50">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center"><Users className="h-4 w-4 text-primary" /></div>
                <div><p className="text-[13px] font-semibold">{formatCount(subCount)} Subscribers</p><p className="text-[11px] text-muted-foreground">{channel.isPublic ? "Public" : "Private"} channel</p></div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center"><Megaphone className="h-4 w-4 text-blue-500" /></div>
                <div><p className="text-[13px] font-semibold">{messages.length} Posts</p><p className="text-[11px] text-muted-foreground">Total published</p></div>
              </div>
              {isOwner && scheduledPosts.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => { setInfoOpen(false); setShowScheduled(true); }}>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center"><Clock className="h-4 w-4 text-amber-500" /></div>
                  <div className="flex-1"><p className="text-[13px] font-semibold">{scheduledPosts.length} Scheduled</p><p className="text-[11px] text-muted-foreground">Upcoming posts</p></div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            {!isOwner && (
              <button onClick={() => { handleSubscribeToggle(); setInfoOpen(false); }}
                className={cn("w-full py-3.5 rounded-2xl font-bold text-[15px]",
                  subscribed ? "bg-muted text-muted-foreground border border-border" : "text-white")}
                style={!subscribed ? { background: "var(--gradient-primary)" } : {}}>
                {subscribed ? "Unsubscribe" : "Subscribe"}
              </button>
            )}
            {isOwner && (
              <button onClick={() => { setInfoOpen(false); setEditName(channel.name); setEditDescription(channel.description); setEditDialogOpen(true); }}
                className="w-full py-3 rounded-2xl font-semibold text-[14px] bg-muted text-foreground border border-border flex items-center justify-center gap-2">
                <Pencil className="h-4 w-4" /> Edit Channel
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Post Context Menu ── */}
      <AnimatePresence>
        {contextMsg && (
          <PostContextMenu
            message={contextMsg}
            channelId={id ?? ""}
            isOwner={isOwner}
            isPinned={channel.pinnedMessageId === contextMsg.id}
            onClose={() => setContextMsg(null)}
            onPin={() => { handlePin(contextMsg.id); setContextMsg(null); }}
            onDelete={() => { handleDeleteMessage(contextMsg.id); setContextMsg(null); }}
            onForward={() => { navigator.clipboard.writeText(contextMsg.content); toast.success("Copied for forwarding"); setContextMsg(null); }}
            onSave={() => { toast.info("Channel bookmarks are not available yet"); setContextMsg(null); }}
          />
        )}
      </AnimatePresence>

      {/* ── Schedule Post Dialog ── */}
      <Dialog open={scheduledOpen} onOpenChange={setScheduledOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> Schedule Post</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/30 rounded-xl p-3 border-l-4 border-primary/50">
              <p className="text-[13px] text-muted-foreground truncate">{newMessage}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[12px] text-muted-foreground mb-1.5 block">Date</Label>
                <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]} className="rounded-xl" />
              </div>
              <div>
                <Label className="text-[12px] text-muted-foreground mb-1.5 block">Time</Label>
                <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="rounded-xl" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduledOpen(false)}>Cancel</Button>
            <Button onClick={handleSchedule} disabled={!scheduleDate || !scheduleTime}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Scheduled Posts Manager ── */}
      <Dialog open={showScheduled} onOpenChange={setShowScheduled}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-amber-500" /> Scheduled Posts</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2 max-h-80 overflow-y-auto">
            {scheduledPosts.length === 0 ? (
              <p className="text-center text-muted-foreground text-[13px] py-4">No scheduled posts</p>
            ) : scheduledPosts.map(sp => (
              <div key={sp.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{sp.content}</p>
                  <p className="text-[11px] text-amber-500 mt-0.5">
                    📅 {format(new Date(sp.scheduledAt), "MMM d 'at' h:mm a")}
                  </p>
                </div>
                <button onClick={() => { if (id) { removeScheduledPost(id, sp.id); reload(); } }}
                  className="text-destructive p-1"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Channel ── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Channel</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} data-testid="input-edit-name" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} data-testid="input-edit-description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} data-testid="button-save-edit">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChannelView;
