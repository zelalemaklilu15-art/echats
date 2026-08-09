// @ts-nocheck
/**
 * Group Chat Service
 * Handles group creation, membership, and messaging
 */

import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { notifyPush, previewForMessage } from '@/lib/notifyService';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  joined_at: string;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  file_name: string | null;
  created_at: string;
  updated_at: string;
  // Local-only
  _optimistic?: boolean;
  _failed?: boolean;
}

export interface GroupWithLastMessage extends Group {
  last_message?: string | null;
  last_message_time?: string | null;
  member_count?: number;
}

// =============================================
// GROUP MANAGEMENT
// =============================================

/**
 * Create a new group
 */
export async function createGroup(
  name: string,
  memberIds: string[],
  description?: string
): Promise<Group | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Create the group
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      name,
      description: description || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (groupError || !group) {
    console.error('[GroupService] Error creating group:', groupError);
    return null;
  }

  // Add creator as admin
  const { error: adminError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id: user.id,
      role: 'admin',
    });

  if (adminError) {
    console.error('[GroupService] Error adding admin:', adminError);
    // Clean up group if we can't add admin
    await supabase.from('groups').delete().eq('id', group.id);
    return null;
  }

  // Add other members
  if (memberIds.length > 0) {
    const memberInserts = memberIds
      .filter(id => id !== user.id)
      .map(userId => ({
        group_id: group.id,
        user_id: userId,
        role: 'member' as const,
      }));

    if (memberInserts.length > 0) {
      const { error: membersError } = await supabase
        .from('group_members')
        .insert(memberInserts);

      if (membersError) {
        console.error('[GroupService] Error adding members:', membersError);
        // Don't fail the whole operation, group was created
      }
    }
  }

  return group;
}

/**
 * Get all groups for current user
 */
export async function getMyGroups(): Promise<GroupWithLastMessage[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get groups where user is a member
  const { data: memberships, error: memberError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id);

  if (memberError || !memberships?.length) {
    if (memberError) console.error('[GroupService] Error fetching memberships:', memberError);
    return [];
  }

  const groupIds = memberships.map(m => m.group_id);

  // Get group details
  const { data: groups, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds)
    .order('updated_at', { ascending: false });

  if (groupError) {
    console.error('[GroupService] Error fetching groups:', groupError);
    return [];
  }

  // Get last message for each group
  const groupsWithMessages = await Promise.all(
    (groups || []).map(async (group) => {
      const { data: lastMsg } = await supabase
        .from('group_messages')
        .select('content, created_at')
        .eq('group_id', group.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id);

      return {
        ...group,
        last_message: lastMsg?.content || null,
        last_message_time: lastMsg?.created_at || group.created_at,
        member_count: count || 0,
      };
    })
  );

  return groupsWithMessages.sort((a, b) => {
    const timeA = new Date(a.last_message_time || 0).getTime();
    const timeB = new Date(b.last_message_time || 0).getTime();
    return timeB - timeA;
  });
}

/**
 * Get group by ID
 */
export async function getGroup(groupId: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .maybeSingle();

  if (error) {
    console.error('[GroupService] Error fetching group:', error);
    return null;
  }

  return data;
}

/**
 * Get group members
 */
export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });

  if (error) {
    console.error('[GroupService] Error fetching members:', error);
    return [];
  }

  return data || [];
}

/**
 * Add member to group (admin only)
 */
export async function addGroupMember(groupId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: userId,
      role: 'member',
    });

  if (error) {
    console.error('[GroupService] Error adding member:', error);
    return false;
  }

  return true;
}

/**
 * Remove member from group (admin only or self)
 */
export async function removeGroupMember(groupId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) {
    console.error('[GroupService] Error removing member:', error);
    return false;
  }

  return true;
}

/**
 * Check if user is group admin
 */
export async function isGroupAdmin(groupId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return false;

  return data.role === 'admin';
}

// =============================================
// GROUP MESSAGES
// =============================================

/**
 * Get group messages
 */
export async function getGroupMessages(groupId: string): Promise<GroupMessage[]> {
  const { data, error } = await supabase
    .from('group_messages')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[GroupService] Error fetching messages:', error);
    return [];
  }

  return data || [];
}

/**
 * Send group message
 */
export async function sendGroupMessage(
  groupId: string,
  content: string,
  messageType: string = 'text',
  mediaUrl?: string,
  fileName?: string
): Promise<GroupMessage | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('group_messages')
    .insert({
      group_id: groupId,
      sender_id: user.id,
      content,
      message_type: messageType,
      media_url: mediaUrl || null,
      file_name: fileName || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[GroupService] Error sending message:', error);
    return null;
  }

  // Update group updated_at
  await supabase
    .from('groups')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', groupId);

  return data;
}

/**
 * Delete group message
 */
export async function deleteGroupMessage(messageId: string): Promise<boolean> {
  const { error } = await supabase
    .from('group_messages')
    .delete()
    .eq('id', messageId);

  if (error) {
    console.error('[GroupService] Error deleting message:', error);
    return false;
  }

  return true;
}

// =============================================
// REALTIME
// =============================================

/**
 * Subscribe to group messages
 */
export function subscribeToGroupMessages(
  groupId: string,
  onMessage: (message: GroupMessage) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`group-messages-${groupId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      },
      (payload) => {
        onMessage(payload.new as GroupMessage);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Unsubscribe from group messages
 */
export function unsubscribeFromGroupMessages(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
