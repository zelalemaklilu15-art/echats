// @ts-nocheck
/**
 * Telegram-grade Chat Store
 * In-memory caching with optimistic updates and background sync
 */

import { supabase } from '@/integrations/supabase/client';
import { getAccessProfile, PROFILE_ACCESS_EVENT } from '@/lib/profileAccess';
import type { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';
import { shouldSendReadReceipts, shouldShowTyping } from '@/lib/ghostModeService';
import { persistentMediaReference } from '@/lib/featureMedia';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const isAbortError = (err: unknown): boolean => {
  const e = err as any;
  const msg = String(e?.message ?? '');
  return (
    e?.name === 'AbortError' ||
    msg.includes('aborted') ||
    msg.includes('signal is aborted')
  );
};

// =============================================
// TYPES
// =============================================

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  message_type: 'text' | 'image' | 'file' | 'voice';
  media_url: string | null;
  file_name: string | null;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  created_at: string;
  updated_at: string;
  // Local-only fields
  _optimistic?: boolean;
  _failed?: boolean;
}

export interface Chat {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message: string | null;
  last_message_time: string | null;
  last_sender_id: string | null;
  unread_count_1: number;
  unread_count_2: number;
  created_at: string;
  updated_at: string;
}

export interface PublicProfile {
  id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_online: boolean;
  last_seen: string;
  is_active: boolean;
}

interface PresenceState {
  isTyping: boolean;
  userId: string;
  lastActive: number;
}

// =============================================
// STORE STATE
// =============================================

class ChatStore {
  // Cached data
  private chats: Map<string, Chat> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private profiles: Map<string, PublicProfile> = new Map();
  private profileCheckedAt: Map<string, number> = new Map();
  constructor() {
    window.addEventListener(PROFILE_ACCESS_EVENT, () => {
      this.profiles.clear();
      this.profileCheckedAt.clear();
    });
  }
  
  // Subscription state
  private chatListChannel: RealtimeChannel | null = null;
  private messageChannels: Map<string, RealtimeChannel> = new Map();
  private presenceChannels: Map<string, RealtimeChannel> = new Map();
  
  // Listeners
  private chatListeners: Set<(chats: Chat[]) => void> = new Set();
  private messageListeners: Map<string, Set<(messages: Message[]) => void>> = new Map();
  private typingListeners: Map<string, Set<(users: string[]) => void>> = new Map();
  
  // Current user
  private currentUserId: string | null = null;
  
  // Typing state
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private localTypingState: Map<string, boolean> = new Map();

  // Sync timestamps (for dev health banner)
  private lastSyncTimes: { chats: Date | null; messages: Date | null; profiles: Date | null } = {
    chats: null,
    messages: null,
    profiles: null,
  };

  // =============================================
  // INITIALIZATION
  // =============================================

  async initialize(userId: string): Promise<boolean> {
    const isSameUser = this.currentUserId === userId;
    if (!isSameUser) { this.profiles.clear(); this.profileCheckedAt.clear(); }
    // Old unscoped caches may contain expiring bearer URLs; durable messages remain on the server.
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('echat_cache_msgs_')) localStorage.removeItem(key);
      }
    } catch {}

    // If we're already initialized for this user and have an active subscription + data,
    // avoid doing work. (Important: if we previously failed and chats are still empty,
    // we DO want to retry.)
    if (isSameUser && this.chatListChannel && this.chats.size > 0) return true;

    this.currentUserId = userId;
    console.log('[ChatStore] Initializing for user:', userId);

    // Load initial data
    const success = await this.loadChats();

    // Subscribe to chat list changes
    this.subscribeToChatList();
    
    return success;
  }

  // Force refresh all data - useful when init failed silently
  async forceRefresh(): Promise<boolean> {
    if (!this.currentUserId) return false;
    console.log('[ChatStore] Force refreshing data...');
    return this.loadChats();
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  cleanup(): void {
    console.log('[ChatStore] Cleaning up...');
    
    // Unsubscribe from all channels
    if (this.chatListChannel) {
      supabase.removeChannel(this.chatListChannel);
      this.chatListChannel = null;
    }
    
    this.messageChannels.forEach(channel => supabase.removeChannel(channel));
    this.messageChannels.clear();
    
    this.presenceChannels.forEach(channel => supabase.removeChannel(channel));
    this.presenceChannels.clear();
    
    // Clear timeouts
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();
    
    // Clear state
    this.chats.clear();
    this.messages.clear();
    this.profiles.clear();
    this.profileCheckedAt.clear();
    this.chatListeners.clear();
    this.messageListeners.clear();
    this.typingListeners.clear();
    this.currentUserId = null;
  }

  // =============================================
  // CHAT LIST
  // =============================================

  private async loadChats(): Promise<boolean> {
    if (!this.currentUserId) return false;

    if (!navigator.onLine) {
      try {
        const stored = localStorage.getItem('echat_cache_chats');
        if (stored) {
          const chats = JSON.parse(stored) as Chat[];
          this.chats.clear();
          chats.forEach((c) => this.chats.set(c.id, c));
          this.notifyChatListeners();
          return true;
        }
      } catch {}
      return false;
    }

    const MAX_ABORT_RETRIES = 4;

    for (let attempt = 1; attempt <= MAX_ABORT_RETRIES; attempt++) {
      try {
        console.log(`[ChatStore] loadChats attempt ${attempt} for user ${this.currentUserId}`);
        
        const { data, error } = await supabase
          .from('chats')
          .select('*')
          .or(`participant_1.eq.${this.currentUserId},participant_2.eq.${this.currentUserId}`)
          .order('last_message_time', { ascending: false, nullsFirst: false });

        if (error) {
          // Retry AbortError a few times
          if (isAbortError(error)) {
            if (attempt < MAX_ABORT_RETRIES) {
              await sleep(200 * attempt);
              continue;
            }
            console.warn('[ChatStore] loadChats exhausted retries on AbortError');
            return false;
          }
          console.error('[ChatStore] Error loading chats:', error);
          return false;
        }

        // Success - update cache
        console.log(`[ChatStore] Loaded ${data?.length || 0} chats`);
        this.chats.clear();
        (data || []).forEach((chat) => this.chats.set(chat.id, chat));
        this.lastSyncTimes.chats = new Date();
        this.notifyChatListeners();
        try { localStorage.setItem('echat_cache_chats', JSON.stringify(data || [])); } catch {}
        return true;
      } catch (err: unknown) {
        if (isAbortError(err)) {
          if (attempt < MAX_ABORT_RETRIES) {
            await sleep(200 * attempt);
            continue;
          }
          console.warn('[ChatStore] loadChats exhausted retries on thrown AbortError');
          return false;
        }
        console.error('[ChatStore] Error loading chats:', err);
        return false;
      }
    }
    return false;
  }

  private subscribeToChatList(): void {
    if (!this.currentUserId || this.chatListChannel) return;
    
    this.chatListChannel = supabase
      .channel(`chats-list-${this.currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chats',
        },
        (payload) => {
          const chat = (payload.new || payload.old) as Chat;
          
          // Only process if we're a participant
          if (chat.participant_1 !== this.currentUserId && 
              chat.participant_2 !== this.currentUserId) {
            return;
          }
          
          if (payload.eventType === 'DELETE') {
            this.chats.delete(chat.id);
          } else {
            this.chats.set(chat.id, payload.new as Chat);
          }
          
          this.notifyChatListeners();
        }
      )
      .subscribe();
  }

  subscribeChatList(callback: (chats: Chat[]) => void): () => void {
    this.chatListeners.add(callback);
    
    // Immediately call with cached data
    callback(this.getChatList());
    
    return () => {
      this.chatListeners.delete(callback);
    };
  }

  getChatList(): Chat[] {
    return Array.from(this.chats.values())
      .sort((a, b) => {
        const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
        const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
        return timeB - timeA;
      });
  }

  getChat(chatId: string): Chat | undefined {
    return this.chats.get(chatId);
  }

  private notifyChatListeners(): void {
    const chats = this.getChatList();
    this.chatListeners.forEach(callback => callback(chats));
  }

  // =============================================
  // MESSAGES
  // =============================================

  async loadMessages(chatId: string, forceRefresh = false, limit = 50, offset = 0): Promise<Message[]> {
    const viewer = this.currentUserId;
    if (!viewer) return [];
    const storageKey = `echat_messages:${viewer}:${chatId}`;
    // Return cached if available and not forcing refresh and not paginating
    if (!forceRefresh && offset === 0 && this.messages.has(chatId)) {
      return this.messages.get(chatId)!;
    }

    const cachedFallback = (): Message[] => {
      if (viewer !== this.currentUserId) return [];
      if (this.messages.has(chatId)) return this.messages.get(chatId)!;
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) return JSON.parse(stored) as Message[];
      } catch {}
      return [];
    };
    const MAX_ABORT_RETRIES = 4;

    for (let attempt = 1; attempt <= MAX_ABORT_RETRIES; attempt++) {
      try {
        const { data, error, count } = await supabase
          .from('messages')
          .select('*', { count: 'exact' })
          .eq('chat_id', chatId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (viewer !== this.currentUserId) return [];
        if (error) {
          if (isAbortError(error)) {
            if (attempt < MAX_ABORT_RETRIES) {
              await sleep(200 * attempt);
              continue;
            }
            return cachedFallback();
          }
          console.error('[ChatStore] Error loading messages:', error);
          return cachedFallback();
        }

        const messages: Message[] = (data || [])
          .reverse() // Reverse to get ascending order
          .map((msg) => ({
            ...msg,
            message_type: msg.message_type as Message['message_type'],
            status: msg.status as Message['status'],
          }));

        if (offset > 0) {
          // Prepend older messages to existing cache
          const existing = this.messages.get(chatId) || [];
          const merged = [...messages, ...existing.filter(m => !messages.find(n => n.id === m.id))];
          this.messages.set(chatId, merged);
        } else {
          this.messages.set(chatId, messages);
          try { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-100).map(message => ({
            ...message, media_url: persistentMediaReference(message.media_url, 'chat-media'),
          })))); } catch {}
        }
        
        this.lastSyncTimes.messages = new Date();
        this.notifyMessageListeners(chatId);
        return this.messages.get(chatId) || messages;
      } catch (err: any) {
        if (isAbortError(err)) {
          if (attempt < MAX_ABORT_RETRIES) {
            await sleep(200 * attempt);
            continue;
          }
          return cachedFallback();
        }
        console.error('[ChatStore] Error loading messages:', err);
        return cachedFallback();
      }
    }

    return cachedFallback();
  }

  subscribeToMessages(chatId: string, callback: (messages: Message[]) => void): () => void {
    // Add listener
    if (!this.messageListeners.has(chatId)) {
      this.messageListeners.set(chatId, new Set());
    }
    this.messageListeners.get(chatId)!.add(callback);
    
    // Immediately call with cached data
    const cached = this.messages.get(chatId);
    if (cached) {
      callback(cached);
    }
    
    // Set up realtime subscription if not exists
    if (!this.messageChannels.has(chatId)) {
      this.subscribeToMessageChannel(chatId);
    }
    
    return () => {
      const listeners = this.messageListeners.get(chatId);
      if (listeners) {
        listeners.delete(callback);
        
        // Clean up channel if no more listeners
        if (listeners.size === 0) {
          this.messageListeners.delete(chatId);
          const channel = this.messageChannels.get(chatId);
          if (channel) {
            supabase.removeChannel(channel);
            this.messageChannels.delete(chatId);
          }
        }
      }
    };
  }

  private subscribeToMessageChannel(chatId: string): void {
    const channel = supabase
      .channel(`messages-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const currentMessages = this.messages.get(chatId) || [];
          
          switch (payload.eventType) {
            case 'INSERT': {
              const newMsg = payload.new as Message;
              newMsg.message_type = newMsg.message_type as Message['message_type'];
              newMsg.status = newMsg.status as Message['status'];
              
              // Check if this is a confirmed optimistic message
              const existingIndex = currentMessages.findIndex(
                m => m._optimistic && m.content === newMsg.content && m.sender_id === newMsg.sender_id
              );
              
              if (existingIndex >= 0) {
                // Replace optimistic with real
                currentMessages[existingIndex] = newMsg;
              } else if (!currentMessages.find(m => m.id === newMsg.id)) {
                currentMessages.push(newMsg);
              }
              break;
            }
            case 'UPDATE': {
              const updatedMsg = payload.new as Message;
              updatedMsg.message_type = updatedMsg.message_type as Message['message_type'];
              updatedMsg.status = updatedMsg.status as Message['status'];
              
              const idx = currentMessages.findIndex(m => m.id === updatedMsg.id);
              if (idx >= 0) {
                currentMessages[idx] = updatedMsg;
              }
              break;
            }
            case 'DELETE': {
              const deletedId = (payload.old as any).id;
              const idx = currentMessages.findIndex(m => m.id === deletedId);
              if (idx >= 0) {
                currentMessages.splice(idx, 1);
              }
              break;
            }
          }
          
          this.messages.set(chatId, [...currentMessages]);
          this.notifyMessageListeners(chatId);
        }
      )
      .subscribe();
    
    this.messageChannels.set(chatId, channel);
  }

  private notifyMessageListeners(chatId: string): void {
    const messages = this.messages.get(chatId) || [];
    const listeners = this.messageListeners.get(chatId);
    if (listeners) {
      listeners.forEach(callback => callback([...messages]));
    }
  }

  getMessages(chatId: string): Message[] {
    return this.messages.get(chatId) || [];
  }

  // =============================================
  // SEND MESSAGE (OPTIMISTIC)
  // =============================================

  async sendMessage(
    chatId: string,
    content: string,
    messageType: 'text' | 'image' | 'file' | 'voice' = 'text',
    mediaUrl?: string,
    fileName?: string
  ): Promise<Message | null> {
    if (!this.currentUserId) return null;
    
    const chat = this.chats.get(chatId);
    if (!chat) return null;
    
    const receiverId = chat.participant_1 === this.currentUserId 
      ? chat.participant_2 
      : chat.participant_1;
    
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      chat_id: chatId,
      sender_id: this.currentUserId,
      receiver_id: receiverId,
      content,
      message_type: messageType,
      media_url: mediaUrl || null,
      file_name: fileName || null,
      status: 'sending',
      created_at: now,
      updated_at: now,
      _optimistic: true,
    };
    
    // Add to cache immediately
    const currentMessages = this.messages.get(chatId) || [];
    currentMessages.push(optimisticMessage);
    this.messages.set(chatId, [...currentMessages]);
    this.notifyMessageListeners(chatId);
    
    // Update chat preview optimistically
    const displayContent = content || (messageType === 'image' ? '📷 Photo' : '📎 File');
    chat.last_message = displayContent;
    chat.last_message_time = now;
    chat.last_sender_id = this.currentUserId;
    this.chats.set(chatId, { ...chat });
    this.notifyChatListeners();
    
    try {
      // Send to server
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: this.currentUserId,
          receiver_id: receiverId,
          content,
          message_type: messageType,
          media_url: mediaUrl || null,
          file_name: fileName || null,
          status: 'sent',
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update chat metadata
      await supabase
        .from('chats')
        .update({
          last_message: displayContent,
          last_message_time: now,
          last_sender_id: this.currentUserId,
        })
        .eq('id', chatId);
      
      // Increment unread for receiver
      const unreadField = chat.participant_1 === receiverId ? 'unread_count_1' : 'unread_count_2';
      const currentUnread = chat.participant_1 === receiverId ? chat.unread_count_1 : chat.unread_count_2;
      
      await supabase
        .from('chats')
        .update({ [unreadField]: currentUnread + 1 })
        .eq('id', chatId);
      
      return {
        ...data,
        message_type: data.message_type as Message['message_type'],
        status: data.status as Message['status'],
      };
      
    } catch (error) {
      console.error('[ChatStore] Error sending message:', error);
      
      // Mark as failed
      const msgs = this.messages.get(chatId) || [];
      const idx = msgs.findIndex(m => m.id === tempId);
      if (idx >= 0) {
        msgs[idx]._failed = true;
        msgs[idx].status = 'sending';
        this.messages.set(chatId, [...msgs]);
        this.notifyMessageListeners(chatId);
      }
      
      return null;
    }
  }

  async deleteMessage(messageId: string, chatId: string): Promise<boolean> {
    // Optimistic delete
    const messages = this.messages.get(chatId) || [];
    const msgIndex = messages.findIndex(m => m.id === messageId);
    const deletedMsg = msgIndex >= 0 ? messages[msgIndex] : null;
    
    if (msgIndex >= 0) {
      messages.splice(msgIndex, 1);
      this.messages.set(chatId, [...messages]);
      this.notifyMessageListeners(chatId);
    }
    
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);
    
    if (error) {
      console.error('[ChatStore] Error deleting message:', error);
      // Restore on failure
      if (deletedMsg && msgIndex >= 0) {
        messages.splice(msgIndex, 0, deletedMsg);
        this.messages.set(chatId, [...messages]);
        this.notifyMessageListeners(chatId);
      }
      return false;
    }
    
    return true;
  }

  // =============================================
  // TYPING INDICATORS (PRESENCE-BASED)
  // =============================================

  subscribeToTyping(chatId: string, callback: (typingUsers: string[]) => void): () => void {
    if (!this.typingListeners.has(chatId)) {
      this.typingListeners.set(chatId, new Set());
    }
    this.typingListeners.get(chatId)!.add(callback);
    
    // Set up presence channel if not exists
    if (!this.presenceChannels.has(chatId)) {
      this.subscribeToPresenceChannel(chatId);
    }
    
    return () => {
      const listeners = this.typingListeners.get(chatId);
      if (listeners) {
        listeners.delete(callback);
        
        if (listeners.size === 0) {
          this.typingListeners.delete(chatId);
          const channel = this.presenceChannels.get(chatId);
          if (channel) {
            supabase.removeChannel(channel);
            this.presenceChannels.delete(chatId);
          }
        }
      }
    };
  }

  private subscribeToPresenceChannel(chatId: string): void {
    const channel = supabase.channel(`presence-${chatId}`, {
      config: { presence: { key: this.currentUserId || 'anonymous' } },
    });
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>();
        const typingUsers = this.extractTypingUsers(state);
        this.notifyTypingListeners(chatId, typingUsers);
      })
      .subscribe();
    
    this.presenceChannels.set(chatId, channel);
  }

  private extractTypingUsers(state: RealtimePresenceState<PresenceState>): string[] {
    const typingUsers: string[] = [];
    const now = Date.now();
    
    Object.entries(state).forEach(([userId, presences]) => {
      if (userId === this.currentUserId) return;
      
      const latestPresence = presences[presences.length - 1] as PresenceState | undefined;
      if (latestPresence?.isTyping && (now - latestPresence.lastActive) < 3000) {
        typingUsers.push(userId);
      }
    });
    
    return typingUsers;
  }

  private notifyTypingListeners(chatId: string, typingUsers: string[]): void {
    const listeners = this.typingListeners.get(chatId);
    if (listeners) {
      listeners.forEach(callback => callback(typingUsers));
    }
  }

  setTyping(chatId: string, isTyping: boolean): void {
    const channel = this.presenceChannels.get(chatId);
    if (!channel || !this.currentUserId) return;
    
    // Ghost mode: don't show typing
    if (isTyping && !shouldShowTyping()) return;
    
    // Debounce typing state
    const timeoutKey = `typing-${chatId}`;
    const existingTimeout = this.typingTimeouts.get(timeoutKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    const state: PresenceState = {
      isTyping,
      userId: this.currentUserId,
      lastActive: Date.now(),
    };
    
    channel.track(state);
    this.localTypingState.set(chatId, isTyping);
    
    // Auto-clear typing after 3 seconds
    if (isTyping) {
      const timeout = setTimeout(() => {
        if (this.localTypingState.get(chatId)) {
          this.setTyping(chatId, false);
        }
      }, 3000);
      this.typingTimeouts.set(timeoutKey, timeout);
    }
  }

  // =============================================
  // READ STATUS
  // =============================================

  async markAsRead(chatId: string): Promise<void> {
    if (!this.currentUserId) return;
    
    const chat = this.chats.get(chatId);
    if (!chat) return;
    
    // Ghost mode: don't send read receipts to server
    const ghostActive = !shouldSendReadReceipts();
    
    // Update local cache immediately
    const unreadField = chat.participant_1 === this.currentUserId ? 'unread_count_1' : 'unread_count_2';
    if (chat.participant_1 === this.currentUserId) {
      chat.unread_count_1 = 0;
    } else {
      chat.unread_count_2 = 0;
    }
    this.chats.set(chatId, { ...chat });
    this.notifyChatListeners();
    
    // Update messages status
    const messages = this.messages.get(chatId) || [];
    let updated = false;
    messages.forEach(msg => {
      if (msg.receiver_id === this.currentUserId && msg.status !== 'read') {
        msg.status = 'read';
        updated = true;
      }
    });
    if (updated) {
      this.messages.set(chatId, [...messages]);
      this.notifyMessageListeners(chatId);
    }
    
    // Sync with server (ignore AbortErrors) — skip if ghost mode
    if (!ghostActive) {
      try {
        await supabase
          .from('chats')
          .update({ [unreadField]: 0 })
          .eq('id', chatId);
        
        await supabase
          .from('messages')
          .update({ status: 'read' })
          .eq('chat_id', chatId)
          .eq('receiver_id', this.currentUserId)
          .neq('status', 'read');
      } catch (err: any) {
        if (err?.name === 'AbortError' || err?.message?.includes('aborted')) return;
        console.error('[ChatStore] Error marking as read:', err);
      }
    }
  }

  // =============================================
  // PROFILES
  // =============================================

  async getProfile(userId: string): Promise<PublicProfile | null> {
    try {
      const viewer = this.currentUserId;
      const profile = await getAccessProfile(userId);
      if (viewer !== this.currentUserId || !profile) return null;
      this.profiles.set(userId, profile);
      this.profileCheckedAt.set(userId, Date.now());
      this.lastSyncTimes.profiles = new Date();
      
      return profile;
    } catch (err: any) {
      // Silently ignore AbortError
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) return null;
      console.error('[ChatStore] Error fetching profile:', err);
      return null;
    }
  }

  getCachedProfile(userId: string): PublicProfile | undefined {
    // Brief viewer-scoped cache for list filtering only; profile hooks reauthorize.
    const checkedAt = this.profileCheckedAt.get(userId) ?? 0;
    return this.currentUserId && Date.now() - checkedAt < 15000 ? this.profiles.get(userId) : undefined;
  }

  // =============================================
  // UTILITIES
  // =============================================

  getUnreadCount(chat: Chat): number {
    if (!this.currentUserId) return 0;
    return chat.participant_1 === this.currentUserId 
      ? chat.unread_count_1 
      : chat.unread_count_2;
  }

  getOtherUserId(chat: Chat): string {
    if (!this.currentUserId) return '';
    return chat.participant_1 === this.currentUserId 
      ? chat.participant_2 
      : chat.participant_1;
  }

  // Dev health banner utilities
  getLastSyncTime(type: 'chats' | 'messages' | 'profiles'): Date | null {
    return this.lastSyncTimes[type];
  }

  getCachedProfileCount(): number {
    return this.profiles.size;
  }
}

// Singleton instance
export const chatStore = new ChatStore();
