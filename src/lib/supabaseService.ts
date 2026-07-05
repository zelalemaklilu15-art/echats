// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// =============================================
// TYPES
// =============================================

export interface Profile {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_active: boolean;
  is_online: boolean;
  last_seen: string;
  created_at: string;
  updated_at: string;
}

// Public profile (excludes email, phone_number, updated_at)
export interface PublicProfile {
  id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_active: boolean;
  is_online: boolean;
  last_seen: string;
  created_at?: string; // Optional - not returned by search_users_public
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
}

export interface TypingIndicator {
  id: string;
  chat_id: string;
  user_id: string;
  is_typing: boolean;
  updated_at: string;
}

// =============================================
// PROFILE FUNCTIONS
// =============================================

export const getProfile = async (userId: string): Promise<Profile | null> => {
  const [{ data: publicData, error: publicError }, { data: privateData, error: privateError }, { data: authData }] = await Promise.all([
    supabase.rpc('get_public_profile', { profile_id: userId }),
    supabase.rpc('get_my_private_profile'),
    supabase.auth.getUser(),
  ]);

  if (publicError) {
    console.error('Error fetching profile:', publicError);
    return null;
  }

  if (privateError) {
    console.warn('Error fetching private profile fields:', privateError);
  }

  const publicProfile = publicData?.[0];
  if (!publicProfile) return null;

  const privateProfile = privateData?.[0] ?? {};
  return {
    id: publicProfile.id,
    username: publicProfile.username,
    name: publicProfile.name,
    email: authData?.user?.id === userId ? authData.user.email ?? null : null,
    phone_number: privateProfile.phone ?? null,
    phone: privateProfile.phone ?? null,
    birthday: privateProfile.birthday ?? null,
    avatar_url: publicProfile.avatar_url,
    bio: publicProfile.bio,
    is_active: publicProfile.is_active,
    is_online: publicProfile.is_online,
    last_seen: publicProfile.last_seen,
    created_at: publicProfile.created_at ?? '',
    updated_at: '',
  } as Profile;
};

export const updateProfile = async (
  userId: string,
  updates: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
): Promise<Profile | null> => {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
  return getProfile(userId);
};

// Get public profile data (excludes email/phone) for other users
export const getPublicProfile = async (profileId: string): Promise<PublicProfile | null> => {
  const { data, error } = await supabase.rpc('get_public_profile', {
    profile_id: profileId,
  });

  if (error) {
    console.error('Error fetching public profile:', error);
    return null;
  }
  return data?.[0] || null;
};

export const searchUsers = async (searchTerm: string): Promise<PublicProfile[]> => {
  const term = searchTerm.replace('@', '').toLowerCase().trim();
  if (!term) return [];

  const { data, error } = await supabase.rpc('search_users_public', {
    search_term: term,
  });

  if (error) {
    console.error('Error searching users:', error);
    return [];
  }
  return data || [];
};

export const isUsernameUnique = async (username: string): Promise<boolean> => {
  const term = username.toLowerCase().trim();
  const { data, error } = await supabase.rpc('search_users_public', {
    search_term: term,
  });

  if (error) {
    console.error('Error checking username:', error);
    return false;
  }
  // Check if exact match exists
  return !data?.some((p: PublicProfile) => p.username === term);
};

export const searchByUsername = async (username: string): Promise<PublicProfile | null> => {
  const term = username.replace('@', '').toLowerCase().trim();
  const { data, error } = await supabase.rpc('search_users_public', {
    search_term: term,
  });

  if (error) {
    console.error('Error searching by username:', error);
    return null;
  }
  // Find exact match
  return data?.find((p: PublicProfile) => p.username === term) || null;
};

export const updateOnlineStatus = async (userId: string, isOnline: boolean): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update({
      is_online: isOnline,
      last_seen: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Error updating online status:', error);
  }
};

// =============================================
// CHAT FUNCTIONS
// =============================================

export const findOrCreateChat = async (
  currentUserId: string,
  otherUserId: string
): Promise<string | null> => {
  // Use the database function
  const { data, error } = await supabase
    .rpc('find_or_create_chat', {
      user1_id: currentUserId,
      user2_id: otherUserId,
    });

  if (error) {
    console.error('Error finding/creating chat:', error);
    return null;
  }
  return data;
};

export const getChats = async (userId: string): Promise<Chat[]> => {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .order('last_message_time', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Error fetching chats:', error);
    return [];
  }
  return data || [];
};

export const getChatById = async (chatId: string): Promise<Chat | null> => {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching chat:', error);
    return null;
  }
  return data;
};

export const updateChat = async (
  chatId: string,
  updates: Partial<Omit<Chat, 'id' | 'created_at' | 'updated_at'>>
): Promise<void> => {
  const { error } = await supabase
    .from('chats')
    .update(updates)
    .eq('id', chatId);

  if (error) {
    console.error('Error updating chat:', error);
  }
};

export const subscribeToChats = (
  userId: string,
  callback: (chats: Chat[]) => void
): RealtimeChannel => {
  // Initial fetch
  getChats(userId).then(callback);

  // Subscribe to realtime changes
  const channel = supabase
    .channel(`chats-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chats',
      },
      () => {
        // Refetch chats on any change
        getChats(userId).then(callback);
      }
    )
    .subscribe();

  return channel;
};

// =============================================
// MESSAGE FUNCTIONS
// =============================================

export const sendMessage = async (
  chatId: string,
  senderId: string,
  receiverId: string,
  content: string,
  messageType: 'text' | 'image' | 'file' | 'voice' = 'text',
  mediaUrl?: string,
  fileName?: string
): Promise<Message | null> => {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      message_type: messageType,
      media_url: mediaUrl || null,
      file_name: fileName || null,
      status: 'sent',
    })
    .select()
    .single();

  if (error) {
    console.error('Error sending message:', error);
    return null;
  }

  // Update chat's last message
  await updateChat(chatId, {
    last_message: content || (messageType === 'image' ? '📷 Image' : '📎 File'),
    last_message_time: new Date().toISOString(),
    last_sender_id: senderId,
  });

  // Cast types properly
  return {
    ...data,
    message_type: data.message_type as 'text' | 'image' | 'file' | 'voice',
    status: data.status as 'sending' | 'sent' | 'delivered' | 'read',
  };
};

export const getMessages = async (
  chatId: string,
  limit: number = 50,
  before?: string
): Promise<Message[]> => {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
  
  // Map to ensure correct types
  return (data || []).reverse().map((msg) => ({
    ...msg,
    message_type: msg.message_type as 'text' | 'image' | 'file' | 'voice',
    status: msg.status as 'sending' | 'sent' | 'delivered' | 'read',
  }));
};

export const subscribeToMessages = (
  chatId: string,
  callback: (messages: Message[]) => void
): RealtimeChannel => {
  // Initial fetch
  getMessages(chatId).then(callback);

  // Subscribe to realtime changes
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
      () => {
        // Refetch messages on any change
        getMessages(chatId).then(callback);
      }
    )
    .subscribe();

  return channel;
};

export const updateMessageStatus = async (
  messageId: string,
  status: 'delivered' | 'read'
): Promise<void> => {
  const { error } = await supabase
    .from('messages')
    .update({ status })
    .eq('id', messageId);

  if (error) {
    console.error('Error updating message status:', error);
  }
};

export const deleteMessage = async (messageId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId);

  if (error) {
    console.error('Error deleting message:', error);
    return false;
  }
  return true;
};

export const markMessagesAsRead = async (
  chatId: string,
  receiverId: string
): Promise<void> => {
  const { error } = await supabase
    .from('messages')
    .update({ status: 'read' })
    .eq('chat_id', chatId)
    .eq('receiver_id', receiverId)
    .neq('status', 'read');

  if (error) {
    console.error('Error marking messages as read:', error);
  }
};

export const markMessagesAsDelivered = async (
  chatId: string,
  receiverId: string
): Promise<void> => {
  const { error } = await supabase
    .from('messages')
    .update({ status: 'delivered' })
    .eq('chat_id', chatId)
    .eq('receiver_id', receiverId)
    .eq('status', 'sent');

  if (error) {
    console.error('Error marking messages as delivered:', error);
  }
};

// =============================================
// TYPING INDICATOR FUNCTIONS
// =============================================

export const setTypingStatus = async (
  chatId: string,
  userId: string,
  isTyping: boolean
): Promise<void> => {
  const { error } = await supabase
    .from('typing_indicators')
    .upsert(
      {
        chat_id: chatId,
        user_id: userId,
        is_typing: isTyping,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'chat_id,user_id',
      }
    );

  if (error) {
    console.error('Error setting typing status:', error);
  }
};

export const subscribeToTyping = (
  chatId: string,
  currentUserId: string,
  callback: (isTyping: boolean, userId: string) => void
): RealtimeChannel => {
  const channel = supabase
    .channel(`typing-${chatId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'typing_indicators',
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        const data = payload.new as TypingIndicator;
        if (data && data.user_id !== currentUserId) {
          callback(data.is_typing, data.user_id);
        }
      }
    )
    .subscribe();

  return channel;
};

// =============================================
// PRESENCE / ONLINE STATUS
// =============================================

export const subscribeToPresence = (
  userId: string,
  callback: (isOnline: boolean) => void
): RealtimeChannel => {
  const channel = supabase
    .channel(`presence-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        const data = payload.new as Profile;
        callback(data.is_online);
      }
    )
    .subscribe();

  return channel;
};

// =============================================
// UNREAD COUNT HELPERS
// =============================================

export const getUnreadCount = (chat: Chat, userId: string): number => {
  if (chat.participant_1 === userId) {
    return chat.unread_count_1;
  }
  return chat.unread_count_2;
};

export const incrementUnreadCount = async (
  chatId: string,
  recipientId: string
): Promise<void> => {
  // First get the chat to determine which participant field to update
  const chat = await getChatById(chatId);
  if (!chat) return;

  const field = chat.participant_1 === recipientId ? 'unread_count_1' : 'unread_count_2';
  const currentCount = chat.participant_1 === recipientId ? chat.unread_count_1 : chat.unread_count_2;

  await supabase
    .from('chats')
    .update({ [field]: currentCount + 1 })
    .eq('id', chatId);
};

export const resetUnreadCount = async (
  chatId: string,
  userId: string
): Promise<void> => {
  const chat = await getChatById(chatId);
  if (!chat) return;

  const field = chat.participant_1 === userId ? 'unread_count_1' : 'unread_count_2';

  await supabase
    .from('chats')
    .update({ [field]: 0 })
    .eq('id', chatId);
};
