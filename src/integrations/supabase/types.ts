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
      ai_premium_subscriptions: {
        Row: {
          amount: number
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string | null
          paid_with: string
          plan: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at: string
          id?: string
          idempotency_key?: string | null
          paid_with: string
          plan: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string | null
          paid_with?: string
          plan?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_daily: {
        Row: {
          count: number
          day: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          day?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          day?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      airtime_topups: {
        Row: {
          amount: number
          created_at: string
          id: string
          idempotency_key: string
          phone: string
          status: string
          user_id: string
          wallet_transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          idempotency_key: string
          phone: string
          status?: string
          user_id: string
          wallet_transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          phone?: string
          status?: string
          user_id?: string
          wallet_transaction_id?: string | null
        }
        Relationships: []
      }
      bonus_budget: {
        Row: {
          bonus_amount: number
          cap: number
          id: number
          spent: number
        }
        Insert: {
          bonus_amount?: number
          cap?: number
          id?: number
          spent?: number
        }
        Update: {
          bonus_amount?: number
          cap?: number
          id?: number
          spent?: number
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          call_type: string
          caller_id: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          receiver_accepted: boolean
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
          receiver_accepted?: boolean
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
          receiver_accepted?: boolean
          receiver_id?: string
          room_id?: string | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      channel_posts: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          edited: boolean
          id: string
          reactions: Json
          sender_id: string
          sender_name: string
          type: string
          views: number
        }
        Insert: {
          channel_id: string
          content?: string
          created_at?: string
          edited?: boolean
          id: string
          reactions?: Json
          sender_id: string
          sender_name?: string
          type?: string
          views?: number
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          edited?: boolean
          id?: string
          reactions?: Json
          sender_id?: string
          sender_name?: string
          type?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "channel_posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_subscribers: {
        Row: {
          channel_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_subscribers_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          avatar_color: string
          created_at: string
          created_by: string
          description: string
          id: string
          is_public: boolean
          link: string | null
          name: string
          pinned_message_id: string | null
          subscriber_count: number
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          created_by: string
          description?: string
          id: string
          is_public?: boolean
          link?: string | null
          name: string
          pinned_message_id?: string | null
          subscriber_count?: number
        }
        Update: {
          avatar_color?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          is_public?: boolean
          link?: string | null
          name?: string
          pinned_message_id?: string | null
          subscriber_count?: number
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
      crypto_deposits: {
        Row: {
          amount_usd: number
          created_at: string
          id: string
          invoice_url: string | null
          pay_currency: string | null
          provider_invoice_id: string | null
          status: string
          updated_at: string
          user_id: string
          wallet_transaction_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          id?: string
          invoice_url?: string | null
          pay_currency?: string | null
          provider_invoice_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          wallet_transaction_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          id?: string
          invoice_url?: string | null
          pay_currency?: string | null
          provider_invoice_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          wallet_transaction_id?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
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
          last_heartbeat: string
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
          last_heartbeat?: string
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
          last_heartbeat?: string
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
      etok_onboarding: {
        Row: {
          account_type: string | null
          created_at: string
          details: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string | null
          created_at?: string
          details?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string | null
          created_at?: string
          details?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      etok_saved_videos: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etok_saved_videos_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "etok_videos"
            referencedColumns: ["id"]
          },
        ]
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
          author_id: string | null
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
          author_id?: string | null
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
          author_id?: string | null
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
      etok_video_view_receipts: {
        Row: {
          day: string
          user_id: string
          video_id: string
        }
        Insert: {
          day?: string
          user_id: string
          video_id: string
        }
        Update: {
          day?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etok_video_view_receipts_video_id_fkey"
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
          edited_at: string | null
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
          edited_at?: string | null
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
          edited_at?: string | null
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
      group_mutes: {
        Row: {
          created_at: string
          group_id: string
          muted_by: string | null
          muted_until: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          muted_by?: string | null
          muted_until?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          muted_by?: string | null
          muted_until?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_mutes_group_id_fkey"
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
      local_ads: {
        Row: {
          created_at: string
          currency: string
          description: string
          id: string
          image_url: string | null
          is_active: boolean
          owner_id: string
          price_etb: number
          target_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          owner_id: string
          price_etb?: number
          target_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          owner_id?: string
          price_etb?: number
          target_url?: string | null
          title?: string
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
          edited_at: string | null
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
          edited_at?: string | null
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
          edited_at?: string | null
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
      notification_preferences: {
        Row: {
          calls: boolean
          groups: boolean
          message_preview: boolean
          messages: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          calls?: boolean
          groups?: boolean
          message_preview?: boolean
          messages?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          calls?: boolean
          groups?: boolean
          message_preview?: boolean
          messages?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_privacy: {
        Row: {
          show_identity: string
          updated_at: string
          user_id: string
        }
        Insert: {
          show_identity?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          show_identity?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string
          paid_transaction_id: string | null
          payer_id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string
          paid_transaction_id?: string | null
          payer_id: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string
          paid_transaction_id?: string | null
          payer_id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_contacts: {
        Row: {
          contact_user_id: string
          created_at: string
          owner_id: string
        }
        Insert: {
          contact_user_id: string
          created_at?: string
          owner_id: string
        }
        Update: {
          contact_user_id?: string
          created_at?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_contacts_contact_fk"
            columns: ["contact_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_contacts_owner_fk"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      push_dispatch_config: {
        Row: {
          endpoint: string
          id: number
          secret: string
        }
        Insert: {
          endpoint: string
          id?: number
          secret?: string
        }
        Update: {
          endpoint?: string
          id?: number
          secret?: string
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
      signup_bonus_claims: {
        Row: {
          amount: number
          claimed_at: string
          device_id: string
          user_id: string
        }
        Insert: {
          amount: number
          claimed_at?: string
          device_id: string
          user_id: string
        }
        Update: {
          amount?: number
          claimed_at?: string
          device_id?: string
          user_id?: string
        }
        Relationships: []
      }
      stars_balances: {
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
      stars_gifts: {
        Row: {
          chat_id: string
          converted: boolean
          gift_id: string
          id: string
          message: string | null
          receiver_id: string
          sender_id: string
          sent_at: string
          stars: number
          stars_converted: number | null
        }
        Insert: {
          chat_id: string
          converted?: boolean
          gift_id: string
          id?: string
          message?: string | null
          receiver_id: string
          sender_id: string
          sent_at?: string
          stars: number
          stars_converted?: number | null
        }
        Update: {
          chat_id?: string
          converted?: boolean
          gift_id?: string
          id?: string
          message?: string | null
          receiver_id?: string
          sender_id?: string
          sent_at?: string
          stars?: number
          stars_converted?: number | null
        }
        Relationships: []
      }
      stars_purchases: {
        Row: {
          bonus_stars: number
          id: string
          price: number
          purchased_at: string
          stars: number
          user_id: string
          wallet_transaction_id: string | null
        }
        Insert: {
          bonus_stars?: number
          id?: string
          price: number
          purchased_at?: string
          stars: number
          user_id: string
          wallet_transaction_id?: string | null
        }
        Update: {
          bonus_stars?: number
          id?: string
          price?: number
          purchased_at?: string
          stars?: number
          user_id?: string
          wallet_transaction_id?: string | null
        }
        Relationships: []
      }
      story_close_friends: {
        Row: {
          contact_user_id: string
          created_at: string
          owner_id: string
        }
        Insert: {
          contact_user_id: string
          created_at?: string
          owner_id: string
        }
        Update: {
          contact_user_id?: string
          created_at?: string
          owner_id?: string
        }
        Relationships: []
      }
      story_poll_votes: {
        Row: {
          choice: string
          created_at: string
          sticker_id: string
          story_id: string
          user_id: string
        }
        Insert: {
          choice: string
          created_at?: string
          sticker_id: string
          story_id: string
          user_id: string
        }
        Update: {
          choice?: string
          created_at?: string
          sticker_id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_poll_votes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "user_stories"
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
          media_path: string | null
          media_url: string | null
          privacy: string
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
          media_path?: string | null
          media_url?: string | null
          privacy?: string
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
          media_path?: string | null
          media_url?: string | null
          privacy?: string
          story_type?: string
          user_id?: string
          views_count?: number | null
        }
        Relationships: []
      }
      user_verifications: {
        Row: {
          badge: Database["public"]["Enums"]["verification_badge"]
          created_at: string
          description: string | null
          updated_at: string
          user_id: string
          verified_by: string
        }
        Insert: {
          badge: Database["public"]["Enums"]["verification_badge"]
          created_at?: string
          description?: string | null
          updated_at?: string
          user_id: string
          verified_by?: string
        }
        Update: {
          badge?: Database["public"]["Enums"]["verification_badge"]
          created_at?: string
          description?: string | null
          updated_at?: string
          user_id?: string
          verified_by?: string
        }
        Relationships: []
      }
      wallet_pin_failures: {
        Row: {
          failed_count: number
          locked_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          failed_count?: number
          locked_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          failed_count?: number
          locked_until?: string | null
          updated_at?: string
          user_id?: string
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
      wallet_trusted_devices: {
        Row: {
          created_at: string
          device_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          daily_limit: number
          device_id: string | null
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
          device_id?: string | null
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
          device_id?: string | null
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
      accept_profile_call: { Args: { p_room_id: string }; Returns: boolean }
      airtime_topup:
        | {
            Args: {
              p_amount: number
              p_idempotency_key: string
              p_phone: string
              p_pin: string
            }
            Returns: {
              balance: number
              duplicate: boolean
              error: string
              success: boolean
              topup_id: string
            }[]
          }
        | {
            Args: {
              p_amount: number
              p_device: string
              p_idempotency_key: string
              p_phone: string
              p_pin: string
            }
            Returns: {
              balance: number
              duplicate: boolean
              error: string
              success: boolean
              topup_id: string
            }[]
          }
      can_comment_etok: { Args: { p_id: string }; Returns: boolean }
      can_read_chat_attachment: { Args: { p_name: string }; Returns: boolean }
      can_read_etok_media: { Args: { p_name: string }; Returns: boolean }
      can_read_profile: { Args: { p_subject: string }; Returns: boolean }
      can_read_story_media: { Args: { p_name: string }; Returns: boolean }
      can_view_channel: {
        Args: { _channel_id: string; _uid: string }
        Returns: boolean
      }
      can_view_etok_video: { Args: { p_id: string }; Returns: boolean }
      can_view_story: { Args: { p_id: string }; Returns: boolean }
      chat_attachment_path: { Args: { p_source: string }; Returns: string }
      check_wallet_device: { Args: { p_device_id: string }; Returns: string }
      consume_ai_quota: {
        Args: { p_user_id: string }
        Returns: {
          allowed: boolean
          daily_limit: number
          is_premium: boolean
          used: number
        }[]
      }
      convert_chat_gift_to_stars: {
        Args: { p_gift_instance_id: string }
        Returns: {
          balance: number
          stars_added: number
          success: boolean
        }[]
      }
      crypto_deposit_attach: {
        Args: { p_invoice: string; p_order: string; p_url: string }
        Returns: undefined
      }
      crypto_deposit_open: {
        Args: { p_amount: number; p_device: string; p_key: string }
        Returns: Json
      }
      crypto_deposit_settle: {
        Args: {
          p_order: string
          p_pay_currency: string
          p_price: number
          p_status: string
        }
        Returns: Json
      }
      decode_attachment_path: { Args: { p_path: string }; Returns: string }
      etok_are_friends: {
        Args: { p_owner: string; p_viewer: string }
        Returns: boolean
      }
      etok_live_active: { Args: { p_id: string }; Returns: boolean }
      etok_not_blocked: {
        Args: { p_owner: string; p_viewer: string }
        Returns: boolean
      }
      etok_valid_signal: {
        Args: { p_from: string; p_kind: string; p_stream: string; p_to: string }
        Returns: boolean
      }
      feature_media_path: {
        Args: { p_bucket: string; p_source: string }
        Returns: string
      }
      find_or_create_chat: {
        Args: { user1_id: string; user2_id: string }
        Returns: string
      }
      get_ai_quota_status: {
        Args: { p_user_id?: string }
        Returns: {
          daily_limit: number
          is_premium: boolean
          premium_expires_at: string
          used: number
        }[]
      }
      get_channel_posts_page: {
        Args: { p_before?: string; p_before_id?: string; p_channel_id: string }
        Returns: {
          channel_id: string
          content: string
          created_at: string
          edited: boolean
          id: string
          reactions: Json
          sender_id: string
          sender_name: string
          type: string
          views: number
        }[]
      }
      get_channel_posts_safe: {
        Args: { p_channel_id: string }
        Returns: {
          channel_id: string
          content: string
          created_at: string
          edited: boolean
          id: string
          reactions: Json
          sender_id: string
          sender_name: string
          type: string
          views: number
        }[]
      }
      get_my_private_profile: {
        Args: never
        Returns: {
          birthday: string
          phone: string
        }[]
      }
      get_or_create_etok_coins: { Args: never; Returns: number }
      get_profile_access_state: { Args: { p_subject: string }; Returns: string }
      get_profiles_safe: { Args: { p_ids: string[] }; Returns: Json }
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
      get_stars_balance: { Args: never; Returns: number }
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
      has_recent_otp: { Args: { p_seconds?: number }; Returns: boolean }
      has_wallet_pin: { Args: never; Returns: boolean }
      heartbeat_etok_live: { Args: { p_id: string }; Returns: boolean }
      is_channel_owner: {
        Args: { _channel_id: string; _uid: string }
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
      is_group_member_muted: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      mute_group_member: {
        Args: {
          p_group_id: string
          p_mute: boolean
          p_muted_until?: string
          p_user_id: string
        }
        Returns: undefined
      }
      notification_identity_allowed: {
        Args: { p_subject: string; p_viewer: string }
        Returns: boolean
      }
      notification_profile_name: {
        Args: { p_subject: string; p_viewer: string }
        Returns: string
      }
      profile_access_allowed: {
        Args: { p_subject: string; p_viewer: string }
        Returns: boolean
      }
      purchase_ai_premium: {
        Args: { p_method: string; p_plan: string }
        Returns: {
          expires_at: string
          success: boolean
        }[]
      }
      purchase_ai_premium_secure: {
        Args: {
          p_device?: string
          p_key: string
          p_method: string
          p_pin?: string
          p_plan: string
        }
        Returns: Json
      }
      purchase_stars_with_wallet:
        | {
            Args: {
              p_bonus: number
              p_idempotency_key?: string
              p_price: number
              p_stars: number
            }
            Returns: {
              balance: number
              purchase_id: string
              success: boolean
              wallet_balance: number
            }[]
          }
        | {
            Args: {
              p_bonus: number
              p_device: string
              p_idempotency_key: string
              p_pin: string
              p_price: number
              p_stars: number
            }
            Returns: Json
          }
      record_channel_views: {
        Args: { p_channel_id: string }
        Returns: undefined
      }
      record_etok_video_interaction: {
        Args: { _kind: string; _video_id: string }
        Returns: undefined
      }
      record_etok_video_view: {
        Args: { _source?: string; _video_id: string }
        Returns: undefined
      }
      register_device_token: {
        Args: { p_platform?: string; p_token: string; p_user_agent?: string }
        Returns: string
      }
      resolve_payment_destination: {
        Args: { p_request?: string; p_user?: string; p_username?: string }
        Returns: Json
      }
      respond_payment_request: {
        Args: { p_action: string; p_id: string }
        Returns: string
      }
      search_etok_videos: {
        Args: { p_query: string }
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "etok_videos"
          isOneToOne: false
          isSetofReturn: true
        }
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
      send_chat_gift: {
        Args: {
          p_chat_id: string
          p_gift_id: string
          p_message: string
          p_receiver_id: string
          p_stars: number
        }
        Returns: {
          balance: number
          gift_instance_id: string
          success: boolean
        }[]
      }
      send_etok_live_gift: {
        Args: {
          p_coins: number
          p_gift_emoji: string
          p_gift_id: string
          p_gift_name: string
          p_recipient_id: string
          p_stream_id: string
        }
        Returns: {
          balance: number
          success: boolean
        }[]
      }
      set_etok_like: {
        Args: { p_liked: boolean; p_video: string }
        Returns: Json
      }
      set_wallet_pin: { Args: { p_pin: string }; Returns: undefined }
      story_content_privacy: { Args: { p_content: string }; Returns: string }
      story_notification_allowed: {
        Args: { p_story: string; p_viewer: string }
        Returns: boolean
      }
      toggle_channel_reaction: {
        Args: { p_add: boolean; p_emoji: string; p_post_id: string }
        Returns: Json
      }
      unregister_device_token: { Args: { p_token: string }; Returns: undefined }
      verify_wallet_pin: {
        Args: { p_pin: string; p_user_id: string }
        Returns: boolean
      }
      wallet_activate_secure: {
        Args: { p_agent: string; p_device: string; p_ip: string }
        Returns: Json
      }
      wallet_deposit_request: {
        Args: {
          p_amount: number
          p_device: string
          p_key: string
          p_method: string
        }
        Returns: Json
      }
      wallet_pin_error: {
        Args: { p_pin: string; p_user: string }
        Returns: string
      }
      wallet_purchase_error: {
        Args: { p_amount: number; p_device: string; p_pin: string }
        Returns: string
      }
      wallet_transfer_atomic: {
        Args: {
          p_amount: number
          p_device: string
          p_key: string
          p_note: string
          p_pin: string
          p_recipient: string
          p_request?: string
        }
        Returns: Json
      }
      wallet_verify_own_pin: {
        Args: { p_device: string; p_pin: string }
        Returns: Json
      }
    }
    Enums: {
      verification_badge:
        | "official"
        | "press"
        | "business"
        | "government"
        | "premium"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      verification_badge: [
        "official",
        "press",
        "business",
        "government",
        "premium",
      ],
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
