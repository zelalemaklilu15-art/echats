CREATE OR REPLACE FUNCTION public.search_users_public(search_term text)
 RETURNS TABLE(id uuid, username text, name text, avatar_url text, bio text, is_online boolean, last_seen timestamp with time zone, is_active boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH t AS (SELECT lower(trim(both '@' from trim(coalesce(search_term,'')))) AS q)
  SELECT p.id, p.username, p.name, p.avatar_url, p.bio, p.is_online, p.last_seen, p.is_active
  FROM public.profiles p, t
  WHERE length(t.q) >= 3
    AND p.id IS DISTINCT FROM auth.uid()
    AND (
      p.username ILIKE replace(replace(t.q,'%','\%'),'_','\_') || '%'
      OR (p.name ILIKE '%' || replace(replace(t.q,'%','\%'),'_','\_') || '%'
          AND EXISTS (SELECT 1 FROM public.chats c
                      WHERE (c.participant_1 = auth.uid() AND c.participant_2 = p.id)
                         OR (c.participant_2 = auth.uid() AND c.participant_1 = p.id)))
    )
  ORDER BY (p.username = t.q) DESC, p.username
  LIMIT 20;
$function$;
REVOKE EXECUTE ON FUNCTION public.search_users_public(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_users_public(text) TO authenticated, service_role;