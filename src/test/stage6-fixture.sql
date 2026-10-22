CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,username text,name text);
CREATE TABLE public.profile_contacts(owner_id uuid,contact_user_id uuid,PRIMARY KEY(owner_id,contact_user_id));
CREATE TABLE storage.objects(bucket_id text,name text);
CREATE TABLE public.messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sender_id uuid,receiver_id uuid,media_url text);
CREATE TABLE public.group_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid,sender_id uuid,media_url text);
CREATE TABLE public.group_members(group_id uuid,user_id uuid);
CREATE FUNCTION public.is_group_member(uuid,uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.group_members WHERE group_id=$1 AND user_id=$2) $$;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON storage.objects TO authenticated;
CREATE POLICY chat_media_select_own ON storage.objects FOR SELECT TO authenticated USING(bucket_id='chat-media' AND split_part(name,'/',1)=auth.uid()::text);
CREATE FUNCTION public.can_read_profile(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1=auth.uid() $$;
CREATE TABLE public.user_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT,
  media_url TEXT,
  story_type TEXT NOT NULL DEFAULT 'text',
  background_color TEXT DEFAULT '#1a1a2e',
  views_count INTEGER DEFAULT 0,
  duration INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);
ALTER TABLE public.user_stories ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.user_stories TO authenticated;
CREATE POLICY "stories_select" ON public.user_stories FOR SELECT TO authenticated USING (true);
CREATE POLICY "stories_insert" ON public.user_stories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stories_delete" ON public.user_stories FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TABLE public.story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.user_stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.story_views TO authenticated;
CREATE POLICY "sv_select" ON public.story_views FOR SELECT TO authenticated USING (true);
CREATE POLICY "sv_insert" ON public.story_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);
CREATE TABLE IF NOT EXISTS public.etok_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  sound_name TEXT NOT NULL DEFAULT 'Original Sound',
  duration INTEGER NOT NULL DEFAULT 15,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  privacy TEXT NOT NULL DEFAULT 'everyone' CHECK (privacy IN ('everyone', 'friends', 'only_me')),
  allow_comments BOOLEAN NOT NULL DEFAULT true,
  allow_duet BOOLEAN NOT NULL DEFAULT true,
  allow_stitch BOOLEAN NOT NULL DEFAULT true,
  allow_download BOOLEAN NOT NULL DEFAULT true,
  is_sponsored BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.etok_videos ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.etok_videos TO authenticated;
CREATE POLICY "etok_videos_select" ON public.etok_videos FOR SELECT USING (privacy = 'everyone' OR auth.uid() = author_id);
CREATE POLICY "etok_videos_insert" ON public.etok_videos FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "etok_videos_update" ON public.etok_videos FOR UPDATE USING (auth.uid() = author_id);
CREATE TABLE IF NOT EXISTS public.etok_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  video_id UUID NOT NULL REFERENCES public.etok_videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, video_id)
);
ALTER TABLE public.etok_likes ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.etok_likes TO authenticated;
CREATE POLICY "etok_likes_select" ON public.etok_likes FOR SELECT USING (true);
CREATE POLICY "etok_likes_insert" ON public.etok_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "etok_likes_delete" ON public.etok_likes FOR DELETE USING (auth.uid() = user_id);
CREATE TABLE IF NOT EXISTS public.etok_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.etok_videos(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  text TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  parent_id UUID REFERENCES public.etok_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.etok_comments ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.etok_comments TO authenticated;
CREATE POLICY "etok_comments_select" ON public.etok_comments FOR SELECT USING (true);
CREATE POLICY "etok_comments_insert" ON public.etok_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "etok_comments_delete" ON public.etok_comments FOR DELETE USING (auth.uid() = author_id);
CREATE TABLE IF NOT EXISTS public.etok_follows (
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);
ALTER TABLE public.etok_follows ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.etok_follows TO authenticated;
CREATE POLICY "etok_follows_select" ON public.etok_follows FOR SELECT USING (true);
CREATE POLICY "etok_follows_insert" ON public.etok_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "etok_follows_delete" ON public.etok_follows FOR DELETE USING (auth.uid() = follower_id);
CREATE TABLE public.etok_live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Music',
  viewer_count integer NOT NULL DEFAULT 0,
  gift_total integer NOT NULL DEFAULT 0,
  thumbnail_color text NOT NULL DEFAULT 'from-violet-900 to-purple-900',
  thumbnail_emoji text NOT NULL DEFAULT '📡',
  is_live boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.etok_live_streams ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.etok_live_streams TO authenticated;
CREATE POLICY "live_streams_select" ON public.etok_live_streams FOR SELECT USING (true);
CREATE POLICY "live_streams_insert" ON public.etok_live_streams FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "live_streams_update" ON public.etok_live_streams FOR UPDATE USING (auth.uid() = host_id);
CREATE TABLE public.etok_live_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.etok_live_streams(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  text text NOT NULL,
  is_gift boolean NOT NULL DEFAULT false,
  gift_emoji text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.etok_live_comments ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.etok_live_comments TO authenticated;
CREATE POLICY "live_comments_select" ON public.etok_live_comments FOR SELECT USING (true);
CREATE POLICY "live_comments_insert" ON public.etok_live_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE TABLE public.etok_live_viewers (
  stream_id uuid NOT NULL REFERENCES public.etok_live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stream_id, user_id)
);
ALTER TABLE public.etok_live_viewers ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.etok_live_viewers TO authenticated;
CREATE POLICY "live_viewers_select" ON public.etok_live_viewers FOR SELECT USING (true);
CREATE POLICY "live_viewers_insert" ON public.etok_live_viewers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "live_viewers_delete" ON public.etok_live_viewers FOR DELETE USING (auth.uid() = user_id);
CREATE TABLE public.etok_video_analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.etok_videos(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  date date NOT NULL,
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  avg_watch_percent numeric(5,2) NOT NULL DEFAULT 0,
  source_fyp integer NOT NULL DEFAULT 0,
  source_following integer NOT NULL DEFAULT 0,
  source_search integer NOT NULL DEFAULT 0,
  source_profile integer NOT NULL DEFAULT 0,
  UNIQUE (video_id, date)
);
ALTER TABLE public.etok_video_analytics_daily ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.etok_video_analytics_daily TO authenticated;
CREATE POLICY "vad_select_owner" ON public.etok_video_analytics_daily FOR SELECT USING (auth.uid() = author_id);
CREATE TABLE public.etok_blocked_users (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
ALTER TABLE public.etok_blocked_users ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.etok_blocked_users TO authenticated;
CREATE POLICY "etok_blocks_select" ON public.etok_blocked_users FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "etok_blocks_insert" ON public.etok_blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "etok_blocks_delete" ON public.etok_blocked_users FOR DELETE USING (auth.uid() = blocker_id);
CREATE TABLE public.etok_privacy_settings (
  user_id uuid PRIMARY KEY,
  private_account boolean NOT NULL DEFAULT false,
  is_business_account boolean NOT NULL DEFAULT false,
  default_video_privacy text NOT NULL DEFAULT 'everyone' CHECK (default_video_privacy IN ('everyone','friends','only_me')),
  allow_comments text NOT NULL DEFAULT 'everyone' CHECK (allow_comments IN ('everyone','friends','no_one')),
  comment_keywords text[] NOT NULL DEFAULT '{}',
  filter_spam boolean NOT NULL DEFAULT true,
  duet_permission text NOT NULL DEFAULT 'everyone' CHECK (duet_permission IN ('everyone','friends','no_one')),
  stitch_permission text NOT NULL DEFAULT 'everyone' CHECK (stitch_permission IN ('everyone','friends','no_one')),
  allow_download boolean NOT NULL DEFAULT true,
  screen_time_limit_minutes integer NOT NULL DEFAULT 0,
  screen_time_reminder_enabled boolean NOT NULL DEFAULT false,
  screen_time_reminder_interval integer NOT NULL DEFAULT 30,
  family_pairing_linked boolean NOT NULL DEFAULT false,
  family_pairing_email text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.etok_privacy_settings ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.etok_privacy_settings TO authenticated;
CREATE POLICY "ps_select" ON public.etok_privacy_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ps_insert" ON public.etok_privacy_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ps_update" ON public.etok_privacy_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE TABLE public.etok_webrtc_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.etok_live_streams(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  signal_type text NOT NULL CHECK (signal_type IN ('offer','answer','ice','request')),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.etok_webrtc_signals ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.etok_webrtc_signals TO authenticated;
CREATE POLICY "rtc_select" ON public.etok_webrtc_signals FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "rtc_insert" ON public.etok_webrtc_signals FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "rtc_delete" ON public.etok_webrtc_signals FOR DELETE
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE TABLE public.etok_gifts_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.etok_live_streams(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  gift_id text NOT NULL,
  gift_emoji text NOT NULL,
  gift_name text NOT NULL,
  coins integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.etok_gifts_sent ENABLE ROW LEVEL SECURITY;GRANT ALL ON public.etok_gifts_sent TO authenticated;
CREATE POLICY "gifts_select" ON public.etok_gifts_sent FOR SELECT USING (true);
CREATE POLICY "gifts_insert" ON public.etok_gifts_sent FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE TABLE public.channels (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  avatar_color text NOT NULL DEFAULT 'hsl(210, 80%, 55%)',
  pinned_message_id text,
  link text,
  subscriber_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.channel_subscribers (
  channel_id text NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.channel_subscribers TO authenticated;
GRANT ALL ON public.channel_subscribers TO service_role;
ALTER TABLE public.channel_subscribers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.channel_posts (
  id text PRIMARY KEY,
  channel_id text NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_name text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 8000),
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text','image','announcement')),
  views integer NOT NULL DEFAULT 0,
  edited boolean NOT NULL DEFAULT false,
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX channel_posts_channel_idx ON public.channel_posts(channel_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_posts TO authenticated;
GRANT ALL ON public.channel_posts TO service_role;
ALTER TABLE public.channel_posts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_channel(_channel_id text, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.channels c WHERE c.id = _channel_id
    AND (c.is_public OR c.created_by = _uid
      OR EXISTS (SELECT 1 FROM public.channel_subscribers s WHERE s.channel_id = c.id AND s.user_id = _uid)));
$$;
CREATE OR REPLACE FUNCTION public.is_channel_owner(_channel_id text, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.channels WHERE id = _channel_id AND created_by = _uid);
$$;

CREATE POLICY "view channels" ON public.channels FOR SELECT TO authenticated
  USING (is_public OR created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.channel_subscribers s WHERE s.channel_id = id AND s.user_id = auth.uid()));
CREATE POLICY "create own channels" ON public.channels FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "owner updates channel" ON public.channels FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "owner deletes channel" ON public.channels FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "see own subscriptions" ON public.channel_subscribers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_channel_owner(channel_id, auth.uid()));
CREATE POLICY "subscribe self" ON public.channel_subscribers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "unsubscribe self" ON public.channel_subscribers FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "view posts" ON public.channel_posts FOR SELECT TO authenticated USING (public.can_view_channel(channel_id, auth.uid()));
CREATE POLICY "owner posts" ON public.channel_posts FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_channel_owner(channel_id, auth.uid()));
CREATE POLICY "owner edits posts" ON public.channel_posts FOR UPDATE TO authenticated
  USING (public.is_channel_owner(channel_id, auth.uid())) WITH CHECK (public.is_channel_owner(channel_id, auth.uid()));
CREATE POLICY "owner deletes posts" ON public.channel_posts FOR DELETE TO authenticated USING (public.is_channel_owner(channel_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.sync_channel_subscriber_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id text := COALESCE(NEW.channel_id, OLD.channel_id);
BEGIN
  UPDATE public.channels SET subscriber_count = (SELECT count(*) FROM public.channel_subscribers WHERE channel_id = v_id) WHERE id = v_id;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_channel_sub_count AFTER INSERT OR DELETE ON public.channel_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.sync_channel_subscriber_count();

CREATE OR REPLACE FUNCTION public.toggle_channel_reaction(p_post_id text, p_emoji text, p_add boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_post public.channel_posts%ROWTYPE; v_list jsonb; v_r jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_emoji IS NULL OR char_length(p_emoji) > 16 THEN RAISE EXCEPTION 'Invalid reaction'; END IF;
  SELECT * INTO v_post FROM public.channel_posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_view_channel(v_post.channel_id, v_uid) THEN RAISE EXCEPTION 'Not found'; END IF;
  v_list := COALESCE(v_post.reactions->p_emoji, '[]'::jsonb) - v_uid::text;
  IF p_add THEN v_list := v_list || to_jsonb(v_uid::text); END IF;
  IF jsonb_array_length(v_list) = 0 THEN v_r := v_post.reactions - p_emoji;
  ELSE v_r := jsonb_set(v_post.reactions, ARRAY[p_emoji], v_list); END IF;
  UPDATE public.channel_posts SET reactions = v_r WHERE id = p_post_id;
  RETURN v_r;
END $$;
REVOKE EXECUTE ON FUNCTION public.toggle_channel_reaction(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_channel_reaction(text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_channel_views(p_channel_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_view_channel(p_channel_id, auth.uid())
     OR public.is_channel_owner(p_channel_id, auth.uid()) THEN RETURN; END IF;
  UPDATE public.channel_posts SET views = views + 1 WHERE channel_id = p_channel_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_channel_views(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_channel_views(text) TO authenticated;

CREATE POLICY chat_media_select ON storage.objects FOR SELECT TO authenticated USING(bucket_id='chat-media');
CREATE POLICY chat_media_view ON storage.objects FOR SELECT TO authenticated USING(bucket_id='chat-media');
CREATE POLICY "Users can view non-expired stories" ON public.user_stories FOR SELECT TO authenticated USING(expires_at>now());
GRANT ALL ON public.profiles,public.profile_contacts TO authenticated;
