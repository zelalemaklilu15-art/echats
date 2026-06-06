
-- 1) Profiles: remove broad USING(true) SELECT policy; rely on column grants.
DROP POLICY IF EXISTS profiles_select_public_columns ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own_full ON public.profiles;

CREATE POLICY profiles_select_safe ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- Ensure phone/birthday are NEVER selectable by authenticated (column-level)
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, username, name, avatar_url, bio, is_online, last_seen, is_active, created_at, updated_at)
  ON public.profiles TO authenticated;

-- 2) Realtime: drop permissive duplicate select
DROP POLICY IF EXISTS realtime_authenticated_only ON realtime.messages;

-- 3) Wallets: restrict client UPDATE to safe column only
REVOKE UPDATE ON public.wallets FROM authenticated;
GRANT UPDATE (terms_accepted) ON public.wallets TO authenticated;

-- 4) Gifts: insert restricted to authenticated role
DROP POLICY IF EXISTS gifts_insert ON public.etok_gifts_sent;
CREATE POLICY gifts_insert ON public.etok_gifts_sent
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- 5) SECURITY DEFINER hardening — revoke anon/public, keep only authenticated where needed
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_wallet_balance(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_wallet(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_private_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_accepted_wallet_terms(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_users_public(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_or_create_chat(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_etok_video_view(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_etok_video_interaction(uuid, text) FROM PUBLIC, anon;

-- Grant only to authenticated where clients legitimately invoke
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_wallet_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_wallet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_private_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_accepted_wallet_terms(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users_public(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_chat(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_etok_video_view(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_etok_video_interaction(uuid, text) TO authenticated;
