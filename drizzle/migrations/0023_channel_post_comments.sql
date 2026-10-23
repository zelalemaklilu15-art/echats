-- Stage 2: comments under channel posts (Telegram-style discussion)

ALTER TABLE public.channel_posts
  ADD COLUMN IF NOT EXISTS comments_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0;

CREATE TABLE public.channel_post_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id text NOT NULL,
  channel_id text NOT NULL,
  author_id uuid NOT NULL,
  text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT channel_post_comments_pkey PRIMARY KEY (id),
  CONSTRAINT channel_post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.channel_posts(id) ON DELETE CASCADE,
  CONSTRAINT channel_post_comments_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS channel_post_comments_post_idx ON public.channel_post_comments (post_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.channel_post_comments TO authenticated;
GRANT ALL ON public.channel_post_comments TO service_role;

ALTER TABLE public.channel_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view channel comments" ON public.channel_post_comments FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND public.can_view_channel(channel_id, auth.uid()));
CREATE POLICY "author channel comments" ON public.channel_post_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_view_channel(channel_id, auth.uid()));
CREATE POLICY "delete channel comments" ON public.channel_post_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_channel_owner(channel_id, auth.uid()));

-- Comments must belong to a real post in the same channel, be non-empty, and the post must accept comments.
CREATE OR REPLACE FUNCTION public.guard_channel_comment_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    NEW.author_id := auth.uid();
    IF char_length(btrim(NEW.text)) = 0 OR char_length(NEW.text) > 2000 THEN RAISE EXCEPTION 'Invalid comment'; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.channel_posts p WHERE p.id = NEW.post_id AND p.channel_id = NEW.channel_id AND p.comments_enabled) THEN
    RAISE EXCEPTION 'Comments are not available for this post';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER trg_guard_channel_comment_insert BEFORE INSERT ON public.channel_post_comments
FOR EACH ROW EXECUTE FUNCTION public.guard_channel_comment_insert();

-- Comment counters are server-managed so clients cannot inflate them.
CREATE OR REPLACE FUNCTION public.sync_channel_comment_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.channel_posts SET comments_count = (SELECT count(*)::int FROM public.channel_post_comments c WHERE c.post_id = NEW.post_id) WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;
  UPDATE public.channel_posts SET comments_count = (SELECT count(*)::int FROM public.channel_post_comments c WHERE c.post_id = OLD.post_id) WHERE id = OLD.post_id;
  RETURN OLD;
END
$function$;

CREATE TRIGGER trg_sync_channel_comment_count AFTER INSERT OR DELETE ON public.channel_post_comments
FOR EACH ROW EXECUTE FUNCTION public.sync_channel_comment_count();

CREATE OR REPLACE FUNCTION public.guard_channel_post_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated','anon') AND NEW.comments_count IS DISTINCT FROM OLD.comments_count THEN
    RAISE EXCEPTION 'Comment counts are server-managed';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER trg_guard_channel_post_update BEFORE UPDATE ON public.channel_posts
FOR EACH ROW EXECUTE FUNCTION public.guard_channel_post_fields();

CREATE TRIGGER trg_push_channel_post_comments AFTER INSERT ON public.channel_post_comments
FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_event();

-- Comment list with author identity resolved under the same strict profile-access rules.
CREATE OR REPLACE FUNCTION public.get_channel_post_comments(p_post_id text)
 RETURNS TABLE(id uuid, post_id text, channel_id text, author_id uuid, author_name text, body text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id, c.post_id, c.channel_id, c.author_id,
    CASE WHEN public.can_read_profile(c.author_id) THEN coalesce(p.name, p.username, 'Hidden profile') ELSE 'Hidden profile' END,
    c.text, c.created_at
  FROM public.channel_post_comments c
  LEFT JOIN public.profiles p ON p.id = c.author_id
  WHERE auth.uid() IS NOT NULL AND c.post_id = p_post_id
    AND public.can_view_channel(c.channel_id, auth.uid())
  ORDER BY c.created_at, c.id LIMIT 200;
$function$;
GRANT EXECUTE ON FUNCTION public.get_channel_post_comments(text) TO authenticated, service_role;

-- Post pages now carry the comment state so the app can show the real counter and whether comments are open.
DROP FUNCTION IF EXISTS public.get_channel_posts_safe(text);
DROP FUNCTION IF EXISTS public.get_channel_posts_page(text, timestamp with time zone, text);

CREATE OR REPLACE FUNCTION public.get_channel_posts_page(p_channel_id text, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id text DEFAULT NULL::text)
 RETURNS TABLE(id text, channel_id text, sender_id uuid, sender_name text, content text, type text, views integer, edited boolean, reactions jsonb, created_at timestamp with time zone, comments_enabled boolean, comments_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT cp.id,cp.channel_id,cp.sender_id,CASE WHEN public.can_read_profile(cp.sender_id) THEN coalesce(p.name,p.username,'Hidden profile') ELSE 'Hidden profile' END,cp.content,cp.type,cp.views,cp.edited,cp.reactions,cp.created_at,cp.comments_enabled,cp.comments_count FROM public.channel_posts cp LEFT JOIN public.profiles p ON p.id=cp.sender_id WHERE auth.uid() IS NOT NULL AND cp.channel_id=p_channel_id AND public.can_view_channel(cp.channel_id,auth.uid()) AND (p_before IS NULL OR (cp.created_at,cp.id)<(p_before,coalesce(p_before_id,''))) ORDER BY cp.created_at DESC,cp.id DESC LIMIT 100; $function$;

CREATE OR REPLACE FUNCTION public.get_channel_posts_safe(p_channel_id text)
 RETURNS TABLE(id text, channel_id text, sender_id uuid, sender_name text, content text, type text, views integer, edited boolean, reactions jsonb, created_at timestamp with time zone, comments_enabled boolean, comments_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT * FROM public.get_channel_posts_page(p_channel_id,NULL,NULL) ORDER BY created_at,id; $function$;

GRANT EXECUTE ON FUNCTION public.get_channel_posts_page(text, timestamp with time zone, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_channel_posts_safe(text) TO authenticated, service_role;