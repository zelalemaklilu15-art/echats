// @ts-nocheck
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft, MoreVertical, Send, Loader2, Users, UserPlus, LogOut,
  Timer, Shield, Hash, Plus, Trash2, Volume2, VolumeX, Search,
  Reply, X, ChevronRight, Zap, Copy, Forward, Pencil, Pin, Bookmark,
  PinOff, RefreshCw, Link2, Ban, BarChart2, Clock,
  Smile, Paperclip, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatAvatar } from "@/components/ui/chat-avatar";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getGroup, getGroupMembers, getGroupMessages, sendGroupMessage,
  subscribeToGroupMessages, unsubscribeFromGroupMessages,
  isGroupAdmin, removeGroupMember,
  Group, GroupMember, GroupMessage,
} from "@/lib/groupService";
import { chatStore } from "@/lib/chatStore";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import {
  getSlowMode, setSlowMode as setSlowModeConfig, canSendMessage,
  recordMessageSent, SLOW_MODE_OPTIONS, getSlowModeLabel,
} from "@/lib/slowModeService";
import {
  getGroupPermissions, setGroupPermissions, isMemberMuted, muteMember,
  unmuteMember, type GroupPermissions,
} from "@/lib/adminService";
import {
  getTopics, createTopic, deleteTopic, getTopicMessages, addTopicMessage,
  TOPIC_COLORS, type Topic, type TopicMessage,
} from "@/lib/topicService";
import {
  toggleGroupReaction, getMessageReactions,
  getPinnedMessage, pinGroupMessage, unpinGroupMessage,
  getBannedMembers, banMember, unbanMember, isMemberBanned,
  getOrCreateInviteLink, revokeInviteLink,
  editGroupMessage, getEditedContent,
  saveMessageLocal, isMessageSavedLocal,
  addGroupPollRef, getGroupPollRefs,
  type GroupPinnedMessage,
} from "@/lib/groupExtService";
import { createPoll, getPoll, votePoll, getPollsForChat, type Poll } from "@/lib/pollService";
import { createVoiceRoom } from "@/lib/voiceChatService";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { GroupBoostPanel } from "@/components/GroupBoostPanel";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ─── Constants ─────────────────────────────────────────────────────────────────

const REACTIONS_PALETTE = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

const SENDER_COLORS = [
  "#e91e63", "#9c27b0", "#673ab7", "#3f51b5",
  "#2196f3", "#00bcd4", "#009688", "#4caf50",
  "#ff9800", "#ff5722",
];

function getSenderColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = userId.charCodeAt(i) + ((h << 5) - h);
  return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length];
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: "Admin", color: "#e91e63", bg: "rgba(233,30,99,0.12)" },
  moderator: { label: "Mod", color: "#2196f3", bg: "rgba(33,150,243,0.12)" },
  member: { label: "Member", color: "#9e9e9e", bg: "rgba(158,158,158,0.1)" },
};

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface ContextMenuState {
  message: GroupMessage;
  isOwn: boolean;
  isAdmin: boolean;
}

interface ContextMenuProps extends ContextMenuState {
  groupId: string;
  userId: string;
  isPinned: boolean;
  onClose: () => void;
  onReply: () => void;
  onEdit: () => void;
  onForward: () => void;
  onPin: () => void;
  onDelete: () => void;
  onSave: () => void;
  onReact: (emoji: string) => void;
}

const MessageContextMenu = ({
  message, isOwn, isAdmin, isPinned,
  onClose, onReply, onEdit, onForward, onPin, onDelete, onSave, onReact,
}: ContextMenuProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        className="relative bg-card rounded-t-3xl border-t border-border/50 pb-safe"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Emoji quick react */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
          {REACTIONS_PALETTE.map(emoji => (
            <button
              key={emoji}
              onClick={() => onReact(emoji)}
              className="text-[26px] hover:scale-125 transition-transform active:scale-110"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Message preview */}
        <div className="mx-4 my-2 px-3 py-2 rounded-xl bg-muted/40 border-l-4 border-primary/50">
          <p className="text-[12px] text-muted-foreground truncate">{message.content}</p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-4 gap-1 px-4 pb-2">
          {[
            { icon: Reply, label: "Reply", action: onReply, show: true },
            { icon: Copy, label: "Copy", action: () => { navigator.clipboard.writeText(message.content || ""); toast.success("Copied"); onClose(); }, show: true },
            { icon: Forward, label: "Forward", action: onForward, show: true },
            { icon: Bookmark, label: "Save", action: onSave, show: true },
            { icon: isOwn ? Pencil : null, label: "Edit", action: onEdit, show: isOwn },
            { icon: isPinned ? PinOff : Pin, label: isPinned ? "Unpin" : "Pin", action: onPin, show: isAdmin || isOwn },
            { icon: Trash2, label: "Delete", action: onDelete, show: isOwn || isAdmin, destructive: true },
          ]
            .filter(a => a.show && a.icon)
            .map((action) => {
              const Icon = action.icon!;
              return (
                <button
                  key={action.label}
                  onClick={action.action}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-colors",
                    action.destructive
                      ? "bg-destructive/10 hover:bg-destructive/20 text-destructive"
                      : "bg-muted/50 hover:bg-muted text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[11px] font-medium">{action.label}</span>
                </button>
              );
            })}
        </div>

        <div className="h-6" />
      </motion.div>
    </motion.div>
  );
};

// ─── Poll Card ────────────────────────────────────────────────────────────────

const PollCard = ({ poll, userId, onVote }: { poll: Poll; userId: string; onVote: (pollId: string, optionId: string) => void }) => {
  const totalVotes = poll.options.reduce((s, o) => s + o.votes.length, 0);
  const myVote = poll.options.find(o => o.votes.includes(userId));

  return (
    <div className="mx-3 my-1">
      <div className="bg-card border border-border/50 rounded-2xl px-4 py-3.5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <BarChart2 className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-foreground leading-tight">{poll.question}</p>
            <p className="text-[10px] text-muted-foreground">{poll.isAnonymous ? "Anonymous poll" : "Public poll"} · {totalVotes} vote{totalVotes !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="space-y-2">
          {poll.options.map(opt => {
            const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
            const voted = opt.votes.includes(userId);
            return (
              <button
                key={opt.id}
                onClick={() => !poll.closed && onVote(poll.id, opt.id)}
                disabled={poll.closed}
                className={cn(
                  "w-full relative rounded-xl px-3 py-2.5 text-left overflow-hidden border transition-all",
                  voted ? "border-primary/40" : "border-border/50 hover:border-border",
                )}
              >
                <div
                  className={cn("absolute inset-y-0 left-0 transition-all rounded-xl", voted ? "bg-primary/15" : "bg-muted/40")}
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between">
                  <span className="text-[13px] font-medium text-foreground">{opt.text}</span>
                  <div className="flex items-center gap-1.5">
                    {voted && <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center"><span className="text-[8px] text-white font-bold">✓</span></div>}
                    <span className="text-[12px] text-muted-foreground font-semibold">{pct}%</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {poll.closed && (
          <p className="text-center text-[11px] text-muted-foreground mt-2 font-medium">Poll closed</p>
        )}
      </div>
    </div>
  );
};

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
  message: GroupMessage;
  isOwn: boolean;
  senderName: string;
  showAvatar: boolean;
  reactions: Record<string, string[]>;
  editedContent: string | null;
  userId: string;
  groupId: string;
  onLongPress: (msg: GroupMessage) => void;
  onReact: (emoji: string) => void;
}

const GroupMessageBubble = ({
  message, isOwn, senderName, showAvatar, reactions, editedContent,
  userId, onLongPress, onReact,
}: BubbleProps) => {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const content = editedContent || message.content || "";
  const timestamp = format(new Date(message.created_at), 'h:mm a');
  const senderColor = getSenderColor(message.sender_id);

  const existingReactions = Object.entries(reactions).filter(([, users]) => users.length > 0);

  const handleTouchStart = () => {
    holdTimer.current = setTimeout(() => onLongPress(message), 500);
  };
  const clearHold = () => { if (holdTimer.current) clearTimeout(holdTimer.current); };

  return (
    <div
      className={cn("flex items-end gap-2 group px-3 py-0.5", isOwn ? "flex-row-reverse" : "flex-row")}
      onContextMenu={e => { e.preventDefault(); onLongPress(message); }}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearHold}
      onTouchMove={clearHold}
    >
      {!isOwn && (
        <div className="w-8 shrink-0 mb-1">
          {showAvatar && (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[12px] cursor-pointer"
              style={{ backgroundColor: senderColor }}
            >
              {senderName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div className={cn("max-w-[70%] flex flex-col", isOwn ? "items-end" : "items-start")}>
        {!isOwn && showAvatar && (
          <span className="text-[11px] font-semibold mb-0.5 px-1" style={{ color: senderColor }}>
            {senderName}
          </span>
        )}

        <div
          className={cn(
            "rounded-2xl px-3.5 py-2",
            isOwn ? "rounded-br-sm text-white" : "rounded-bl-sm bg-card border border-border/50 text-foreground"
          )}
          style={isOwn ? { background: "var(--gradient-primary)" } : {}}
          onMouseDown={() => {}}
        >
          {message.content?.match(/\[location:(-?\d+\.?\d*),(-?\d+\.?\d*)\]/) ? (
            (() => {
              const m = message.content.match(/\[location:(-?\d+\.?\d*),(-?\d+\.?\d*)\]/)!;
              return (
                <div>
                  <iframe src={`https://www.openstreetmap.org/export/embed.html?bbox=${+m[2]-0.005},${+m[1]-0.005},${+m[2]+0.005},${+m[1]+0.005}&layer=mapnik&marker=${m[1]},${m[2]}`}
                    width="220" height="110" className="border-0 block rounded-lg" title="Shared location" loading="lazy" />
                  <a href={`https://www.google.com/maps?q=${m[1]},${m[2]}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary mt-1 inline-block">Open in Maps</a>
                </div>
              );
            })()
          ) : (
            <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{content}</p>
          )}
          {editedContent && <span className={cn("text-[10px] ml-1", isOwn ? "text-white/60" : "text-muted-foreground")}>(edited)</span>}
          <span className={cn("text-[10px] float-right mt-0.5 ml-3", isOwn ? "text-white/70" : "text-muted-foreground")}>
            {timestamp}
          </span>
        </div>

        {/* Reactions */}
        {existingReactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1">
            {existingReactions.map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-all",
                  users.includes(userId)
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-muted/50 border-border/50 text-foreground hover:bg-muted"
                )}
              >
                {emoji} <span className="font-semibold">{users.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const GroupChat = () => {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [memberProfiles, setMemberProfiles] = useState<Map<string, any>>(new Map());
  const [slowModeInterval, setSlowModeInterval] = useState(0);
  const [slowModeCooldown, setSlowModeCooldown] = useState(0);
  const [permissions, setPermissions] = useState<GroupPermissions | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [topicMessages, setTopicMessages] = useState<TopicMessage[]>([]);
  const [newTopicMessage, setNewTopicMessage] = useState("");
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showTopicCreator, setShowTopicCreator] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicColor, setNewTopicColor] = useState("hsl(210, 90%, 60%)");
  const [infoOpen, setInfoOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<GroupMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<GroupMessage | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [forwardTarget, setForwardTarget] = useState<GroupMessage | null>(null);
  const [pinnedMsg, setPinnedMsg] = useState<GroupPinnedMessage | null>(null);
  const [reactionsMap, setReactionsMap] = useState<Record<string, Record<string, string[]>>>({});
  const [editsMap, setEditsMap] = useState<Record<string, { content: string; editedAt: string }>>({});
  const [memberSearch, setMemberSearch] = useState("");
  const [polls, setPolls] = useState<Poll[]>([]);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollAnonymous, setPollAnonymous] = useState(false);
  const [inviteLink, setInviteLink] = useState<string>("");
  const [bannedMembers, setBannedMembers] = useState<ReturnType<typeof getBannedMembers>>([]);

  const navigate = useNavigate();
  const { groupId } = useParams();
  const { userId } = useAuth();
  const virtuosoRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadExtData = useCallback(() => {
    if (!groupId) return;
    setPinnedMsg(getPinnedMessage(groupId));
    setReactionsMap(
      messages.reduce((acc, m) => {
        acc[m.id] = getMessageReactions(groupId, m.id);
        return acc;
      }, {} as Record<string, Record<string, string[]>>)
    );
    const { [groupId]: _, ...edits } = {} as any;
    const rawEdits = JSON.parse(localStorage.getItem(`zg_edits_${groupId}`) || "{}");
    setEditsMap(rawEdits);
    setBannedMembers(getBannedMembers(groupId));
    setPolls(getPollsForChat(groupId));
  }, [groupId, messages]);

  useEffect(() => { loadExtData(); }, [loadExtData]);

  useEffect(() => {
    if (!groupId) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const [gd, md, msgsData, adminStatus] = await Promise.all([
          getGroup(groupId),
          getGroupMembers(groupId),
          getGroupMessages(groupId),
          isGroupAdmin(groupId),
        ]);
        if (!gd) { toast.error('Group not found'); navigate('/chats'); return; }
        setGroup(gd);
        setMembers(md);
        setMessages(msgsData);
        setUserIsAdmin(adminStatus);
        const sm = getSlowMode(groupId);
        setSlowModeInterval(sm?.intervalSeconds || 0);
        setPermissions(getGroupPermissions(groupId));
        setTopics(getTopics(groupId));
        const profs = new Map();
        await Promise.all(md.map(async m => {
          const p = await chatStore.getProfile(m.user_id);
          if (p) profs.set(m.user_id, p);
        }));
        setMemberProfiles(profs);
        // invite link
        if (userId) {
          const link = getOrCreateInviteLink(groupId, userId);
          setInviteLink(`https://echat.chat/join/${link.code}`);
        }
      } catch (e) { console.error(e); toast.error('Failed to load group'); }
      finally { setLoading(false); }
    };
    loadData();
  }, [groupId, navigate, userId]);

  useEffect(() => {
    if (!groupId) return;
    const ch = subscribeToGroupMessages(groupId, (newMsg) => {
      setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
    });
    return () => unsubscribeFromGroupMessages(ch);
  }, [groupId]);

  useEffect(() => {
    if (messages.length > 0 && virtuosoRef.current) {
      setTimeout(() => { virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' }); }, 50);
    }
  }, [messages.length]);

  useEffect(() => {
    if (!groupId || !userId || slowModeInterval === 0) { setSlowModeCooldown(0); return; }
    const check = () => {
      const r = canSendMessage(groupId, userId);
      setSlowModeCooldown(r.allowed ? 0 : r.remainingSeconds);
    };
    check();
    const iv = setInterval(check, 1000);
    return () => clearInterval(iv);
  }, [groupId, userId, slowModeInterval, messages.length]);

  const handleSend = async () => {
    if (editingMessage) {
      if (!newMessage.trim() || !groupId) return;
      editGroupMessage(groupId, editingMessage.id, newMessage.trim());
      loadExtData();
      setEditingMessage(null);
      setNewMessage("");
      return;
    }
    if (!newMessage.trim() || !groupId) return;
    if (groupId && userId && slowModeInterval > 0) {
      const r = canSendMessage(groupId, userId);
      if (!r.allowed) { toast.error(`Wait ${r.remainingSeconds}s`); return; }
    }
    const content = newMessage.trim();
    setNewMessage("");
    setReplyingTo(null);
    setSending(true);
    try {
      const sent = await sendGroupMessage(groupId, content);
      if (!sent) toast.error('Failed to send');
      if (groupId && userId) recordMessageSent(groupId, userId);
    } catch { toast.error('Failed to send'); }
    finally { setSending(false); }
  };

  const handleContextAction = {
    react: (emoji: string) => {
      if (!contextMenu || !groupId || !userId) return;
      toggleGroupReaction(groupId, contextMenu.message.id, emoji, userId);
      loadExtData();
      setContextMenu(null);
    },
    reply: () => {
      if (!contextMenu) return;
      setReplyingTo(contextMenu.message);
      setContextMenu(null);
      inputRef.current?.focus();
    },
    edit: () => {
      if (!contextMenu) return;
      setEditingMessage(contextMenu.message);
      setNewMessage(editingMessage?.content || contextMenu.message.content || "");
      setContextMenu(null);
      inputRef.current?.focus();
    },
    forward: () => {
      if (!contextMenu) return;
      setForwardTarget(contextMenu.message);
      setContextMenu(null);
    },
    pin: () => {
      if (!contextMenu || !groupId || !userId) return;
      const isPinned = pinnedMsg?.messageId === contextMenu.message.id;
      if (isPinned) { unpinGroupMessage(groupId); }
      else { pinGroupMessage(groupId, contextMenu.message.id, contextMenu.message.content || "", userId); }
      loadExtData();
      setContextMenu(null);
      toast.success(isPinned ? "Unpinned" : "Message pinned");
    },
    delete: async () => {
      if (!contextMenu) return;
      setMessages(prev => prev.filter(m => m.id !== contextMenu.message.id));
      setContextMenu(null);
      toast.success("Message deleted");
    },
    save: () => {
      if (!contextMenu || !groupId) return;
      const senderName = getSenderName(contextMenu.message.sender_id);
      saveMessageLocal(groupId, contextMenu.message.id, contextMenu.message.content || "", senderName);
      setContextMenu(null);
      toast.success("Message saved to bookmarks");
    },
  };

  const handleVotePoll = (pollId: string, optionId: string) => {
    if (!userId) return;
    votePoll(pollId, optionId, userId);
    setPolls(getPollsForChat(groupId!));
  };

  const handleCreatePoll = () => {
    if (!groupId || !userId || !pollQuestion.trim()) return;
    const opts = pollOptions.filter(o => o.trim());
    if (opts.length < 2) { toast.error("Add at least 2 options"); return; }
    const poll = createPoll(groupId, pollQuestion.trim(), opts, userId, pollAnonymous);
    addGroupPollRef(groupId, poll.id, userId);
    setPolls(getPollsForChat(groupId));
    setPollQuestion(""); setPollOptions(["", ""]); setPollAnonymous(false);
    setShowPollCreator(false);
    toast.success("Poll created");
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!groupId) return;
    const ok = await removeGroupMember(groupId, memberId);
    if (ok) { setMembers(prev => prev.filter(m => m.user_id !== memberId)); toast.success('Removed'); }
    else toast.error('Failed');
  };

  const handleBanMember = (memberId: string) => {
    if (!groupId || !userId) return;
    banMember(groupId, memberId, userId);
    removeGroupMember(groupId, memberId);
    setMembers(prev => prev.filter(m => m.user_id !== memberId));
    setBannedMembers(getBannedMembers(groupId));
    toast.success("Member banned");
  };

  const handleLeaveGroup = async () => {
    if (!groupId || !userId) return;
    const ok = await removeGroupMember(groupId, userId);
    if (ok) { toast.success('Left group'); navigate('/chats'); }
    else toast.error('Failed');
  };

  const handleSetSlowMode = useCallback((seconds: number) => {
    if (!groupId) return;
    setSlowModeConfig(groupId, seconds);
    setSlowModeInterval(seconds);
    toast.success(seconds === 0 ? "Slow mode off" : `Slow mode: ${getSlowModeLabel(seconds)}`);
  }, [groupId]);

  const handleTogglePermission = useCallback((key: keyof GroupPermissions, value: boolean) => {
    if (!groupId) return;
    setGroupPermissions(groupId, { [key]: value });
    setPermissions(getGroupPermissions(groupId));
  }, [groupId]);

  const handleToggleMute = useCallback(async (memberId: string) => {
    if (!groupId) return;
    try {
      if (isMemberMuted(groupId, memberId)) { await unmuteMember(groupId, memberId); toast.success("Unmuted"); }
      else { await muteMember(groupId, memberId); toast.success("Muted"); }
    } catch (e: any) {
      toast.error(e?.message || "Only admins can mute members");
    }
  }, [groupId]);

  const handleCreateTopic = useCallback(() => {
    if (!groupId || !userId || !newTopicTitle.trim()) return;
    createTopic(groupId, newTopicTitle.trim(), "Hash", newTopicColor, userId);
    setTopics(getTopics(groupId));
    setNewTopicTitle(""); setShowTopicCreator(false);
    toast.success("Topic created");
  }, [groupId, userId, newTopicTitle, newTopicColor]);

  const handleSendTopicMessage = useCallback(() => {
    if (!selectedTopic || !groupId || !userId || !newTopicMessage.trim()) return;
    addTopicMessage(selectedTopic.id, groupId, userId, newTopicMessage.trim());
    setTopicMessages(getTopicMessages(selectedTopic.id));
    setNewTopicMessage("");
    if (groupId) setTopics(getTopics(groupId));
  }, [selectedTopic, groupId, userId, newTopicMessage]);

  const getSenderName = (sid: string) => {
    const p = memberProfiles.get(sid);
    return p?.name || p?.username || "User";
  };

  const shouldShowAvatar = (idx: number) =>
    idx === messages.length - 1 || messages[idx + 1]?.sender_id !== messages[idx].sender_id;

  // Combined feed: messages + polls sorted by time
  const feedItems = useMemo(() => {
    const items: Array<{ type: 'message'; data: GroupMessage; key: string } | { type: 'poll'; data: Poll; key: string }> = [];
    messages.forEach(m => items.push({ type: 'message', data: m, key: m.id }));
    const pollRefs = getGroupPollRefs(groupId || "");
    pollRefs.forEach(ref => {
      const poll = polls.find(p => p.id === ref.pollId);
      if (poll) items.push({ type: 'poll', data: poll, key: `poll_${poll.id}` });
    });
    items.sort((a, b) => {
      const ta = a.type === 'message' ? a.data.created_at : (a.data as Poll).createdAt;
      const tb = b.type === 'message' ? b.data.created_at : (b.data as Poll).createdAt;
      return new Date(ta).getTime() - new Date(tb).getTime();
    });
    return items;
  }, [messages, polls, groupId]);

  const filteredMembers = members.filter(m => {
    if (!memberSearch.trim()) return true;
    const p = memberProfiles.get(m.user_id);
    const name = (p?.name || p?.username || "").toLowerCase();
    return name.includes(memberSearch.toLowerCase());
  });

  const groupColor = getSenderColor(group?.id || "");

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading group...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-8 gap-4">
        <Users className="h-16 w-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">Group not found</p>
        <Button onClick={() => navigate('/chats')}>Back to Chats</Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 bg-card/90 backdrop-blur border-b border-border/50 z-10">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Button variant="ghost" size="icon" onClick={() => navigate("/chats")} className="h-9 w-9 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <button className="flex items-center gap-2.5 flex-1 min-w-0" onClick={() => setInfoOpen(true)}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[16px] shrink-0"
              style={{ backgroundColor: groupColor }}>
              {group.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-[15px] text-foreground truncate">{group.name}</h2>
              <p className="text-[12px] text-muted-foreground">{members.length} member{members.length !== 1 ? 's' : ''}</p>
            </div>
          </button>
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                  <MoreVertical className="h-4.5 w-4.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setInfoOpen(true)}>
                  <Users className="h-4 w-4 mr-2" /> Group Info
                </DropdownMenuItem>
                {userIsAdmin && <DropdownMenuItem onClick={() => navigate(`/group/${groupId}/add-members`)}>
                  <UserPlus className="h-4 w-4 mr-2" /> Add Members
                </DropdownMenuItem>}
                {userIsAdmin && <DropdownMenuItem onClick={() => setShowAdminPanel(true)} data-testid="menu-admin-panel">
                  <Shield className="h-4 w-4 mr-2" /> Admin Panel
                </DropdownMenuItem>}
                <DropdownMenuItem onClick={() => setShowPollCreator(true)}>
                  <BarChart2 className="h-4 w-4 mr-2" /> Create Poll
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  if (groupId && userId) {
                    const link = getOrCreateInviteLink(groupId, userId);
                    const url = `https://echat.chat/join/${link.code}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Invite link copied!");
                  }
                }}>
                  <Link2 className="h-4 w-4 mr-2" /> Copy Invite Link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  const room = createVoiceRoom(groupId!, groupData?.name || "Group", `${groupData?.name || "Group"} Voice`, userId!, "");
                  if (room) navigate(`/voice-chat/${room.id}`);
                  else toast.error("Couldn't start voice channel");
                }} data-testid="menu-voice-channel">
                  <Volume2 className="h-4 w-4 mr-2" /> Voice Channel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLeaveGroup} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Leave Group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Slow mode bar */}
        {slowModeInterval > 0 && (
          <div className="flex items-center justify-center gap-1.5 px-4 py-1 bg-amber-500/10 border-t border-amber-500/20">
            <Timer className="h-3 w-3 text-amber-500" />
            <span className="text-[11px] text-amber-500 font-medium">
              Slow mode · {getSlowModeLabel(slowModeInterval)}
              {slowModeCooldown > 0 && <span className="ml-1 text-foreground font-bold">{slowModeCooldown}s</span>}
            </span>
          </div>
        )}

        {/* Pinned message */}
        <AnimatePresence>
          {pinnedMsg && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-primary/15">
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/8 cursor-pointer" onClick={() => {
                const idx = messages.findIndex(m => m.id === pinnedMsg.messageId);
                if (idx !== -1 && virtuosoRef.current) virtuosoRef.current.scrollToIndex({ index: idx, behavior: 'smooth' });
              }}>
                <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-primary">Pinned Message</p>
                  <p className="text-[12px] text-foreground truncate">{pinnedMsg.content}</p>
                </div>
                {userIsAdmin && (
                  <button onClick={e => { e.stopPropagation(); if (groupId) { unpinGroupMessage(groupId); loadExtData(); } }}
                    className="text-muted-foreground hover:text-foreground p-1">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Topics bar */}
        {topics.length > 0 && (
          <div className="border-t border-border/40 py-2 px-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setSelectedTopic(null)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap border shrink-0",
                  !selectedTopic ? "text-white border-transparent" : "bg-muted/50 text-muted-foreground border-border/50")}
                style={!selectedTopic ? { background: "var(--gradient-primary)" } : {}}
              >
                # General
              </button>
              {topics.map(topic => (
                <button key={topic.id}
                  onClick={() => { setSelectedTopic(topic); setTopicMessages(getTopicMessages(topic.id)); }}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap border shrink-0",
                    selectedTopic?.id === topic.id ? "text-white border-transparent" : "bg-muted/50 text-muted-foreground border-border/50")}
                  style={selectedTopic?.id === topic.id ? { backgroundColor: topic.color } : {}}
                  data-testid={`button-topic-${topic.id}`}
                >
                  <span style={{ color: selectedTopic?.id === topic.id ? "white" : topic.color }}>#</span>
                  {topic.title}
                  <span className={cn("text-[10px]", selectedTopic?.id === topic.id ? "text-white/70" : "text-muted-foreground")}>{topic.messageCount}</span>
                </button>
              ))}
              {userIsAdmin && (
                <button onClick={() => setShowTopicCreator(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] text-muted-foreground border border-dashed border-border/70 hover:border-primary/50 hover:text-primary shrink-0"
                  data-testid="button-add-topic">
                  <Plus className="h-3 w-3" /> Topic
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {selectedTopic ? (
          topicMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Hash className="h-12 w-12 opacity-20" style={{ color: selectedTopic.color }} />
              <p className="text-sm font-semibold">#{selectedTopic.title}</p>
              <p className="text-xs opacity-70">No messages yet</p>
            </div>
          ) : (
            <div className="h-full overflow-y-auto px-3 py-3 space-y-2">
              {topicMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.senderId === userId ? "justify-end" : "justify-start"}`}>
                  <div className={cn("max-w-[70%] rounded-2xl px-3.5 py-2",
                    msg.senderId === userId ? "rounded-br-sm text-white" : "rounded-bl-sm bg-card border border-border/50")}
                    style={msg.senderId === userId ? { background: "var(--gradient-primary)" } : {}}>
                    {msg.senderId !== userId && (
                      <p className="text-[11px] font-semibold mb-0.5" style={{ color: selectedTopic.color }}>{getSenderName(msg.senderId)}</p>
                    )}
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className={cn("text-[10px] text-right mt-0.5", msg.senderId === userId ? "text-white/70" : "text-muted-foreground")}>
                      {format(new Date(msg.createdAt), 'h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : feedItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: `${groupColor}20` }}>
              <Users className="h-10 w-10 opacity-50" style={{ color: groupColor }} />
            </div>
            <p className="text-sm font-semibold text-foreground">No messages yet</p>
            <p className="text-xs">Say hello! 👋</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto py-2" ref={el => {
            if (el) { el.scrollTop = el.scrollHeight; }
          }}>
            {feedItems.map((item, idx) =>
              item.type === 'poll' ? (
                <PollCard key={item.key} poll={item.data as Poll} userId={userId!} onVote={handleVotePoll} />
              ) : (
                <GroupMessageBubble
                  key={item.key}
                  message={item.data as GroupMessage}
                  isOwn={(item.data as GroupMessage).sender_id === userId}
                  senderName={getSenderName((item.data as GroupMessage).sender_id)}
                  showAvatar={idx === feedItems.length - 1 || feedItems[idx + 1]?.type === 'poll' || (feedItems[idx + 1]?.type === 'message' && (feedItems[idx + 1].data as GroupMessage).sender_id !== (item.data as GroupMessage).sender_id)}
                  reactions={reactionsMap[(item.data as GroupMessage).id] || {}}
                  editedContent={editsMap[(item.data as GroupMessage).id]?.content || null}
                  userId={userId!}
                  groupId={groupId!}
                  onLongPress={(msg) => setContextMenu({ message: msg, isOwn: msg.sender_id === userId, isAdmin: userIsAdmin })}
                  onReact={(emoji) => {
                    if (!groupId || !userId) return;
                    toggleGroupReaction(groupId, (item.data as GroupMessage).id, emoji, userId);
                    loadExtData();
                  }}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-card/80 backdrop-blur border-t border-border/50">
        <AnimatePresence>
          {(replyingTo || editingMessage) && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20">
                {editingMessage ? <Pencil className="h-4 w-4 text-primary shrink-0" /> : <Reply className="h-4 w-4 text-primary shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-primary">
                    {editingMessage ? "Edit message" : `Replying to ${getSenderName(replyingTo!.sender_id)}`}
                  </p>
                  <p className="text-[12px] text-muted-foreground truncate">{editingMessage?.content || replyingTo?.content}</p>
                </div>
                <button onClick={() => { setReplyingTo(null); setEditingMessage(null); setNewMessage(""); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground shrink-0" onClick={() => setShowPollCreator(true)}>
            <BarChart2 className="h-4.5 w-4.5" />
          </Button>
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              placeholder={selectedTopic ? `# ${selectedTopic.title}...` : editingMessage ? "Edit message..." : "Message..."}
              value={selectedTopic ? newTopicMessage : newMessage}
              onChange={e => selectedTopic ? setNewTopicMessage(e.target.value) : setNewMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); selectedTopic ? handleSendTopicMessage() : handleSend(); }
                if (e.key === "Escape") { setReplyingTo(null); setEditingMessage(null); setNewMessage(""); }
              }}
              className="rounded-full bg-muted/60 border-border/50 pr-10 text-[14px] h-10"
              disabled={sending || (slowModeCooldown > 0 && !selectedTopic && !editingMessage)}
              data-testid="input-group-message"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Smile className="h-4 w-4" />
            </button>
          </div>
          <motion.div whileTap={{ scale: 0.88, rotate: 18 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
            <Button size="icon"
              onClick={selectedTopic ? handleSendTopicMessage : handleSend}
              disabled={selectedTopic ? !newTopicMessage.trim() : (!newMessage.trim() || sending || (slowModeCooldown > 0 && !editingMessage))}
              className="rounded-full h-10 w-10 text-white shrink-0"
              style={{ background: "var(--gradient-primary)" }}
              data-testid="button-send-group-message">
              {sending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4.5 w-4.5" />}
            </Button>
          </motion.div>
        </div>
      </div>

      {/* ── Context Menu ── */}
      <AnimatePresence>
        {contextMenu && (
          <MessageContextMenu
            {...contextMenu}
            groupId={groupId!}
            userId={userId!}
            isPinned={pinnedMsg?.messageId === contextMenu.message.id}
            onClose={() => setContextMenu(null)}
            onReply={handleContextAction.reply}
            onEdit={handleContextAction.edit}
            onForward={handleContextAction.forward}
            onPin={handleContextAction.pin}
            onDelete={handleContextAction.delete}
            onSave={handleContextAction.save}
            onReact={handleContextAction.react}
          />
        )}
      </AnimatePresence>

      {/* ── Group Info Sheet ── */}
      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent side="right" className="w-[320px] p-0 overflow-y-auto">
          <SheetHeader className="sr-only"><SheetTitle>Group Info</SheetTitle></SheetHeader>
          <div className="h-36 flex flex-col justify-end px-5 pb-4 relative"
            style={{ background: `linear-gradient(160deg, ${groupColor}cc, ${groupColor}44)` }}>
            <div className="absolute inset-0 bg-background/20" />
            <div className="absolute top-3 right-3 z-10">
              <button onClick={() => setInfoOpen(false)} className="text-white/80 p-1 rounded-lg hover:bg-white/10"><X className="h-4.5 w-4.5" /></button>
            </div>
            <div className="relative flex items-end gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-3xl shadow-xl"
                style={{ backgroundColor: groupColor }}>{group.name.charAt(0).toUpperCase()}</div>
              <div className="pb-1">
                <h3 className="font-bold text-[18px] text-white drop-shadow">{group.name}</h3>
                <p className="text-[12px] text-white/80">{members.length} members</p>
              </div>
            </div>
          </div>

          {group.description && (
            <div className="px-5 py-3.5 border-b border-border/50">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">About</p>
              <p className="text-[14px] text-foreground leading-relaxed">{group.description}</p>
            </div>
          )}

          {/* Invite link */}
          {inviteLink && (
            <div className="px-5 py-3.5 border-b border-border/50">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Invite Link</p>
              <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
                <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="flex-1 text-[12px] text-primary truncate font-mono">{inviteLink}</p>
                <button onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success("Copied!"); }}
                  className="text-primary hover:text-primary/80 p-1"><Copy className="h-3.5 w-3.5" /></button>
                {userIsAdmin && (
                  <button onClick={() => {
                    if (groupId && userId) {
                      const link = revokeInviteLink(groupId, userId);
                      setInviteLink(`https://echat.chat/join/${link.code}`);
                      toast.success("Link revoked");
                    }
                  }} className="text-muted-foreground hover:text-foreground p-1"><RefreshCw className="h-3.5 w-3.5" /></button>
                )}
              </div>
            </div>
          )}

          {/* Members */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Members · {members.length}</p>
              {userIsAdmin && (
                <button onClick={() => { setInfoOpen(false); navigate(`/group/${groupId}/add-members`); }}
                  className="text-[12px] text-primary font-semibold flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                placeholder="Search members…"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="w-full bg-muted/50 rounded-xl pl-9 pr-3 py-2 text-[13px] outline-none border border-border/50 focus:border-primary/50"
              />
            </div>
          </div>
          <div className="divide-y divide-border/30">
            {filteredMembers.map(member => {
              const p = memberProfiles.get(member.user_id);
              const name = p?.name || p?.username || "User";
              const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;
              const color = getSenderColor(member.user_id);
              const banned = groupId ? isMemberBanned(groupId, member.user_id) : false;
              return (
                <div key={member.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[14px] shrink-0"
                    style={{ backgroundColor: color }}>{name.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold text-foreground truncate">{name}</p>
                      {member.user_id === userId && <span className="text-[10px] text-muted-foreground">(you)</span>}
                      {banned && <span className="text-[10px] text-destructive font-semibold">Banned</span>}
                    </div>
                    {p?.username && <p className="text-[12px] text-muted-foreground">@{p.username}</p>}
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ color: roleConfig.color, backgroundColor: roleConfig.bg }}>{roleConfig.label}</span>
                  {userIsAdmin && member.user_id !== userId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground p-1"><MoreVertical className="h-4 w-4" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleRemoveMember(member.user_id)}>
                          <X className="h-4 w-4 mr-2" /> Remove
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBanMember(member.user_id)} className="text-destructive">
                          <Ban className="h-4 w-4 mr-2" /> Ban
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>

          {/* Boost panel */}
          {groupId && (
            <div className="px-5 py-4 border-t border-border/50">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" /> Group Boosts
              </p>
              <GroupBoostPanel groupId={groupId} />
            </div>
          )}

          {/* Actions */}
          <div className="px-5 py-4 space-y-2 border-t border-border/50">
            {userIsAdmin && (
              <button onClick={() => { setInfoOpen(false); setShowAdminPanel(true); }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex items-center gap-2.5"><Shield className="h-4.5 w-4.5 text-primary" /><span className="text-[14px] font-semibold">Admin Panel</span></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <button onClick={handleLeaveGroup}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/15 transition-colors">
              <LogOut className="h-4.5 w-4.5" /><span className="text-[14px] font-semibold">Leave Group</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Admin Panel ── */}
      <Dialog open={showAdminPanel} onOpenChange={setShowAdminPanel}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto" data-testid="dialog-admin-panel">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Admin Panel</DialogTitle>
            <DialogDescription>Manage group settings</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Slow Mode</p>
              <div className="flex flex-wrap gap-1.5">
                {SLOW_MODE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => handleSetSlowMode(opt.value)}
                    className={cn("text-[12px] px-3 py-1.5 rounded-full font-medium border transition-all",
                      slowModeInterval === opt.value ? "text-white border-transparent" : "bg-muted/50 text-muted-foreground border-border")}
                    style={slowModeInterval === opt.value ? { background: "var(--gradient-primary)" } : {}}
                    data-testid={`button-slowmode-${opt.value}`}>{opt.label}</button>
                ))}
              </div>
            </div>
            {permissions && (
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Permissions</p>
                <div className="space-y-3 bg-muted/30 rounded-2xl p-3">
                  {([
                    { key: "canSendMessages" as const, label: "Send messages" },
                    { key: "canSendMedia" as const, label: "Send media" },
                    { key: "canAddMembers" as const, label: "Add members" },
                    { key: "canPinMessages" as const, label: "Pin messages" },
                    { key: "canChangeInfo" as const, label: "Change group info" },
                  ]).map(perm => (
                    <div key={perm.key} className="flex items-center justify-between">
                      <Label className="text-[13px]">{perm.label}</Label>
                      <Switch checked={permissions[perm.key] as boolean} onCheckedChange={v => handleTogglePermission(perm.key, v)} data-testid={`switch-perm-${perm.key}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Manage Members</p>
              <div className="space-y-1">
                {members.filter(m => m.user_id !== userId).map(member => {
                  const p = memberProfiles.get(member.user_id);
                  const name = p?.name || p?.username || "User";
                  const muted = groupId ? isMemberMuted(groupId, member.user_id) : false;
                  const banned = groupId ? isMemberBanned(groupId, member.user_id) : false;
                  return (
                    <div key={member.id} className="flex items-center justify-between py-2 px-2 rounded-xl hover:bg-muted/30">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[12px]"
                          style={{ backgroundColor: getSenderColor(member.user_id) }}>{name.charAt(0).toUpperCase()}</div>
                        <span className="text-[13px] font-medium">{name}</span>
                        {banned && <Badge variant="destructive" className="text-[10px] py-0">Banned</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleToggleMute(member.user_id)}
                          className={cn("h-7 gap-1 text-[11px]", muted ? "text-amber-500" : "text-muted-foreground")}
                          data-testid={`button-mute-member-${member.user_id}`}>
                          {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                        </Button>
                        {!banned ? (
                          <Button variant="ghost" size="sm" onClick={() => handleBanMember(member.user_id)}
                            className="h-7 gap-1 text-[11px] text-destructive">
                            <Ban className="h-3 w-3" /> Ban
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => {
                            if (groupId) { unbanMember(groupId, member.user_id); setBannedMembers(getBannedMembers(groupId)); }
                          }} className="h-7 text-[11px] text-green-500">Unban</Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Poll ── */}
      <Dialog open={showPollCreator} onOpenChange={setShowPollCreator}>
        <DialogContent data-testid="dialog-create-poll">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BarChart2 className="h-5 w-5 text-primary" /> Create Poll</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[12px] text-muted-foreground mb-1.5 block">Question</Label>
              <Input placeholder="Ask something..." value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} className="rounded-xl" data-testid="input-poll-question" />
            </div>
            <div>
              <Label className="text-[12px] text-muted-foreground mb-1.5 block">Options</Label>
              <div className="space-y-2">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input placeholder={`Option ${i + 1}`} value={opt} onChange={e => {
                      const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n);
                    }} className="rounded-xl flex-1" />
                    {pollOptions.length > 2 && (
                      <button onClick={() => setPollOptions(p => p.filter((_, j) => j !== i))} className="text-destructive p-1"><X className="h-4 w-4" /></button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button onClick={() => setPollOptions(p => [...p, ""])}
                    className="w-full py-2 border border-dashed border-border/70 rounded-xl text-[13px] text-muted-foreground hover:border-primary/50 hover:text-primary flex items-center justify-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add option
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2.5">
              <Label className="text-[13px]">Anonymous voting</Label>
              <Switch checked={pollAnonymous} onCheckedChange={setPollAnonymous} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPollCreator(false)}>Cancel</Button>
            <Button onClick={handleCreatePoll} disabled={!pollQuestion.trim()} data-testid="button-create-poll">Create Poll</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Topic ── */}
      <Dialog open={showTopicCreator} onOpenChange={setShowTopicCreator}>
        <DialogContent data-testid="dialog-create-topic">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Hash className="h-5 w-5 text-primary" /> Create Topic</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[12px] text-muted-foreground mb-1.5 block">Topic name</Label>
              <Input placeholder="e.g., Announcements" value={newTopicTitle} onChange={e => setNewTopicTitle(e.target.value)} className="rounded-xl" data-testid="input-topic-title" />
            </div>
            <div>
              <Label className="text-[12px] text-muted-foreground mb-2 block">Color</Label>
              <div className="flex flex-wrap gap-2">
                {TOPIC_COLORS.map(color => (
                  <button key={color} onClick={() => setNewTopicColor(color)}
                    className={cn("w-9 h-9 rounded-full border-2 transition-all", newTopicColor === color ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : "border-transparent")}
                    style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTopicCreator(false)}>Cancel</Button>
            <Button onClick={handleCreateTopic} disabled={!newTopicTitle.trim()} data-testid="button-create-topic">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Forward Dialog ── */}
      <Dialog open={!!forwardTarget} onOpenChange={() => setForwardTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Forward className="h-5 w-5" /> Forward Message</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="bg-muted/30 rounded-xl p-3 mb-4 border-l-4 border-primary/50">
              <p className="text-[13px] text-muted-foreground truncate">{forwardTarget?.content}</p>
            </div>
            <p className="text-[13px] text-muted-foreground text-center">Share via copy or send to Saved Messages</p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(forwardTarget?.content || ""); toast.success("Copied!"); setForwardTarget(null); }}>
              <Copy className="h-4 w-4 mr-2" /> Copy
            </Button>
            <Button onClick={() => { toast.success("Saved to Bookmarks"); setForwardTarget(null); }}>
              <Bookmark className="h-4 w-4 mr-2" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupChat;
