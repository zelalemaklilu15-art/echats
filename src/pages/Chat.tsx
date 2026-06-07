// @ts-nocheck
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, MoreVertical, Paperclip, Send, Image, File, Loader2, Search, Mic, Images, Video, VolumeX, Volume2, ImageIcon, Trash2, BellOff, Bell, X, Pin, Timer, CheckSquare, Square, Clock, Lock, Palette, BarChart3, MapPin, Download, KeyRound, BadgeCheck, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { ChatAvatar } from "@/components/ui/chat-avatar";
import { MessageBubble } from "@/components/ui/message-bubble";
import { useNavigate, useParams } from "react-router-dom";
import { useMessages, useTypingIndicator, useProfile, useChatInfo } from "@/hooks/useChatStore";
import { chatStore } from "@/lib/chatStore";
import { uploadChatImage, uploadChatFile, compressImage, validateFile } from "@/lib/supabaseStorage";
import { toast } from "sonner";
import { Virtuoso } from "react-virtuoso";
import { CallButton } from "@/components/call/CallButton";
import TypingDots from "@/components/chat/TypingDots";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { MediaGallery } from "@/components/chat/MediaGallery";
import { ForwardPicker } from "@/components/chat/ForwardPicker";
import { MediaViewer } from "@/components/chat/MediaViewer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageSearch } from "@/components/chat/MessageSearch";
import WallpaperPicker from "@/components/chat/WallpaperPicker";
import { getChatWallpaper, getWallpaperStyle, setChatWallpaper, getPresetWallpapers, type WallpaperConfig } from "@/lib/chatWallpaperService";
import { supabase } from "@/integrations/supabase/client";
import { useCall } from "@/contexts/CallContext";
import { getDraft, saveDraft, clearDraft } from "@/lib/draftService";
import { getDisappearingTimer, setDisappearingTimer, TIMER_OPTIONS, getTimerLabel, type DisappearingTimer } from "@/lib/disappearingService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getScheduledMessages,
  addScheduledMessage,
  removeScheduledMessage,
  getReadyMessages,
  clearSentMessages,
  type ScheduledMessage,
} from "@/lib/scheduledMessageService";
import { isSilentMode, toggleSilentMode } from "@/lib/silentMessageService";
import { isSecretChat, enableSecretChat, disableSecretChat, getSecretChat, SELF_DESTRUCT_OPTIONS } from "@/lib/secretChatService";
import { getChatTheme } from "@/lib/chatThemeService";
import ChatThemePicker from "@/components/chat/ChatThemePicker";
import { PollCreator } from "@/components/chat/PollCreator";
import { PollCard } from "@/components/chat/PollCard";
import { getPollsForChat, votePoll, closePoll, type Poll } from "@/lib/pollService";
import { getCurrentLocation, type LocationData } from "@/lib/locationService";
import LocationCard from "@/components/chat/LocationCard";
import { VideoMessageRecorder } from "@/components/chat/VideoMessageRecorder";
import { StickerGifPicker } from "@/components/chat/StickerGifPicker";
import type { Sticker } from "@/lib/stickerService";
import { Smile, Ghost, Eye, EyeOff, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatExportDialog } from "@/components/chat/ChatExportDialog";
import { registerUndoSend, undoSend, hasPendingUndo, subscribeToUndoChanges } from "@/lib/undoSendService";
import { isGhostModeActive } from "@/lib/ghostModeService";
import { isChatLocked, verifyChatPin, markChatUnlocked, isChatSessionUnlocked } from "@/lib/chatLockService";
import { getVerification, getBadgeConfig } from "@/lib/verificationService";
import { isViewOnce, hasBeenViewed, markAsViewed, markAsViewOnce, isViewOnceExpired } from "@/lib/viewOnceService";
import { QuickReplyBar } from "@/components/chat/QuickReplyBar";
import { ChecklistCreator } from "@/components/chat/ChecklistCreator";
import { ChecklistCard } from "@/components/chat/ChecklistCard";
import { GiftPicker } from "@/components/chat/GiftPicker";
import { BillSplitCreator } from "@/components/chat/BillSplitCreator";
import { BillSplitCard } from "@/components/chat/BillSplitCard";
import { getBillSplit } from "@/lib/billSplitService";
import { GiftMessageBubble } from "@/components/chat/GiftMessageBubble";
import { createChecklist, getChecklistsForChat, toggleChecklistItem, deleteChecklist, type Checklist } from "@/lib/checklistService";
import { getSharingSettings, updateSharingSettings, isForwardingPrevented } from "@/lib/sharingPreventionService";
import { sendGift, getStarsBalance, getGiftById, refreshStarsBalance, getReceivedGifts, type SentGift } from "@/lib/giftsService";
import { searchQuickReplies } from "@/lib/quickReplyService";
import { getSmartReplies, type SmartReply } from "@/lib/smartReplyService";
import { ListTodo, Gift as GiftIcon, ShieldOff, Wallet2, Receipt, FileText, Video as VideoIcon2, Gamepad2, BarChart2, Bell as BellIcon2, Pencil } from "lucide-react";
import { setMessageTimer, getMessageTimer, clearExpiredTimers, TIMER_PRESETS } from "@/lib/perMessageTimerService";
import { addReminder, REMINDER_PRESETS } from "@/lib/reminderService";
import { generateImage } from "@/lib/aiImageService";
import { generateRoomId } from "@/lib/groupCallService";
import { DrawingCanvas } from "@/components/chat/DrawingCanvas";
import { GameCard } from "@/components/chat/GameCard";
import { createGame, serializeGame } from "@/lib/gameService";
// sync
// =============================================
// TYPES
// =============================================

interface MessageDisplay {
  id: string;
  text: string;
  timestamp: string;
  isOwn: boolean;
  status?: "sending" | "sent" | "delivered" | "read";
  type?: "text" | "image" | "video" | "file" | "voice";
  mediaUrl?: string;
  fileName?: string;
  isOptimistic?: boolean;
  isFailed?: boolean;
}

// =============================================
// UTILITIES
// =============================================

const formatTime = (timestamp?: string): string => {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// =============================================
// MAIN COMPONENT
// =============================================

const Chat = () => {
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<{id: string; text: string; isOwn: boolean} | null>(null);
  const [editingMessage, setEditingMessage] = useState<{id: string; text: string} | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<Set<string>>(new Set());
  const [forwardMessage, setForwardMessage] = useState<MessageDisplay | null>(null);
  const [mediaViewerData, setMediaViewerData] = useState<{url: string; type: "image" | "video"; index: number} | null>(null);
  const [disappearingTimer, setDisappearingTimerState] = useState<DisappearingTimer>("off");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showScheduledListDialog, setShowScheduledListDialog] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduledCount, setScheduledCount] = useState(0);
  const [silentMode, setSilentModeState] = useState(false);
  const [isSecret, setIsSecret] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [chatPolls, setChatPolls] = useState<Poll[]>([]);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [chatThemeBubble, setChatThemeBubble] = useState<string>("");
  const [chatThemeFontSize, setChatThemeFontSize] = useState<"small" | "medium" | "large">("medium");
  const [ghostMode, setGhostModeState] = useState(isGhostModeActive());
  const [pendingUndoId, setPendingUndoId] = useState<string | null>(null);
  const [chatLockPin, setChatLockPin] = useState("");
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [viewOnceMode, setViewOnceMode] = useState(false);
  const [showChecklistCreator, setShowChecklistCreator] = useState(false);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [showBillSplitCreator, setShowBillSplitCreator] = useState(false);
  const [chatChecklists, setChatChecklists] = useState<Checklist[]>([]);
  const [forwardingPrevented, setForwardingPrevented] = useState(false);
  const [smartReplies, setSmartReplies] = useState<SmartReply[]>([]);
  const [isNetworkOnline, setIsNetworkOnline] = useState(navigator.onLine);
  const [showTimerSheet, setShowTimerSheet] = useState<string | null>(null);
  const [showReminderSheet, setShowReminderSheet] = useState<{id: string; text: string} | null>(null);
  const [showSummarySheet, setShowSummarySheet] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showDrawingCanvas, setShowDrawingCanvas] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationDuration, setLocationDuration] = useState<number>(60);
  const [liveLocationInterval, setLiveLocationInterval] = useState<NodeJS.Timeout | null>(null);
  const [liveLocationMsgId, setLiveLocationMsgId] = useState<string | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<string[]>([]);
  const navigate = useNavigate();
  const { chatId } = useParams();
  const virtuosoRef = useRef<any>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrolledRef = useRef(false);

  const { startCall } = useCall();

  const currentUserId = chatStore.getCurrentUserId();

  // Chat lock check
  useEffect(() => {
    if (chatId && isChatLocked(chatId) && !isChatSessionUnlocked(chatId)) {
      setShowLockScreen(true);
    }
  }, [chatId]);

  // Undo send subscription
  useEffect(() => {
    const unsub = subscribeToUndoChanges(() => {
      if (chatId) {
        setPendingUndoId(hasPendingUndo(chatId));
      }
    });
    return unsub;
  }, [chatId]);

  useEffect(() => {
    if (chatId) {
      try {
        const mutedChats = JSON.parse(localStorage.getItem("echat_muted_chats") || "[]");
        setIsMuted(mutedChats.includes(chatId));
      } catch { setIsMuted(false); }
      try {
        const pinned = JSON.parse(localStorage.getItem(`echat_pinned_${chatId}`) || "[]");
        setPinnedMessages(new Set(pinned));
      } catch { setPinnedMessages(new Set()); }
      const draft = getDraft(chatId);
      if (draft) setNewMessage(draft);
      setDisappearingTimerState(getDisappearingTimer(chatId));
      setSilentModeState(isSilentMode(chatId));
      setIsSecret(isSecretChat(chatId));
      setChatPolls(getPollsForChat(chatId));
      const theme = getChatTheme(chatId);
      setChatThemeBubble(theme?.bubbleColor || "");
      setChatThemeFontSize(theme?.fontSize || "medium");
      setGhostModeState(isGhostModeActive());
      setChatChecklists(getChecklistsForChat(chatId));
      setForwardingPrevented(isForwardingPrevented(chatId));
    }
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    if (newMessage) {
      const timeout = setTimeout(() => saveDraft(chatId, newMessage), 500);
      return () => clearTimeout(timeout);
    } else {
      clearDraft(chatId);
    }
  }, [chatId, newMessage]);

  // Use cached hooks
  const { chat, otherUserId, loading: chatLoading } = useChatInfo(chatId);
  const { profile: otherProfile, loading: profileLoading } = useProfile(otherUserId || undefined);
  const { messages: rawMessages, loading: messagesLoading, sendMessage, deleteMessage } = useMessages(chatId);
  const { typingUsers, setTyping } = useTypingIndicator(chatId);

  // Transform messages for display (memoized)
  const messages: MessageDisplay[] = useMemo(() => {
    return rawMessages.map((msg) => ({
      id: msg.id,
      text: msg.content || "",
      timestamp: formatTime(msg.created_at),
      isOwn: msg.sender_id === currentUserId,
      status: msg.status,
      type: msg.message_type,
      mediaUrl: msg.media_url || undefined,
      fileName: msg.file_name || undefined,
      isOptimistic: msg._optimistic,
      isFailed: msg._failed,
    }));
  }, [rawMessages, currentUserId]);

  useEffect(() => {
    if (chatId) {
      setScheduledCount(getScheduledMessages(chatId).length);
    }
  }, [chatId, showScheduleDialog, showScheduledListDialog]);

  // Offline message queue
  useEffect(() => {
    if (!chatId) return;
    const stored = localStorage.getItem(`echat_msg_queue_${chatId}`);
    if (stored) {
      try { setOfflineQueue(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, [chatId]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsNetworkOnline(true);
      if (!chatId) return;
      const key = `echat_msg_queue_${chatId}`;
      const queued: string[] = JSON.parse(localStorage.getItem(key) || "[]");
      if (queued.length === 0) return;
      localStorage.removeItem(key);
      setOfflineQueue([]);
      for (const text of queued) {
        await sendMessage(text);
      }
      toast.success(`Sent ${queued.length} queued message${queued.length > 1 ? "s" : ""}`);
    };
    const handleOffline = () => setIsNetworkOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [chatId, sendMessage]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const ready = getReadyMessages();
      if (ready.length === 0) return;
      const sentIds: string[] = [];
      for (const msg of ready) {
        if (msg.chatId === chatId) {
          const success = await sendMessage(msg.text);
          if (success) sentIds.push(msg.id);
        }
      }
      if (sentIds.length > 0) {
        clearSentMessages(sentIds);
        if (chatId) setScheduledCount(getScheduledMessages(chatId).length);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [chatId, sendMessage]);

  // Smart reply suggestions based on last received message
  useEffect(() => {
    if (messages.length === 0) { setSmartReplies([]); return; }
    const lastMsg = [...messages].reverse().find((m) => !m.isOwn);
    if (lastMsg && lastMsg.type === "text") {
      setSmartReplies(getSmartReplies(lastMsg.text));
    } else {
      setSmartReplies([]);
    }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0 && virtuosoRef.current && !highlightedMessageId) {
      // Only auto-scroll if we haven't manually scrolled or it's a new message
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({ 
          index: messages.length - 1, 
          behavior: scrolledRef.current ? 'smooth' : 'auto'
        });
        scrolledRef.current = true;
      }, 50);
    }
  }, [messages.length, highlightedMessageId]);

  // Handle search result selection - scroll to message
  const handleSearchResultSelect = useCallback((messageId: string) => {
    setHighlightedMessageId(messageId);
    
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex >= 0 && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: messageIndex,
        behavior: 'smooth',
        align: 'center'
      });
    }

    // Clear highlight after 2 seconds
    setTimeout(() => {
      setHighlightedMessageId(null);
    }, 2000);
  }, [messages]);

  // Close search
  const handleCloseSearch = useCallback(() => {
    setShowSearch(false);
    setHighlightedMessageId(null);
  }, []);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    setTyping(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 2000);
  }, [setTyping]);

  // Send text message
  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage("");
    setTyping(false);
    setReplyToMessage(null);
    if (chatId) clearDraft(chatId);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Offline queue
    if ((!navigator.onLine || !isNetworkOnline) && chatId) {
      const key = `echat_msg_queue_${chatId}`;
      const existing: string[] = JSON.parse(localStorage.getItem(key) || "[]");
      existing.push(messageText);
      localStorage.setItem(key, JSON.stringify(existing));
      setOfflineQueue(existing);
      toast("⏳ Message queued — will send when online");
      return;
    }

    // /imagine AI image generation
    if (messageText.startsWith("/imagine ")) {
      const prompt = messageText.slice(9).trim();
      if (prompt) {
        toast("🎨 Generating image...");
        generateImage(prompt).then(url => {
          sendMessage(url, "image");
        }).catch(() => toast.error("Failed to generate image"));
        return;
      }
    }

    if (editingMessage) {
      const { error } = await supabase
        .from("messages")
        .update({ content: messageText })
        .eq("id", editingMessage.id);
      setEditingMessage(null);
      if (error) {
        toast.error("Failed to edit message");
      } else {
        toast.success("Message edited");
      }
      return;
    }

    const success = await sendMessage(messageText);
    if (!success) {
      toast.error("Failed to send message");
    } else if (chatId) {
      // Register undo for text messages (5-second window)
      const latestMessages = rawMessages;
      const lastMsg = latestMessages[latestMessages.length - 1];
      if (lastMsg) {
        registerUndoSend(lastMsg.id, chatId, async () => {
          await deleteMessage(lastMsg.id);
          toast.success("Message unsent");
        });
        setPendingUndoId(lastMsg.id);
      }
    }
  }, [newMessage, sendMessage, setTyping, editingMessage, chatId, rawMessages, deleteMessage, isNetworkOnline]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle image upload
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId) return;

    const validation = validateFile(file, { 
      maxSize: 5 * 1024 * 1024, 
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] 
    });
    
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const compressedFile = await compressImage(file);
      const result = await uploadChatImage(chatId, compressedFile, (progress) => {
        setUploadProgress(progress.percentage);
      });

      const success = await sendMessage("", "image", result.url);
      if (success) {
        toast.success("Image sent!");
      } else {
        toast.error("Failed to send image");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  // Handle file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId) return;

    const validation = validateFile(file, { maxSize: 10 * 1024 * 1024 });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const result = await uploadChatFile(chatId, file, (progress) => {
        setUploadProgress(progress.percentage);
      });

      const success = await sendMessage("", "file", result.url, file.name);
      if (success) {
        toast.success("File sent!");
      } else {
        toast.error("Failed to send file");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle voice message send
  const handleVoiceSend = async (blob: Blob) => {
    if (!chatId) return;
    setUploading(true);
    try {
      const file = new globalThis.File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      const result = await uploadChatFile(chatId, file, () => {});
      const success = await sendMessage("", "voice", result.url, file.name);
      if (success) toast.success("Voice message sent!");
      else toast.error("Failed to send voice message");
    } catch (err) {
      toast.error("Failed to upload voice message");
    } finally {
      setUploading(false);
      setShowVoiceRecorder(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const success = await deleteMessage(messageId);
    if (success) {
      toast.success("Message deleted");
    } else {
      toast.error("Failed to delete message");
    }
  };

  // Derived state
  const chatName = otherProfile?.name || otherProfile?.username || "Chat";
  const chatAvatar = otherProfile?.avatar_url || "";
  const isOnline = isUserOnline(otherProfile?.last_seen, otherProfile?.is_online || false);
  const isTyping = typingUsers.length > 0;
  
  const hasCachedMessages = messages.length > 0;
  const hasCachedChat = !!chat;
  const isLoading = !hasCachedMessages && !hasCachedChat && (chatLoading || messagesLoading);

  const handleToggleMute = useCallback(() => {
    if (!chatId) return;
    try {
      const mutedChats = JSON.parse(localStorage.getItem("echat_muted_chats") || "[]") as string[];
      let updated: string[];
      if (mutedChats.includes(chatId)) {
        updated = mutedChats.filter(id => id !== chatId);
        setIsMuted(false);
        toast.success("Chat unmuted");
      } else {
        updated = [...mutedChats, chatId];
        setIsMuted(true);
        toast.success("Chat muted");
      }
      localStorage.setItem("echat_muted_chats", JSON.stringify(updated));
    } catch {}
  }, [chatId]);

  const handleVideoCall = useCallback(() => {
    if (!otherUserId) return;
    startCall(otherUserId, chatName, "video", chatAvatar || undefined);
  }, [otherUserId, chatName, chatAvatar, startCall]);

  const handleClearHistory = useCallback(async () => {
    if (!chatId || !currentUserId) return;
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("chat_id", chatId)
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);
    if (!error) {
      toast.success("Chat history cleared");
      window.location.reload();
    } else {
      toast.error("Failed to clear history");
    }
  }, [chatId, currentUserId]);

  const handlePinMessage = useCallback((messageId: string) => {
    if (!chatId) return;
    setPinnedMessages(prev => {
      const updated = new Set(prev);
      if (updated.has(messageId)) {
        updated.delete(messageId);
        toast.success("Message unpinned");
      } else {
        updated.add(messageId);
        toast.success("Message pinned");
      }
      localStorage.setItem(`echat_pinned_${chatId}`, JSON.stringify([...updated]));
      return updated;
    });
  }, [chatId]);

  const handleReplyToMessage = useCallback((msg: MessageDisplay) => {
    setEditingMessage(null);
    setReplyToMessage({ id: msg.id, text: msg.text, isOwn: msg.isOwn });
  }, []);

  const handleEditMessage = useCallback((msg: MessageDisplay) => {
    setReplyToMessage(null);
    setEditingMessage({ id: msg.id, text: msg.text });
    setNewMessage(msg.text);
  }, []);

  const handleForwardMessage = useCallback((msg: MessageDisplay) => {
    setForwardMessage(msg);
  }, []);

  const handleToggleSelect = useCallback((messageId: string) => {
    setSelectedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedMessages.size === 0) return;
    let count = 0;
    for (const msgId of selectedMessages) {
      const success = await deleteMessage(msgId);
      if (success) count++;
    }
    if (count > 0) toast.success(`Deleted ${count} message${count > 1 ? "s" : ""}`);
    setSelectedMessages(new Set());
    setSelectMode(false);
  }, [selectedMessages, deleteMessage]);

  const handleBulkForward = useCallback(() => {
    if (selectedMessages.size === 0) return;
    const selectedMsgs = messages.filter(m => selectedMessages.has(m.id));
    if (selectedMsgs.length === 1) {
      setForwardMessage(selectedMsgs[0]);
    } else {
      const combinedText = selectedMsgs.map(m => m.text).join("\n");
      setForwardMessage({ id: "", text: combinedText, timestamp: "", isOwn: false, type: "text" });
    }
  }, [selectedMessages, messages]);

  const handleChangeDisappearingTimer = useCallback((timer: DisappearingTimer) => {
    if (!chatId) return;
    setDisappearingTimer(chatId, timer);
    setDisappearingTimerState(timer);
    toast.success(timer === "off" ? "Disappearing messages turned off" : `Messages will disappear after ${getTimerLabel(timer)}`);
  }, [chatId]);

  const handleOpenScheduleDialog = useCallback(() => {
    const now = new Date();
    const defaultDate = now.toISOString().split("T")[0];
    const defaultTime = new Date(now.getTime() + 5 * 60000)
      .toTimeString()
      .slice(0, 5);
    setScheduleDate(defaultDate);
    setScheduleTime(defaultTime);
    setShowScheduleDialog(true);
  }, []);

  const handleScheduleMessage = useCallback(() => {
    if (!chatId || !newMessage.trim() || !scheduleDate || !scheduleTime) return;
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    const minTime = new Date(Date.now() + 60000);
    if (scheduledAt < minTime) {
      toast.error("Please schedule at least 1 minute from now");
      return;
    }
    addScheduledMessage(chatId, newMessage.trim(), scheduledAt);
    const formattedDate = scheduledAt.toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
    toast.success(`Message scheduled for ${formattedDate}`);
    setNewMessage("");
    setShowScheduleDialog(false);
    setScheduledCount(getScheduledMessages(chatId).length);
    if (chatId) clearDraft(chatId);
  }, [chatId, newMessage, scheduleDate, scheduleTime]);

  const handleRemoveScheduledMessage = useCallback(
    (id: string) => {
      removeScheduledMessage(id);
      if (chatId) setScheduledCount(getScheduledMessages(chatId).length);
    },
    [chatId],
  );

  const handleOpenMediaViewer = useCallback((mediaUrl: string, type: "image" | "video") => {
    const mediaMessages = messages.filter(m => m.mediaUrl && (m.type === "image" || m.type === "video"));
    const index = mediaMessages.findIndex(m => m.mediaUrl === mediaUrl);
    setMediaViewerData({ url: mediaUrl, type, index: Math.max(0, index) });
  }, [messages]);

  const allMediaForViewer = useMemo(() => {
    return messages
      .filter(m => m.mediaUrl && (m.type === "image" || m.type === "video"))
      .map(m => ({ url: m.mediaUrl!, type: m.type as "image" | "video", timestamp: m.timestamp }));
  }, [messages]);

  const handleDeleteChat = useCallback(async () => {
    if (!chatId) return;
    const { error } = await supabase
      .from("chats")
      .delete()
      .eq("id", chatId);
    if (!error) {
      toast.success("Chat deleted");
      navigate("/chats");
    } else {
      toast.error("Failed to delete chat");
    }
  }, [chatId, navigate]);

  const handleToggleSilent = useCallback(() => {
    if (!chatId) return;
    const newState = toggleSilentMode(chatId);
    setSilentModeState(newState);
    toast.success(newState ? "Silent mode on - messages won't notify" : "Silent mode off");
  }, [chatId]);

  const handleToggleSecretChat = useCallback(() => {
    if (!chatId) return;
    if (isSecret) {
      disableSecretChat(chatId);
      setIsSecret(false);
      toast.success("Secret chat disabled");
    } else {
      enableSecretChat(chatId, 0);
      setIsSecret(true);
      toast.success("Secret chat enabled");
    }
  }, [chatId, isSecret]);

  const handlePollCreated = useCallback((poll: Poll) => {
    if (chatId) setChatPolls(getPollsForChat(chatId));
    toast.success("Poll created!");
  }, [chatId]);

  const handlePollVote = useCallback((pollId: string, optionId: string) => {
    if (!currentUserId) return;
    votePoll(pollId, optionId, currentUserId);
    if (chatId) setChatPolls(getPollsForChat(chatId));
  }, [currentUserId, chatId]);

  const handleClosePoll = useCallback((pollId: string) => {
    closePoll(pollId);
    if (chatId) setChatPolls(getPollsForChat(chatId));
    toast.success("Poll closed");
  }, [chatId]);

  const handleShareLocation = useCallback(async () => {
    setShowLocationPicker(true);
  }, []);

  const handleShareLiveLocation = useCallback(async (durationMinutes: number) => {
    setShowLocationPicker(false);
    setSharingLocation(true);
    try {
      const location = await getCurrentLocation();
      const expiresAt = Date.now() + durationMinutes * 60 * 1000;
      const locationText = `[live_location:${location.latitude.toFixed(6)},${location.longitude.toFixed(6)},${expiresAt}]`;
      const success = await sendMessage(locationText);
      if (success) {
        toast.success(`Live location shared for ${durationMinutes >= 60 ? durationMinutes / 60 + "h" : durationMinutes + "m"}`);
        // We can't easily edit the message ID here since sendMessage returns bool, so we just share once
      } else {
        toast.error("Failed to share location");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to get location");
    } finally {
      setSharingLocation(false);
    }
  }, [sendMessage]);

  const handleSummarizeChat = useCallback(async () => {
    const last30 = messages.slice(-30).filter(m => m.type === "text" && m.text && !m.text.startsWith("["));
    if (last30.length < 3) { toast.error("Not enough messages to summarize"); return; }
    setSummaryLoading(true);
    setShowSummarySheet(true);
    setSummaryText("");
    try {
      const prompt = `Summarize this conversation in 3-4 bullet points:\n\n${last30.map(m => `${m.isOwn ? "Me" : "Other"}: ${m.text}`).join("\n")}`;
      const { generateResponse } = await import("@/lib/aiAssistantService");
      const result = generateResponse(prompt);
      setSummaryText(result);
    } catch { setSummaryText("Could not generate summary at this time."); }
    finally { setSummaryLoading(false); }
  }, [messages]);

  // Per-message timer cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      clearExpiredTimers((msgId) => {
        deleteMessage(msgId);
      });
    }, 10_000);
    return () => clearInterval(interval);
  }, [deleteMessage]);

  const handleStickerSelect = useCallback(async (sticker: Sticker) => {
    setShowStickerPicker(false);
    const stickerText = `[sticker:${sticker.emoji}:${sticker.label}]`;
    const success = await sendMessage(stickerText);
    if (!success) {
      toast.error("Failed to send sticker");
    }
  }, [sendMessage]);

  const handleChecklistCreate = useCallback((title: string, items: string[]) => {
    if (!chatId) return;
    createChecklist(chatId, title, items);
    setChatChecklists(getChecklistsForChat(chatId));
    setShowChecklistCreator(false);
    toast.success("Checklist created!");
  }, [chatId]);

  const handleChecklistToggle = useCallback((checklistId: string, itemId: string) => {
    toggleChecklistItem(checklistId, itemId);
    if (chatId) setChatChecklists(getChecklistsForChat(chatId));
  }, [chatId]);

  const handleChecklistDelete = useCallback((checklistId: string) => {
    deleteChecklist(checklistId);
    if (chatId) setChatChecklists(getChecklistsForChat(chatId));
    toast.success("Checklist removed");
  }, [chatId]);

  const handleGiftSend = useCallback(async (giftId: string, message?: string) => {
    if (!chatId || !currentUserId) return;
    const gift = getGiftById(giftId);
    if (!gift) return;
    const balance = await refreshStarsBalance().catch(() => getStarsBalance());
    if (balance < gift.stars) {
      toast.error(`Not enough Stars! You need ${gift.stars} Stars.`);
      return;
    }
    const result = await sendGift(giftId, currentUserId, otherUserId || "", chatId, message);
    if (!result) {
      toast.error("Failed to send gift");
      return;
    }
    setShowGiftPicker(false);
    toast.success(`Gift sent! 🎁`);
  }, [chatId, currentUserId, otherUserId]);

  const handleQuickReplySelect = useCallback((text: string) => {
    setNewMessage(text);
  }, []);

  const handleToggleForwardingPrevention = useCallback(() => {
    if (!chatId) return;
    const current = getSharingSettings(chatId);
    const newVal = !current.preventForwarding;
    updateSharingSettings(chatId, { preventForwarding: newVal });
    setForwardingPrevented(newVal);
    toast.success(newVal ? "Forwarding prevented" : "Forwarding allowed");
  }, [chatId]);

  const handleVideoMessageSend = useCallback(async (blob: Blob) => {
    if (!chatId) return;
    setUploading(true);
    try {
      const file = new globalThis.File([blob], `video-msg-${Date.now()}.webm`, { type: "video/webm" });
      const result = await uploadChatFile(chatId, file, () => {});
      const success = await sendMessage("", "video" as any, result.url, file.name);
      if (success) toast.success("Video message sent!");
      else toast.error("Failed to send video message");
    } catch {
      toast.error("Failed to upload video message");
    } finally {
      setUploading(false);
      setShowVideoRecorder(false);
    }
  }, [chatId, sendMessage]);

  // Error state - only show if not loading AND truly no access (give it time)
  // Don't show error immediately - wait for store to be ready
  if (!chatLoading && !messagesLoading && !chat && chatId && currentUserId) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border p-4 z-10">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/chats")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="font-semibold text-foreground">Error</h2>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Chat not found or you don't have access</p>
            <Button onClick={() => navigate("/chats")}>Back to Chats</Button>
          </div>
        </div>
      </div>
    );
  }

  // Chat lock screen
  if (showLockScreen && chatId) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-8">
        <Lock className="h-16 w-16 text-primary mb-6" />
        <h2 className="text-xl font-bold text-foreground mb-2">Chat Locked</h2>
        <p className="text-sm text-muted-foreground mb-6 text-center">Enter PIN to access this chat</p>
        <div className="flex gap-2 mb-4">
          {[0,1,2,3].map(i => (
            <div key={i} className={cn(
              "w-4 h-4 rounded-full border-2 border-primary transition-all",
              chatLockPin.length > i ? "bg-primary" : "bg-transparent"
            )} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 max-w-[240px]">
          {[1,2,3,4,5,6,7,8,9,null,0,'del'].map((key, i) => {
            if (key === null) return <div key={i} />;
            return (
              <Button
                key={i}
                variant="outline"
                className="h-14 w-14 text-lg font-semibold rounded-xl"
                onClick={() => {
                  if (key === 'del') {
                    setChatLockPin(p => p.slice(0, -1));
                  } else {
                    const newPin = chatLockPin + key.toString();
                    setChatLockPin(newPin);
                    if (newPin.length === 4) {
                      if (verifyChatPin(chatId, newPin)) {
                        markChatUnlocked(chatId);
                        setShowLockScreen(false);
                        setChatLockPin("");
                      } else {
                        toast.error("Wrong PIN");
                        setChatLockPin("");
                      }
                    }
                  }
                }}
              >
                {key === 'del' ? '⌫' : key}
              </Button>
            );
          })}
        </div>
        <Button variant="ghost" className="mt-6" onClick={() => navigate("/chats")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

      {/* Header */}
      <div className="flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border p-4 z-10">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/chats")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div
            className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
            onClick={() => otherUserId && navigate(`/contact/${otherUserId}`)}
            data-testid="button-open-contact-profile"
          >
            <ChatAvatar 
              name={chatName} 
              src={chatAvatar} 
              status={isOnline ? "online" : "offline"} 
              size="md" 
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <h2 className="font-semibold text-foreground truncate">{chatName}</h2>
                {otherUserId && (() => {
                  const v = getVerification(otherUserId);
                  if (!v) return null;
                  const cfg = getBadgeConfig(v.badge);
                  return <BadgeCheck className={`h-4 w-4 flex-shrink-0 ${cfg.color}`} title={cfg.label} />;
                })()}
              </div>
            <AnimatePresence mode="wait">
              {isTyping ? (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex items-center space-x-1"
                >
                  <span className="text-xs text-primary">typing</span>
                  <TypingDots />
                </motion.div>
              ) : (
                <motion.p
                  key="status"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-muted-foreground"
                >
                  {isOnline ? "online" : "offline"}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          </div>
          {otherUserId && (
            <CallButton
              peerId={otherUserId}
              peerName={chatName}
              peerAvatar={chatAvatar}
              variant="icon"
            />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-chat-menu">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleToggleMute} data-testid="menu-mute">
                {isMuted ? <Bell className="h-4 w-4 mr-2" /> : <BellOff className="h-4 w-4 mr-2" />}
                {isMuted ? "Unmute" : "Mute"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleVideoCall} data-testid="menu-video-call">
                <Video className="h-4 w-4 mr-2" />
                Video Call
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowSearch(true)} data-testid="menu-search">
                <Search className="h-4 w-4 mr-2" />
                Search
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowWallpaperPicker(true)} data-testid="menu-wallpaper">
                <ImageIcon className="h-4 w-4 mr-2" />
                Change Wallpaper
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowThemePicker(true)} data-testid="menu-chat-theme">
                <Palette className="h-4 w-4 mr-2" />
                Chat Theme
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowPollCreator(true)} data-testid="menu-create-poll">
                <BarChart3 className="h-4 w-4 mr-2" />
                Create Poll
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleSecretChat} data-testid="menu-secret-chat">
                <Lock className="h-4 w-4 mr-2" />
                {isSecret ? "Disable Secret Chat" : "Enable Secret Chat"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (!chatId) return;
                  if (isChatLocked(chatId)) {
                    import("@/lib/chatLockService").then(({ unlockChat }) => {
                      unlockChat(chatId);
                      toast.success("Chat lock removed");
                    });
                  } else {
                    const pin = prompt("Set a 4-digit PIN:");
                    if (pin && pin.length === 4 && /^\d{4}$/.test(pin)) {
                      import("@/lib/chatLockService").then(({ lockChat }) => {
                        lockChat(chatId, pin);
                        toast.success("Chat locked with PIN");
                      });
                    } else if (pin) {
                      toast.error("PIN must be exactly 4 digits");
                    }
                  }
                }}
                data-testid="menu-lock-chat"
              >
                <KeyRound className="h-4 w-4 mr-2" />
                {chatId && isChatLocked(chatId) ? "Remove Chat Lock" : "Lock Chat"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSelectMode(!selectMode); setSelectedMessages(new Set()); }} data-testid="menu-select">
                <CheckSquare className="h-4 w-4 mr-2" />
                {selectMode ? "Cancel Selection" : "Select Messages"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-testid="menu-disappearing" className="p-0">
                <div className="flex flex-col w-full">
                  <div className="flex items-center px-2 py-1.5">
                    <Timer className="h-4 w-4 mr-2" />
                    <span>Disappearing Messages</span>
                  </div>
                  <div className="flex flex-wrap gap-1 px-2 pb-2">
                    {TIMER_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={(e) => { e.stopPropagation(); handleChangeDisappearingTimer(opt.value); }}
                        className={`text-xs px-2 py-1 rounded-md transition-colors ${
                          disappearingTimer === opt.value 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                        data-testid={`disappearing-${opt.value}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowScheduledListDialog(true)} data-testid="menu-scheduled-messages">
                <Clock className="h-4 w-4 mr-2" />
                Scheduled Messages{scheduledCount > 0 ? ` (${scheduledCount})` : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowExportDialog(true)} data-testid="menu-export-chat">
                <Download className="h-4 w-4 mr-2" />
                Export Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSummarizeChat} data-testid="menu-summarize">
                <FileText className="h-4 w-4 mr-2" />
                Summarize Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { if (chatId) navigate(`/chat-stats/${chatId}`); }} data-testid="menu-chat-stats">
                <BarChart2 className="h-4 w-4 mr-2" />
                Chat Stats
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { if (chatId) { const roomId = generateRoomId(chatId); navigate(`/group-call/${roomId}`); } }} data-testid="menu-group-call">
                <VideoIcon2 className="h-4 w-4 mr-2" />
                Group Call
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleClearHistory} data-testid="menu-clear-history" className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear History
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDeleteChat} data-testid="menu-delete-chat" className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Offline queue indicator */}
      {(!isNetworkOnline || offlineQueue.length > 0) && (
        <div className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-500/15 border-b border-amber-500/30">
          <WifiOff className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            {offlineQueue.length > 0
              ? `${offlineQueue.length} message${offlineQueue.length > 1 ? "s" : ""} queued — sending when online`
              : "You're offline"}
          </span>
        </div>
      )}

      {/* Select mode action bar */}
      {selectMode && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-primary/10 border-b border-border">
          <span className="text-sm font-medium text-foreground">
            {selectedMessages.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBulkForward} disabled={selectedMessages.size === 0} data-testid="button-bulk-forward">
              <Send className="h-4 w-4 mr-1" /> Forward
            </Button>
            <Button variant="ghost" size="sm" onClick={handleBulkDelete} disabled={selectedMessages.size === 0} className="text-destructive" data-testid="button-bulk-delete">
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setSelectMode(false); setSelectedMessages(new Set()); }} data-testid="button-cancel-select">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Chat status indicators - combined into single bar */}
      {(disappearingTimer !== "off" || isSecret || silentMode || ghostMode) && (
        <div className="flex-shrink-0 flex items-center justify-center gap-3 px-4 py-1 bg-muted/50 border-b border-border flex-wrap">
          {isSecret && (
            <div className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Encrypted</span>
            </div>
          )}
          {ghostMode && (
            <div className="flex items-center gap-1">
              <Ghost className="h-3 w-3 text-primary" />
              <span className="text-xs text-primary font-medium">Ghost Mode</span>
            </div>
          )}
          {disappearingTimer !== "off" && (
            <div className="flex items-center gap-1">
              <Timer className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{getTimerLabel(disappearingTimer)}</span>
            </div>
          )}
          {silentMode && (
            <div className="flex items-center gap-1">
              <BellOff className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Silent</span>
            </div>
          )}
        </div>
      )}

      {/* Undo send banner */}
      <AnimatePresence>
        {pendingUndoId && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2 bg-primary/10 border-b border-border">
              <div className="flex items-center gap-2">
                <Undo2 className="h-4 w-4 text-primary" />
                <span className="text-xs text-primary font-medium">Message sent</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary h-7 px-3 text-xs font-semibold"
                onClick={() => {
                  if (pendingUndoId) {
                    undoSend(pendingUndoId);
                    setPendingUndoId(null);
                  }
                }}
              >
                UNDO
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Bar */}
      {showSearch && chatId && (
        <MessageSearch 
          chatId={chatId}
          onResultSelect={handleSearchResultSelect}
          onClose={handleCloseSearch}
        />
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="flex-shrink-0 px-4 py-2 bg-muted/50">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Uploading... {uploadProgress}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1 mt-1">
            <div 
              className="bg-primary h-1 rounded-full transition-all" 
              style={{ width: `${uploadProgress}%` }} 
            />
          </div>
        </div>
      )}

      {/* Pinned message banner */}
      {pinnedMessages.size > 0 && messages.length > 0 && (() => {
        const pinnedMsg = messages.find(m => pinnedMessages.has(m.id));
        if (!pinnedMsg) return null;
        return (
          <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border cursor-pointer"
            onClick={() => {
              setHighlightedMessageId(pinnedMsg.id);
              setTimeout(() => setHighlightedMessageId(null), 2000);
            }}
            data-testid="pinned-message-banner"
          >
            <Pin className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-primary">Pinned Message</p>
              <p className="text-xs text-muted-foreground truncate">{pinnedMsg.text}</p>
            </div>
          </div>
        );
      })()}

      {/* Polls display */}
      {chatPolls.length > 0 && (
        <div className="flex-shrink-0 max-h-[300px] overflow-y-auto px-4 py-2 space-y-2 border-b border-border">
          {chatPolls.filter(p => !p.closed).map(poll => (
            <PollCard
              key={poll.id}
              poll={poll}
              currentUserId={currentUserId || ""}
              onVote={handlePollVote}
              onClose={currentUserId === poll.createdBy ? handleClosePoll : undefined}
            />
          ))}
        </div>
      )}

      {/* Messages - show cached content immediately, loading spinner only when truly empty */}
      <div className="flex-1 min-h-0 overflow-hidden" style={getWallpaperStyle(chatId ? getChatWallpaper(chatId) : null)}>
        {messages.length === 0 && isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-muted-foreground">No messages yet. Say hello!</p>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            className="h-full w-full"
            data={messages}
            overscan={200}
            itemContent={(index, message) => (
              <motion.div
                initial={{ opacity: 0, x: message.isOwn ? 20 : -20, y: 5 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`px-4 py-1 transition-all duration-300 flex items-start gap-2 ${
                  highlightedMessageId === message.id 
                    ? 'bg-primary/20 ring-2 ring-primary/40 rounded-lg' 
                    : ''
                } ${selectedMessages.has(message.id) ? 'bg-primary/10' : ''}`}
                onClick={selectMode ? () => handleToggleSelect(message.id) : undefined}
              >
                {selectMode && (
                  <div className="flex-shrink-0 pt-2">
                    {selectedMessages.has(message.id) ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {message.text?.startsWith("[bill_split:") && (() => {
                    const splitId = message.text.slice(12, -1);
                    const split = getBillSplit(splitId);
                    return (
                      <div className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}>
                        {split ? <BillSplitCard billSplit={split} /> : <div className="text-[12px] text-muted-foreground px-3 py-2 bg-muted rounded-2xl">Bill split</div>}
                      </div>
                    );
                  })()}
                  {message.text?.startsWith("[live_location:") && (() => {
                    const inner = message.text.slice(15, -1);
                    const parts = inner.split(",");
                    const lat = parseFloat(parts[0]);
                    const lng = parseFloat(parts[1]);
                    const expiresAt = parts[2] ? parseInt(parts[2]) : undefined;
                    return (
                      <div className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}>
                        <LocationCard lat={lat} lng={lng} expiresAt={expiresAt} />
                      </div>
                    );
                  })()}
                  {message.text?.startsWith("[location:") && !message.text?.startsWith("[live_location:") && (() => {
                    const inner = message.text.slice(10, -1);
                    const [lat, lng] = inner.split(",").map(parseFloat);
                    return (
                      <div className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}>
                        <LocationCard lat={lat} lng={lng} />
                      </div>
                    );
                  })()}
                  {message.text?.startsWith("[game:ttt:") && (() => {
                    const encoded = message.text.slice(10, -1);
                    return (
                      <div className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}>
                        <GameCard
                          encodedState={encoded}
                          chatId={chatId || ""}
                          currentUserId={currentUserId || ""}
                          onSendMove={(text) => sendMessage(text)}
                          isOwn={message.isOwn}
                        />
                      </div>
                    );
                  })()}
                  {!message.text?.startsWith("[bill_split:") && !message.text?.startsWith("[live_location:") && !message.text?.startsWith("[location:") && !message.text?.startsWith("[game:ttt:") && (
                  <MessageBubble
                    message={message.text}
                    timestamp={message.timestamp}
                    isOwn={message.isOwn}
                    status={message.status === 'sending' ? 'sent' : message.status}
                    type={message.type as "text" | "image" | "file" | "voice"}
                    mediaUrl={message.mediaUrl}
                    fileName={message.fileName}
                    onDelete={!selectMode && message.isOwn && !message.isOptimistic ? () => handleDeleteMessage(message.id) : undefined}
                    onDeleteForEveryone={!selectMode && message.isOwn && !message.isOptimistic ? () => handleDeleteMessage(message.id) : undefined}
                    onReply={!selectMode && !message.isOptimistic ? () => handleReplyToMessage(message) : undefined}
                    onEdit={!selectMode && message.isOwn && !message.isOptimistic && message.type === "text" ? () => handleEditMessage(message) : undefined}
                    onForward={!selectMode && !message.isOptimistic ? () => handleForwardMessage(message) : undefined}
                    onPin={!selectMode && !message.isOptimistic ? () => handlePinMessage(message.id) : undefined}
                    onSetTimer={!selectMode && !message.isOptimistic && message.isOwn ? () => setShowTimerSheet(message.id) : undefined}
                    onRemindMe={!selectMode && !message.isOptimistic ? () => setShowReminderSheet({ id: message.id, text: message.text }) : undefined}
                    isPinned={pinnedMessages.has(message.id)}
                    className={message.isFailed ? "opacity-50" : ""}
                    messageId={!message.isOptimistic ? message.id : undefined}
                    chatId={chatId}
                    bubbleColor={chatThemeBubble}
                    fontSize={chatThemeFontSize}
                  />
                  )}
                </div>
              </motion.div>
            )}
            followOutput="smooth"
            initialTopMostItemIndex={messages.length - 1}
            alignToBottom
          />
        )}
      </div>

      {/* Media Gallery */}
      <AnimatePresence>
        {showMediaGallery && chatId && (
          <MediaGallery chatId={chatId} onClose={() => setShowMediaGallery(false)} />
        )}
      </AnimatePresence>

      {/* Wallpaper Picker */}
      <AnimatePresence>
        {showWallpaperPicker && chatId && (
          <WallpaperPicker
            chatId={chatId}
            onClose={() => setShowWallpaperPicker(false)}
          />
        )}
      </AnimatePresence>

      {/* Forward Picker */}
      <AnimatePresence>
        {forwardMessage && (
          <ForwardPicker
            messageText={forwardMessage.text}
            messageType={forwardMessage.type}
            mediaUrl={forwardMessage.mediaUrl}
            onClose={() => { setForwardMessage(null); setSelectedMessages(new Set()); setSelectMode(false); }}
          />
        )}
      </AnimatePresence>

      {/* Media Viewer */}
      <AnimatePresence>
        {mediaViewerData && allMediaForViewer.length > 0 && (
          <MediaViewer
            media={allMediaForViewer}
            initialIndex={mediaViewerData.index}
            onClose={() => setMediaViewerData(null)}
          />
        )}
      </AnimatePresence>

      {/* Export Chat Dialog */}
      {showExportDialog && chatId && (
        <ChatExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          chatId={chatId}
          chatName={chatName}
          messages={messages}
        />
      )}

      {/* Schedule Message Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent data-testid="dialog-schedule-message">
          <DialogHeader>
            <DialogTitle>Schedule Message</DialogTitle>
            <DialogDescription>Choose when to send this message</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground mb-1">Message preview</p>
              <p className="text-sm text-foreground break-words" data-testid="text-schedule-preview">
                {newMessage.trim()}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  data-testid="input-schedule-date"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  data-testid="input-schedule-time"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)} data-testid="button-cancel-schedule">
              Cancel
            </Button>
            <Button onClick={handleScheduleMessage} data-testid="button-confirm-schedule">
              <Clock className="h-4 w-4 mr-2" />
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scheduled Messages List Dialog */}
      <Dialog open={showScheduledListDialog} onOpenChange={setShowScheduledListDialog}>
        <DialogContent data-testid="dialog-scheduled-list">
          <DialogHeader>
            <DialogTitle>Scheduled Messages</DialogTitle>
            <DialogDescription>Messages waiting to be sent</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {chatId && getScheduledMessages(chatId).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-scheduled">
                No scheduled messages
              </p>
            ) : (
              chatId &&
              getScheduledMessages(chatId).map((msg) => (
                <div
                  key={msg.id}
                  className="flex items-start gap-3 p-3 rounded-md bg-muted"
                  data-testid={`scheduled-message-${msg.id}`}
                >
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate" data-testid={`text-scheduled-text-${msg.id}`}>
                      {msg.text}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`text-scheduled-time-${msg.id}`}>
                      {new Date(msg.scheduledAt).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveScheduledMessage(msg.id)}
                    data-testid={`button-delete-scheduled-${msg.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Theme Picker */}
      {showThemePicker && chatId && (
        <ChatThemePicker chatId={chatId} open={showThemePicker} onClose={() => {
          setShowThemePicker(false);
          const theme = getChatTheme(chatId);
          setChatThemeBubble(theme?.bubbleColor || "");
          setChatThemeFontSize(theme?.fontSize || "medium");
        }} />
      )}

      {/* Poll Creator */}
      {showPollCreator && chatId && (
        <PollCreator chatId={chatId} currentUserId={currentUserId || ""} open={showPollCreator} onCreated={handlePollCreated} onClose={() => setShowPollCreator(false)} />
      )}

      {/* Video Message Recorder */}
      <AnimatePresence>
        {showVideoRecorder && (
          <VideoMessageRecorder
            onSend={handleVideoMessageSend}
            onCancel={() => setShowVideoRecorder(false)}
          />
        )}
      </AnimatePresence>

      {/* Reply/Edit preview bar */}
      <AnimatePresence>
        {(replyToMessage || editingMessage) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 bg-background border-t border-border overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-2">
              <div className="w-1 h-8 rounded-full bg-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-primary">
                  {editingMessage ? "Edit message" : replyToMessage?.isOwn ? "Reply to yourself" : "Reply"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {editingMessage ? editingMessage.text : replyToMessage?.text}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
                onClick={() => {
                  setReplyToMessage(null);
                  setEditingMessage(null);
                  if (editingMessage) setNewMessage("");
                }}
                data-testid="button-cancel-reply"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticker Picker */}
      <StickerGifPicker
        isOpen={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        onSelectSticker={handleStickerSelect}
      />

      {/* Checklists */}
      {chatChecklists.length > 0 && (
        <div className="px-4 py-2 space-y-2 border-t border-border">
          {chatChecklists.map(cl => (
            <ChecklistCard
              key={cl.id}
              checklist={cl}
              isOwn={true}
              onUpdate={(updated) => setChatChecklists(prev => prev.map(c => c.id === updated.id ? updated : c))}
              onDelete={() => handleChecklistDelete(cl.id)}
            />
          ))}
        </div>
      )}

      {/* Quick Reply Bar */}
      {newMessage.startsWith("/") && (
        <div className="relative">
          <QuickReplyBar
            query={newMessage.slice(1)}
            onSelect={handleQuickReplySelect}
            onClose={() => {}}
          />
        </div>
      )}

      {/* Checklist Creator Dialog */}
      <ChecklistCreator
        open={showChecklistCreator}
        onClose={() => setShowChecklistCreator(false)}
        onConfirm={handleChecklistCreate}
      />

      {/* Gift Picker Dialog */}
      <GiftPicker
        open={showGiftPicker}
        onClose={() => setShowGiftPicker(false)}
        onSend={handleGiftSend}
      />

      {/* Drawing Canvas */}
      {showDrawingCanvas && chatId && (
        <DrawingCanvas
          chatId={chatId}
          onClose={() => setShowDrawingCanvas(false)}
          onSend={(url) => sendMessage(url, "image")}
        />
      )}

      {/* AI Summary Sheet */}
      <AnimatePresence>
        {showSummarySheet && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-3xl border-t border-border/50 shadow-2xl max-h-[70vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <h3 className="font-bold text-[16px] flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Chat Summary</h3>
              <div className="flex gap-2">
                {summaryText && <button onClick={() => { navigator.clipboard?.writeText(summaryText); toast.success("Copied!"); }}
                  className="text-[12px] font-semibold text-primary px-3 py-1.5 rounded-xl bg-primary/10">Copy</button>}
                <button onClick={() => setShowSummarySheet(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {summaryLoading ? (
                <div className="flex items-center justify-center h-24 gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-[14px] text-muted-foreground">Analyzing conversation...</span>
                </div>
              ) : (
                <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">{summaryText}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Per-Message Timer Sheet */}
      <AnimatePresence>
        {showTimerSheet && (
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-3xl border-t border-border/50 shadow-2xl pb-8"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <h3 className="font-bold text-[16px] flex items-center gap-2"><Timer className="h-4 w-4 text-primary" />Set Self-Destruct Timer</h3>
              <button onClick={() => setShowTimerSheet(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-3">
              {TIMER_PRESETS.map(p => (
                <button key={p.label} onClick={() => { if (showTimerSheet) { setMessageTimer(showTimerSheet, p.ms); toast.success(`Message will delete in ${p.label}`); setShowTimerSheet(null); } }}
                  className="py-3.5 rounded-2xl bg-muted text-foreground font-semibold text-[14px] hover:bg-primary/10 hover:text-primary transition-colors"
                  data-testid={`timer-${p.label}`}>{p.label}</button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reminder Sheet */}
      <AnimatePresence>
        {showReminderSheet && (
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-3xl border-t border-border/50 shadow-2xl pb-8"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <h3 className="font-bold text-[16px] flex items-center gap-2"><BellIcon2 className="h-4 w-4 text-primary" />Set Reminder</h3>
              <button onClick={() => setShowReminderSheet(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-3">
              {REMINDER_PRESETS.map(p => (
                <button key={p.label} onClick={() => {
                  if (showReminderSheet && chatId) {
                    addReminder(chatId, showReminderSheet.id, showReminderSheet.text, new Date(Date.now() + p.ms));
                    toast.success(`Reminder set for ${p.label.toLowerCase()}`);
                    setShowReminderSheet(null);
                  }
                }}
                  className="py-3.5 rounded-2xl bg-muted text-foreground font-semibold text-[14px] hover:bg-primary/10 hover:text-primary transition-colors"
                  data-testid={`reminder-${p.label}`}>{p.label}</button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Location Duration Picker */}
      <AnimatePresence>
        {showLocationPicker && (
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-3xl border-t border-border/50 shadow-2xl pb-8"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <h3 className="font-bold text-[16px] flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />Share Live Location</h3>
              <button onClick={() => setShowLocationPicker(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-[13px] text-muted-foreground">Share your location for:</p>
              {[{ label: "15 minutes", mins: 15 }, { label: "1 hour", mins: 60 }, { label: "8 hours", mins: 480 }].map(opt => (
                <button key={opt.mins} onClick={() => handleShareLiveLocation(opt.mins)} disabled={sharingLocation}
                  className="w-full py-3.5 rounded-2xl bg-muted text-foreground font-semibold text-[14px] hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-between px-5"
                  data-testid={`location-duration-${opt.mins}`}>
                  <span>{opt.label}</span>
                  {sharingLocation && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bill Split Creator */}
      {showBillSplitCreator && chatId && (
        <BillSplitCreator
          chatId={chatId}
          participants={[
            { userId: currentUserId || "", name: "You" },
            ...(otherProfile ? [{ userId: otherUserId || "", name: otherProfile.name || otherProfile.username || "Other" }] : []),
          ].filter(p => p.userId)}
          onClose={() => setShowBillSplitCreator(false)}
          onCreated={(splitId) => {
            setShowBillSplitCreator(false);
            sendMessage(`[bill_split:${splitId}]`);
          }}
        />
      )}

      {/* Smart Reply Chips */}
      <AnimatePresence>
        {smartReplies.length > 0 && !newMessage && !showVoiceRecorder && !editingMessage && !replyToMessage && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide border-t border-border/30 bg-background"
          >
            {smartReplies.map((reply) => (
              <button
                key={reply.id}
                onClick={() => setNewMessage(reply.text)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary text-[12px] font-medium hover:bg-primary/20 transition-colors whitespace-nowrap"
                data-testid={`smart-reply-${reply.id}`}
              >
                {reply.text}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="flex-shrink-0 bg-background border-t border-border p-4">
        <AnimatePresence mode="wait">
          {showVoiceRecorder ? (
            <VoiceRecorder
              key="voice"
              onSend={handleVoiceSend}
              onCancel={() => setShowVoiceRecorder(false)}
              disabled={uploading}
            />
          ) : (
            <motion.div
              key="text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center space-x-2"
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={uploading}>
                    <Paperclip className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                    <Image className="h-4 w-4 mr-2" />
                    Photo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <File className="h-4 w-4 mr-2" />
                    File
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleShareLocation} disabled={sharingLocation} data-testid="menu-share-location">
                    <MapPin className="h-4 w-4 mr-2" />
                    {sharingLocation ? "Getting location..." : "Share Location"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowVideoRecorder(true)} data-testid="menu-video-message">
                    <Video className="h-4 w-4 mr-2" />
                    Video Message
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowChecklistCreator(true)} data-testid="menu-create-checklist">
                    <ListTodo className="h-4 w-4 mr-2" />
                    Checklist
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowGiftPicker(true)} data-testid="menu-send-gift">
                    <GiftIcon className="h-4 w-4 mr-2" />
                    Send Gift
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowBillSplitCreator(true)} data-testid="menu-split-bill">
                    <Wallet2 className="h-4 w-4 mr-2" />
                    Split Bill
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowDrawingCanvas(true)} data-testid="menu-draw">
                    <Pencil className="h-4 w-4 mr-2" />
                    Draw
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    if (!currentUserId || !otherUserId) return;
                    const state = createGame(currentUserId, currentUserId, otherUserId);
                    sendMessage(`[game:ttt:${serializeGame(state)}]`);
                  }} data-testid="menu-play-game">
                    <Gamepad2 className="h-4 w-4 mr-2" />
                    Play Game
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleToggleForwardingPrevention} data-testid="menu-forwarding-prevention">
                    <ShieldOff className="h-4 w-4 mr-2" />
                    {forwardingPrevented ? "Allow Forwarding" : "Prevent Forwarding"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowStickerPicker(!showStickerPicker)}
                disabled={uploading}
                className={cn("rounded-full", showStickerPicker ? "text-primary" : "")}
                data-testid="button-sticker-picker"
              >
                <Smile className="h-5 w-5" />
              </Button>

              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                }}
                onKeyPress={handleKeyPress}
                className="flex-1 bg-muted border-0 rounded-full"
                disabled={uploading}
              />

              {newMessage.trim() ? (
                <div className="flex items-center gap-1">
                  <motion.div whileTap={{ scale: 0.9 }}>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleToggleSilent}
                      disabled={uploading}
                      className={`rounded-full ${silentMode ? "text-muted-foreground" : ""}`}
                      data-testid="button-toggle-silent"
                    >
                      {silentMode ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                    </Button>
                  </motion.div>
                  <motion.div whileTap={{ scale: 0.9 }}>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleOpenScheduleDialog}
                      disabled={uploading}
                      className="rounded-full relative"
                      data-testid="button-schedule-message"
                    >
                      <Clock className="h-5 w-5" />
                      {scheduledCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full min-w-[16px] h-4 flex items-center justify-center" data-testid="badge-scheduled-count">
                          {scheduledCount}
                        </span>
                      )}
                    </Button>
                  </motion.div>
                  <motion.div whileTap={{ scale: 0.88, rotate: 18 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
                    <Button 
                      size="icon" 
                      onClick={handleSendMessage}
                      disabled={uploading}
                      className="rounded-full bg-gradient-primary hover:opacity-90"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </motion.div>
                </div>
              ) : (
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Button 
                    size="icon" 
                    onClick={() => setShowVoiceRecorder(true)}
                    disabled={uploading}
                    variant="ghost"
                    className="rounded-full"
                  >
                    <Mic className="h-5 w-5" />
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Chat;
