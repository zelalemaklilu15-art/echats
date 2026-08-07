// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';
import type { CallType } from '@/hooks/useWebRTC';

export interface CallLog {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: CallType;
  status: 'completed' | 'missed' | 'rejected' | 'failed';
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  room_id?: string;
  created_at: string;
}

export interface CallLogWithProfile extends CallLog {
  caller_profile?: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  };
  receiver_profile?: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  };
}

class CallLogService {
  // Create a new call log when starting a call
  async createCallLog(params: {
    callerId: string;
    receiverId: string;
    callType: CallType;
    roomId: string;
  }): Promise<string | null> {
    const { data, error } = await supabase
      .from('call_logs')
      .insert({
        caller_id: params.callerId,
        receiver_id: params.receiverId,
        call_type: params.callType,
        status: 'missed', // Default to missed, will update on completion
        room_id: params.roomId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[CallLogService] Failed to create call log:', error);
      return null;
    }

    return data.id;
  }

  // Update call log when call ends
  async updateCallLog(
    callLogId: string,
    status: 'completed' | 'missed' | 'rejected' | 'failed',
    durationSeconds?: number
  ): Promise<boolean> {
    const { error } = await supabase
      .from('call_logs')
      .update({
        status,
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq('id', callLogId);

    if (error) {
      console.error('[CallLogService] Failed to update call log:', error);
      return false;
    }

    return true;
  }

  // Update call log by room id (used by the answering side, which has no log id)
  async updateCallLogByRoomId(
    roomId: string,
    status: 'completed' | 'missed' | 'rejected' | 'failed',
    durationSeconds?: number
  ): Promise<boolean> {
    const { error } = await supabase
      .from('call_logs')
      .update({
        status,
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq('room_id', roomId);

    if (error) {
      console.error('[CallLogService] Failed to update call log by room:', error);
      return false;
    }

    return true;
  }


  // Get call logs for the current user
  async getCallLogs(limit: number = 50): Promise<CallLogWithProfile[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Fetch call logs
    const { data: logs, error } = await supabase
      .from('call_logs')
      .select('*')
      .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[CallLogService] Failed to fetch call logs:', error);
      return [];
    }

    if (!logs || logs.length === 0) return [];

    // Get unique user IDs from logs
    const userIds = new Set<string>();
    logs.forEach(log => {
      userIds.add(log.caller_id);
      userIds.add(log.receiver_id);
    });

    // Fetch profiles for all users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', Array.from(userIds));

    const profileMap = new Map<string, { id: string; name: string | null; avatar_url: string | null }>();
    profiles?.forEach(p => profileMap.set(p.id, p));

    // Combine logs with profiles
    return logs.map(log => ({
      ...log,
      call_type: log.call_type as CallType,
      status: log.status as 'completed' | 'missed' | 'rejected' | 'failed',
      caller_profile: profileMap.get(log.caller_id),
      receiver_profile: profileMap.get(log.receiver_id),
    }));
  }

  // Get a specific call log by room ID
  async getCallLogByRoomId(roomId: string): Promise<CallLog | null> {
    const { data, error } = await supabase
      .from('call_logs')
      .select('*')
      .eq('room_id', roomId)
      .single();

    if (error) {
      console.error('[CallLogService] Failed to fetch call log by room ID:', error);
      return null;
    }

    return data ? {
      ...data,
      call_type: data.call_type as CallType,
      status: data.status as 'completed' | 'missed' | 'rejected' | 'failed',
    } : null;
  }

  // Subscribe to new call logs for the current user
  subscribeToCallLogs(
    userId: string,
    onNewLog: (log: CallLog) => void
  ): () => void {
    const channel = supabase
      .channel(`call_logs:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_logs',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          const log = payload.new as CallLog;
          onNewLog({
            ...log,
            call_type: log.call_type as CallType,
            status: log.status as 'completed' | 'missed' | 'rejected' | 'failed',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const callLogService = new CallLogService();
