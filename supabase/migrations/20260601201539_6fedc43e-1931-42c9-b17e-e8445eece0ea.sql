-- Ensure existing Etok tables are reachable through the app data API.
GRANT SELECT ON public.etok_live_streams TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etok_live_streams TO authenticated;
GRANT ALL ON public.etok_live_streams TO service_role;

GRANT SELECT ON public.etok_live_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etok_live_comments TO authenticated;
GRANT ALL ON public.etok_live_comments TO service_role;

GRANT SELECT ON public.etok_live_viewers TO anon;
GRANT SELECT, INSERT, DELETE ON public.etok_live_viewers TO authenticated;
GRANT ALL ON public.etok_live_viewers TO service_role;

GRANT SELECT ON public.etok_scheduled_lives TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etok_scheduled_lives TO authenticated;
GRANT ALL ON public.etok_scheduled_lives TO service_role;

GRANT SELECT ON public.etok_scheduled_reminders TO anon;
GRANT SELECT, INSERT, DELETE ON public.etok_scheduled_reminders TO authenticated;
GRANT ALL ON public.etok_scheduled_reminders TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.etok_coins TO authenticated;
GRANT ALL ON public.etok_coins TO service_role;

GRANT SELECT ON public.etok_gifts_sent TO anon;
GRANT SELECT, INSERT ON public.etok_gifts_sent TO authenticated;
GRANT ALL ON public.etok_gifts_sent TO service_role;

GRANT SELECT ON public.etok_sounds TO anon, authenticated;
GRANT ALL ON public.etok_sounds TO service_role;

GRANT SELECT ON public.etok_hashtags TO anon, authenticated;
GRANT ALL ON public.etok_hashtags TO service_role;

GRANT SELECT ON public.etok_video_analytics_daily TO authenticated;
GRANT INSERT, UPDATE ON public.etok_video_analytics_daily TO authenticated;
GRANT ALL ON public.etok_video_analytics_daily TO service_role;

GRANT SELECT ON public.etok_creator_rewards TO authenticated;
GRANT ALL ON public.etok_creator_rewards TO service_role;

GRANT SELECT ON public.etok_shop_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etok_shop_items TO authenticated;
GRANT ALL ON public.etok_shop_items TO service_role;

GRANT SELECT ON public.etok_series TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etok_series TO authenticated;
GRANT ALL ON public.etok_series TO service_role;

GRANT SELECT, INSERT ON public.etok_series_subscribers TO authenticated;
GRANT ALL ON public.etok_series_subscribers TO service_role;

GRANT SELECT, INSERT, DELETE ON public.etok_blocked_users TO authenticated;
GRANT ALL ON public.etok_blocked_users TO service_role;

GRANT SELECT, INSERT ON public.etok_reports TO authenticated;
GRANT ALL ON public.etok_reports TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.etok_privacy_settings TO authenticated;
GRANT ALL ON public.etok_privacy_settings TO service_role;

GRANT SELECT, INSERT, DELETE ON public.etok_webrtc_signals TO authenticated;
GRANT ALL ON public.etok_webrtc_signals TO service_role;

-- Allow the client to append analytics for the signed-in creator's videos.
DROP POLICY IF EXISTS "vad_insert_owner" ON public.etok_video_analytics_daily;
CREATE POLICY "vad_insert_owner"
ON public.etok_video_analytics_daily
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "vad_update_owner" ON public.etok_video_analytics_daily;
CREATE POLICY "vad_update_owner"
ON public.etok_video_analytics_daily
FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

-- Backend helper: record a real video view and update both post counters and daily analytics.
CREATE OR REPLACE FUNCTION public.record_etok_video_view(_video_id uuid, _source text DEFAULT 'fyp')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id uuid;
  v_source text := coalesce(nullif(_source, ''), 'fyp');
BEGIN
  SELECT author_id INTO v_author_id
  FROM public.etok_videos
  WHERE id = _video_id;

  IF v_author_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.etok_videos
  SET views = coalesce(views, 0) + 1
  WHERE id = _video_id;

  INSERT INTO public.etok_video_analytics_daily (
    video_id, author_id, date, views, source_fyp, source_following, source_search, source_profile
  ) VALUES (
    _video_id,
    v_author_id,
    current_date,
    1,
    CASE WHEN v_source = 'fyp' THEN 1 ELSE 0 END,
    CASE WHEN v_source = 'following' THEN 1 ELSE 0 END,
    CASE WHEN v_source = 'search' THEN 1 ELSE 0 END,
    CASE WHEN v_source = 'profile' THEN 1 ELSE 0 END
  )
  ON CONFLICT (video_id, date) DO UPDATE SET
    views = public.etok_video_analytics_daily.views + 1,
    source_fyp = public.etok_video_analytics_daily.source_fyp + CASE WHEN v_source = 'fyp' THEN 1 ELSE 0 END,
    source_following = public.etok_video_analytics_daily.source_following + CASE WHEN v_source = 'following' THEN 1 ELSE 0 END,
    source_search = public.etok_video_analytics_daily.source_search + CASE WHEN v_source = 'search' THEN 1 ELSE 0 END,
    source_profile = public.etok_video_analytics_daily.source_profile + CASE WHEN v_source = 'profile' THEN 1 ELSE 0 END;
END;
$$;

-- Backend helper: update daily analytics counters for interactions.
CREATE OR REPLACE FUNCTION public.record_etok_video_interaction(_video_id uuid, _kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id uuid;
BEGIN
  SELECT author_id INTO v_author_id
  FROM public.etok_videos
  WHERE id = _video_id;

  IF v_author_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.etok_video_analytics_daily (video_id, author_id, date, likes, comments, shares)
  VALUES (
    _video_id,
    v_author_id,
    current_date,
    CASE WHEN _kind = 'like' THEN 1 ELSE 0 END,
    CASE WHEN _kind = 'comment' THEN 1 ELSE 0 END,
    CASE WHEN _kind = 'share' THEN 1 ELSE 0 END
  )
  ON CONFLICT (video_id, date) DO UPDATE SET
    likes = public.etok_video_analytics_daily.likes + CASE WHEN _kind = 'like' THEN 1 ELSE 0 END,
    comments = public.etok_video_analytics_daily.comments + CASE WHEN _kind = 'comment' THEN 1 ELSE 0 END,
    shares = public.etok_video_analytics_daily.shares + CASE WHEN _kind = 'share' THEN 1 ELSE 0 END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_etok_video_view(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_etok_video_interaction(uuid, text) TO authenticated, service_role;

-- Make realtime setup safe if it was already enabled by an earlier migration.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.etok_live_streams;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.etok_live_comments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.etok_live_viewers;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.etok_gifts_sent;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.etok_webrtc_signals;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.etok_videos;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;