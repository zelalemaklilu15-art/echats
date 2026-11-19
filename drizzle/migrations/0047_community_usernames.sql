ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.channels ADD CONSTRAINT channels_username_format CHECK (username IS NULL OR username ~ '^[a-z][a-z0-9_]{3,30}[a-z0-9]$');
ALTER TABLE public.groups ADD CONSTRAINT groups_username_format CHECK (username IS NULL OR username ~ '^[a-z][a-z0-9_]{3,30}[a-z0-9]$');
CREATE UNIQUE INDEX IF NOT EXISTS channels_username_uniq ON public.channels(username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS groups_username_uniq ON public.groups(username) WHERE username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.community_username_available(p_username text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT lower(p_username) ~ '^[a-z][a-z0-9_]{3,30}[a-z0-9]$'
    AND NOT EXISTS (SELECT 1 FROM public.channels WHERE username = lower(p_username))
    AND NOT EXISTS (SELECT 1 FROM public.groups WHERE username = lower(p_username))
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(p_username));
$$;

CREATE OR REPLACE FUNCTION public.set_community_username(p_kind text, p_id text, p_username text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_name text := nullif(lower(trim(coalesce(p_username,''))),'');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_kind = 'channel' THEN
    IF NOT EXISTS (SELECT 1 FROM public.channels WHERE id = p_id AND created_by = v_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF v_name IS NOT NULL AND v_name IS DISTINCT FROM (SELECT username FROM public.channels WHERE id = p_id)
       AND NOT public.community_username_available(v_name) THEN RAISE EXCEPTION 'username_taken'; END IF;
    UPDATE public.channels SET username = v_name WHERE id = p_id;
  ELSIF p_kind = 'group' THEN
    IF NOT public.is_group_admin(p_id::uuid, v_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF v_name IS NOT NULL AND v_name IS DISTINCT FROM (SELECT username FROM public.groups WHERE id = p_id::uuid)
       AND NOT public.community_username_available(v_name) THEN RAISE EXCEPTION 'username_taken'; END IF;
    UPDATE public.groups SET username = v_name, updated_at = now() WHERE id = p_id::uuid;
  ELSE RAISE EXCEPTION 'invalid_kind'; END IF;
  RETURN v_name;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_community_username(p_username text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object('kind','channel','id',c.id,'name',c.name,'description',c.description,'username',c.username,'members',c.subscriber_count)
       FROM public.channels c WHERE c.username = lower(p_username) AND c.is_public),
    (SELECT jsonb_build_object('kind','group','id',g.id,'name',g.name,'description',coalesce(g.description,''),'username',g.username,
       'members',(SELECT count(*) FROM public.group_members m WHERE m.group_id = g.id))
       FROM public.groups g WHERE g.username = lower(p_username)));
$$;

REVOKE ALL ON FUNCTION public.community_username_available(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_community_username(text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_community_username(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_username_available(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_community_username(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_community_username(text) TO authenticated;