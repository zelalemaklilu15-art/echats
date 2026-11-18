CREATE OR REPLACE FUNCTION public.admin_list_etok_videos(p_limit int DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (
    SELECT v.id, v.description, v.video_url, v.thumbnail_url, v.views, v.likes, v.comments, v.privacy, v.created_at, u.email AS author_email
    FROM public.etok_videos v LEFT JOIN auth.users u ON u.id = v.author_id
    ORDER BY v.created_at DESC LIMIT LEAST(GREATEST(p_limit,1),500)) x), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_etok_video(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.etok_comments WHERE video_id = p_id;
  DELETE FROM public.etok_likes WHERE video_id = p_id;
  DELETE FROM public.etok_saved_videos WHERE video_id = p_id;
  DELETE FROM public.etok_video_analytics_daily WHERE video_id = p_id;
  DELETE FROM public.etok_video_view_receipts WHERE video_id = p_id;
  DELETE FROM public.etok_videos WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_communities()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'channels', COALESCE((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (
      SELECT c.id, c.name, c.description, c.is_public, c.subscriber_count, c.created_at, u.email AS owner_email,
        (SELECT count(*) FROM public.channel_posts p WHERE p.channel_id = c.id) AS posts
      FROM public.channels c LEFT JOIN auth.users u ON u.id = c.created_by ORDER BY c.created_at DESC LIMIT 300) x), '[]'::jsonb),
    'groups', COALESCE((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (
      SELECT g.id, g.name, g.description, g.created_at, u.email AS owner_email,
        (SELECT count(*) FROM public.group_members m WHERE m.group_id = g.id) AS members,
        (SELECT count(*) FROM public.group_messages m WHERE m.group_id = g.id) AS messages
      FROM public.groups g LEFT JOIN auth.users u ON u.id = g.created_by ORDER BY g.created_at DESC LIMIT 300) x), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_channel(p_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.channel_post_comments WHERE channel_id = p_id;
  DELETE FROM public.channel_posts WHERE channel_id = p_id;
  DELETE FROM public.channel_subscribers WHERE channel_id = p_id;
  DELETE FROM public.channels WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_group(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.group_messages WHERE group_id = p_id;
  DELETE FROM public.group_mutes WHERE group_id = p_id;
  DELETE FROM public.group_members WHERE group_id = p_id;
  DELETE FROM public.groups WHERE id = p_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_list_etok_videos(int), public.admin_delete_etok_video(uuid), public.admin_list_communities(), public.admin_delete_channel(text), public.admin_delete_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_etok_videos(int), public.admin_delete_etok_video(uuid), public.admin_list_communities(), public.admin_delete_channel(text), public.admin_delete_group(uuid) TO authenticated;