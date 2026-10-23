-- The comment guard must look up the post server-side, so it runs with owner rights
-- while still binding every client comment to the caller's own account.
CREATE OR REPLACE FUNCTION public.guard_channel_comment_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.author_id := auth.uid();
    IF char_length(btrim(NEW.text)) = 0 OR char_length(NEW.text) > 2000 THEN RAISE EXCEPTION 'Invalid comment'; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.channel_posts p WHERE p.id = NEW.post_id AND p.channel_id = NEW.channel_id AND p.comments_enabled) THEN
    RAISE EXCEPTION 'Comments are not available for this post';
  END IF;
  RETURN NEW;
END
$function$;