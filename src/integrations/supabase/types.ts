export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_message_feedback: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          message_id: string
          rating: string
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id: string
          rating: string
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string
          rating?: string
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          role: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          role: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          call_type: string
          caller_id: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          receiver_id: string
          room_id: string | null
          started_at: string
          status: string
        }
        Insert: {
          call_type: string
          caller_id: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          receiver_id: string
          room_id?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          call_type?: string
          caller_id?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          receiver_id?: string
          room_id?: string | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          created_at: string
          id: string
          last_message: string | null
          last_message_time: string | null
          last_sender_id: string | null
          participant_1: string
          participant_2: string
          unread_count_1: number | null
          unread_count_2: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_time?: string | null
          last_sender_id?: string | null
          participant_1: string
          participant_2: string
          unread_count_1?: number | null
          unread_count_2?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_time?: string | null
          last_sender_id?: string | null
          participant_1?: string
          participant_2?: string
          unread_count_1?: number | null
          unread_count_2?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      etok_blocked_users: {
        Row: {
          blocked_at: string
          blocked_id: string
          blocker_id: string
        }
        Insert: {
          blocked_at?: string
          blocked_id: string
          blocker_id: string
        }
        Update: {
          blocked_at?: string
          blocked_id?: string
          blocker_id?: string
        }
        Relationships: []
      }
      etok_coins: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      etok_comments: {
        Row: {
          author_id: string
          created_at: string
          id: string
          is_pinned: boolean
          likes: number
          parent_id: string | null
          text: string
          video_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          likes?: number
          parent_id?: string | null
          text: string
          video_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          likes?: number
          parent_id?: string | null
          text?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etok_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etok_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "etok_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etok_comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "etok_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      etok_creator_rewards: {
        Row: {
          amount_usd: number
          created_at: string
          id: string
          period_end: string
          period_start: string
          status: string
          user_id: string
          views_earned: number
        }
        Insert: {
          amount_usd?: number
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          status?: string
          user_id: string
          views_earned?: number
        }
        Update: {
          amount_usd?: number
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          status?: string
          user_id?: string
          views_earned?: number
        }
        Relationships: []
      }
      etok_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etok_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etok_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      etok_gifts_sent: {
        Row: {
          coins: number
          created_at: string
          gift_emoji: string
          gift_id: string
          gift_name: string
          id: string
          recipient_id: string
          sender_id: string
          stream_id: string
        }
        Insert: {
          coins: number
          created_at?: string
          gift_emoji: string
          gift_id: string
          gift_name: string
          id?: string
          recipient_id: string
          sender_id: string
          stream_id: string
        }
        Update: {
          coins?: number
          created_at?: string
          gift_emoji?: string
          gift_id?: string
          gift_name?: string
          id?: string
          recipient_id?: string
          sender_id?: string
          stream_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etok_gifts_sent_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "etok_live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      etok_hashtags: {
        Row: {
          created_at: string
          id: string
          name: string
          trending: boolean
          view_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          trending?: boolean
          view_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          trending?: boolean
          view_count?: number
        }
        Relationships: []
      }
      etok_likes: {
        Row: {
          created_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etok_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etok_likes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "etok_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      etok_live_comments: {
        Row: {
          author_id: string
          created_at: string
          gift_emoji: string | null
          id: string
          is_gift: boolean
          stream_id: string
          text: string
        }
        Insert: {
          author_id: string
          created_at?: string
          gift_emoji?: string | null
          id?: string
          is_gift?: boolean
          stream_id: string
          text: string
        }
        Update: {
          author_id?: string
          created_at?: string
          gift_emoji?: string | null
          id?: string
          is_gift?: boolean
          stream_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "etok_live_comments_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "etok_live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      etok_live_streams: {
        Row: {
          category: string
          created_at: string
          ended_at: string | null
          gift_total: number
          host_id: string
          id: string
          is_live: boolean
          started_at: string
          thumbnail_color: string
          thumbnail_emoji: string
          title: string
          viewer_count: number
        }
        Insert: {
          category?: string
          created_at?: string
          ended_at?: string | null
          gift_total?: number
          host_id: string
          id?: string
          is_live?: boolean
          started_at?: string
          thumbnail_color?: string
          thumbnail_emoji?: string
          title: string
          viewer_count?: number
        }
        Update: {
          category?: string
          created_at?: string
          ended_at?: string | null
          gift_total?: number
          host_id?: string
          id?: string
          is_live?: boolean
          started_at?: string
          thumbnail_color?: string
          thumbnail_emoji?: string
          title?: string
          viewer_count?: number
        }
        Relationships: []
      }
      etok_live_viewers: {
        Row: {
          joined_at: string
          stream_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          stream_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etok_live_viewers_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "etok_live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      etok_privacy_settings: {
        Row: {
          allow_comments: string
          allow_download: boolean
          comment_keywords: string[]
          default_video_privacy: string
          duet_permission: string
          family_pairing_email: string
          family_pairing_linked: boolean
          filter_spam: boolean
          is_business_account: boolean
          private_account: boolean
          screen_time_limit_minutes: number
          screen_time_reminder_enabled: boolean
          screen_time_reminder_interval: number
          stitch_permission: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_comments?: string
          allow_download?: boolean
          comment_keywords?: string[]
          default_video_privacy?: string
          duet_permission?: string
          family_pairing_email?: string
          family_pairing_linked?: boolean
          filter_spam?: boolean
          is_business_account?: boolean
          private_account?: boolean
          screen_time_limit_minutes?: number
          screen_time_reminder_enabled?: boolean
          screen_time_reminder_interval?: number
          stitch_permission?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_comments?: string
          allow_download?: boolean
          comment_keywords?: string[]
          default_video_privacy?: string
          duet_permission?: string
          family_pairing_email?: string
          family_pairing_linked?: boolean
          filter_spam?: boolean
          is_business_account?: boolean
          private_account?: boolean
          screen_time_limit_minutes?: number
          screen_time_reminder_enabled?: boolean
          screen_time_reminder_interval?: number
          stitch_permission?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      etok_reports: {
        Row: {
          content_id: string
          content_type: string
          id: string
          reason: string
          reported_at: string
          reporter_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          id?: string
          reason: string
          reported_at?: string
          reporter_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          id?: string
          reason?: string
          reported_at?: string
          reporter_id?: string
        }
        Relationships: []
      }
      etok_scheduled_lives: {
        Row: {
          category: string
          created_at: string
          host_id: string
          id: string
          scheduled_at: string
          thumbnail_emoji: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          host_id: string
          id?: string
          scheduled_at: string
          thumbnail_emoji?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          host_id?: string
          id?: string
          scheduled_at?: string
          thumbnail_emoji?: string
          title?: string
        }
        Relationships: []
      }
      etok_scheduled_reminders: {
        Row: {
          created_at: string
          scheduled_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          scheduled_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          scheduled_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etok_scheduled_reminders_scheduled_id_fkey"
            columns: ["scheduled_id"]
            isOneToOne: false
            referencedRelation: "etok_scheduled_lives"
            referencedColumns: ["id"]
          },
        ]
      }
      etok_series: {
        Row: {
          cover_emoji: string
          created_at: string
          creator_id: string
          description: string
          episode_count: number
          id: string
          price: number
          subscribers: number
          title: string
        }
        Insert: {
          cover_emoji?: string
          created_at?: string
          creator_id: string
          description?: string
          episode_count?: number
          id?: string
          price?: number
          subscribers?: number
          title: string
        }
        Update: {
          cover_emoji?: string
          created_at?: string
          creator_id?: string
          description?: string
          episode_count?: number
          id?: string
          price?: number
          subscribers?: number
          title?: string
        }
        Relationships: []
      }
      etok_series_subscribers: {
        Row: {
          series_id: string
          subscribed_at: string
          user_id: string
        }
        Insert: {
          series_id: string
          subscribed_at?: string
          user_id: string
        }
        Update: {
          series_id?: string
          subscribed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etok_series_subscribers_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "etok_series"
            referencedColumns: ["id"]
          },
        ]
      }
      etok_shop_items: {
        Row: {
          category: string
          created_at: string
          currency: string
          description: string
          emoji: string
          id: string
          in_stock: boolean
          name: string
          price: number
          seller_id: string
          sold: number
        }
        Insert: {
          category?: string
          created_at?: string
          currency?: string
          description?: string
          emoji?: string
          id?: string
          in_stock?: boolean
          name: string
          price?: number
          seller_id: string
          sold?: number
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string
          description?: string
          emoji?: string
          id?: string
          in_stock?: boolean
          name?: string
          price?: number
          seller_id?: string
          sold?: number
        }
        Relationships: []
      }
      etok_sounds: {
        Row: {
          audio_url: string | null
          author_name: string
          cover_emoji: string
          created_at: string
          duration: number
          id: string
          is_original: boolean
          title: string
          video_count: number
        }
        Insert: {
          audio_url?: string | null
          author_name: string
          cover_emoji?: string
          created_at?: string
          duration?: number
          id?: string
          is_original?: boolean
          title: string
          video_count?: number
        }
        Update: {
          audio_url?: string | null
          author_name?: string
          cover_emoji?: string
          created_at?: string
          duration?: number
          id?: string
          is_original?: boolean
          title?: string
          video_count?: number
        }
        Relationships: []
      }
      etok_video_analytics_daily: {
        Row: {
          author_id: string
          avg_watch_percent: number
          comments: number
          date: string
          id: string
          likes: number
          shares: number
          source_following: number
          source_fyp: number
          source_profile: number
          source_search: number
          video_id: string
          views: number
        }
        Insert: {
          author_id: string
          avg_watch_percent?: number
          comments?: number
          date: string
          id?: string
          likes?: number
          shares?: number
          source_following?: number
          source_fyp?: number
          source_profile?: number
          source_search?: number
          video_id: string
          views?: number
        }
        Update: {
          author_id?: string
          avg_watch_percent?: number
          comments?: number
          date?: string
          id?: string
          likes?: number
          shares?: number
          source_following?: number
          source_fyp?: number
          source_profile?: number
          source_search?: number
          video_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "etok_video_analytics_daily_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "etok_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      etok_videos: {
        Row: {
          allow_comments: boolean
          allow_download: boolean
          allow_duet: boolean
          allow_stitch: boolean
          author_id: string
          comments: number
          created_at: string
          description: string
          duration: number
          hashtags: string[]
          id: string
          is_sponsored: boolean
          likes: number
          privacy: string
          shares: number
          sound_name: string
          thumbnail_url: string | null
          video_url: string
          views: number
        }
        Insert: {
          allow_comments?: boolean
          allow_download?: boolean
          allow_duet?: boolean
          allow_stitch?: boolean
          author_id: string
          comments?: number
          created_at?: string
          description?: string
          duration?: number
          hashtags?: string[]
          id?: string
          is_sponsored?: boolean
          likes?: number
          privacy?: string
          shares?: number
          sound_name?: string
          thumbnail_url?: string | null
          video_url: string
          views?: number
        }
        Update: {
          allow_comments?: boolean
          allow_download?: boolean
          allow_duet?: boolean
          allow_stitch?: boolean
          author_id?: string
          comments?: number
          created_at?: string
          description?: string
          duration?: number
          hashtags?: string[]
          id?: string
          is_sponsored?: boolean
          likes?: number
          privacy?: string
          shares?: number
          sound_name?: string
          thumbnail_url?: string | null
          video_url?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "etok_videos_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      etok_webrtc_signals: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          payload: Json
          signal_type: string
          stream_id: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          payload: Json
          signal_type: string
          stream_id: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          payload?: Json
          signal_type?: string
          stream_id?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etok_webrtc_signals_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "etok_live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string | null
          created_at: string
          file_name: string | null
          group_id: string
          id: string
          media_url: string | null
          message_type: string
          sender_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          group_id: string
          id?: string
          media_url?: string | null
          message_type?: string
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          group_id?: string
          id?: string
          media_url?: string | null
          message_type?: string
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string
          content: string | null
          created_at: string
          file_name: string | null
          id: string
          media_url: string | null
          message_type: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          chat_id: string
          content?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          chat_id?: string
          content?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birthday: string | null
          created_at: string
          id: string
          is_active: boolean | null
          is_online: boolean | null
          last_seen: string | null
          name: string | null
          phone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          created_at?: string
          id: string
          is_active?: boolean | null
          is_online?: boolean | null
          last_seen?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          last_seen?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json | null
          subscription_data: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys?: Json | null
          subscription_data?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json | null
          subscription_data?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      saved_messages: {
        Row: {
          chat_id: string
          id: string
          message_id: string
          note: string | null
          saved_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          id?: string
          message_id: string
          note?: string | null
          saved_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          id?: string
          message_id?: string
          note?: string | null
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "user_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      typing_indicators: {
        Row: {
          chat_id: string
          id: string
          is_typing: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chat_id: string
          id?: string
          is_typing?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chat_id?: string
          id?: string
          is_typing?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "typing_indicators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stories: {
        Row: {
          background_color: string | null
          content: string | null
          created_at: string
          duration: number | null
          expires_at: string
          id: string
          media_url: string | null
          story_type: string
          user_id: string
          views_count: number | null
        }
        Insert: {
          background_color?: string | null
          content?: string | null
          created_at?: string
          duration?: number | null
          expires_at?: string
          id?: string
          media_url?: string | null
          story_type?: string
          user_id: string
          views_count?: number | null
        }
        Update: {
          background_color?: string | null
          content?: string | null
          created_at?: string
          duration?: number | null
          expires_at?: string
          id?: string
          media_url?: string | null
          story_type?: string
          user_id?: string
          views_count?: number | null
        }
        Relationships: []
      }
      wallet_terms_acceptance: {
        Row: {
          accepted_at: string
          id: string
          ip_address: string | null
          terms_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          terms_version?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          terms_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          completed_at: string | null
          counterparty_name: string | null
          counterparty_wallet_id: string | null
          created_at: string
          description: string | null
          fee: number
          id: string
          idempotency_key: string | null
          metadata: Json | null
          reference_id: string | null
          status: Database["public"]["Enums"]["wallet_transaction_status"]
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          completed_at?: string | null
          counterparty_name?: string | null
          counterparty_wallet_id?: string | null
          created_at?: string
          description?: string | null
          fee?: number
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["wallet_transaction_status"]
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          completed_at?: string | null
          counterparty_name?: string | null
          counterparty_wallet_id?: string | null
          created_at?: string
          description?: string | null
          fee?: number
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["wallet_transaction_status"]
          type?: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_counterparty_wallet_id_fkey"
            columns: ["counterparty_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          daily_limit: number
          id: string
          monthly_limit: number
          pin_hash: string | null
          status: Database["public"]["Enums"]["wallet_status"]
          terms_accepted: boolean
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          daily_limit?: number
          id?: string
          monthly_limit?: number
          pin_hash?: string | null
          status?: Database["public"]["Enums"]["wallet_status"]
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          daily_limit?: number
          id?: string
          monthly_limit?: number
          pin_hash?: string | null
          status?: Database["public"]["Enums"]["wallet_status"]
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_or_create_chat: {
        Args: { user1_id: string; user2_id: string }
        Returns: string
      }
      get_public_profile: {
        Args: { profile_id: string }
        Returns: {
          avatar_url: string
          bio: string
          id: string
          is_active: boolean
          is_online: boolean
          last_seen: string
          name: string
          username: string
        }[]
      }
      get_user_wallet: {
        Args: { p_user_id: string }
        Returns: {
          balance: number
          created_at: string
          currency: string
          daily_limit: number
          id: string
          monthly_limit: number
          status: Database["public"]["Enums"]["wallet_status"]
          terms_accepted: boolean
          user_id: string
        }[]
      }
      get_wallet_balance: { Args: { p_wallet_id: string }; Returns: number }
      has_accepted_wallet_terms: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      record_etok_video_interaction: {
        Args: { _kind: string; _video_id: string }
        Returns: undefined
      }
      record_etok_video_view: {
        Args: { _source?: string; _video_id: string }
        Returns: undefined
      }
      search_users_public: {
        Args: { search_term: string }
        Returns: {
          avatar_url: string
          bio: string
          id: string
          is_active: boolean
          is_online: boolean
          last_seen: string
          name: string
          username: string
        }[]
      }
    }
    Enums: {
      wallet_status: "active" | "suspended" | "pending_activation"
      wallet_transaction_status:
        | "pending"
        | "completed"
        | "failed"
        | "cancelled"
        | "reversed"
      wallet_transaction_type:
        | "deposit"
        | "withdrawal"
        | "transfer_in"
        | "transfer_out"
        | "payment"
        | "refund"
        | "bonus"
        | "fee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      wallet_status: ["active", "suspended", "pending_activation"],
      wallet_transaction_status: [
        "pending",
        "completed",
        "failed",
        "cancelled",
        "reversed",
      ],
      wallet_transaction_type: [
        "deposit",
        "withdrawal",
        "transfer_in",
        "transfer_out",
        "payment",
        "refund",
        "bonus",
        "fee",
      ],
    },
  },
} as const
