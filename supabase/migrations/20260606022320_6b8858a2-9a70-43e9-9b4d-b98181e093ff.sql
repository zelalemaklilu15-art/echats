
-- =====================================================================
-- 1. WALLETS: remove direct UPDATE access (balance/pin/status/limits)
-- =====================================================================
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.wallets;
DROP POLICY IF EXISTS wallets_update ON public.wallets;
DROP POLICY IF EXISTS "wallets_update" ON public.wallets;

-- (Re)assert SELECT-only for users; INSERT goes through edge functions / triggers.
-- Edge functions use service_role and bypass RLS, so no policy needed for them.

-- =====================================================================
-- 2. WALLET_TRANSACTIONS: remove direct INSERT access (prevents
--    self-credit via the balance-applying trigger).
-- =====================================================================
DROP POLICY IF EXISTS wallet_tx_insert ON public.wallet_transactions;
DROP POLICY IF EXISTS "wallet_tx_insert" ON public.wallet_transactions;

-- =====================================================================
-- 3. ETOK_COINS: remove direct UPDATE/INSERT access; coins flow through
--    SECURITY DEFINER functions on the server.
-- =====================================================================
DROP POLICY IF EXISTS coins_update ON public.etok_coins;
DROP POLICY IF EXISTS coins_insert ON public.etok_coins;

-- =====================================================================
-- 4. ETOK_VIDEO_ANALYTICS_DAILY: revoke direct INSERT/UPDATE from users.
--    Analytics are written via record_etok_video_view / _interaction.
-- =====================================================================
DROP POLICY IF EXISTS vad_insert_owner ON public.etok_video_analytics_daily;
DROP POLICY IF EXISTS vad_update_owner ON public.etok_video_analytics_daily;

-- =====================================================================
-- 5. PROFILES: stop exposing phone/birthday to every signed-in user.
--    - Tighten profiles_select to OWNER-ONLY.
--    - Add a public view that exposes only safe columns + grant it.
-- =====================================================================
DROP POLICY IF EXISTS profiles_select ON public.profiles;

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Public-safe view (no phone / no birthday). Already-present functions
-- get_public_profile() and search_users_public() let other users
-- discover safe profile info.
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true)
AS
SELECT
  id, username, name, avatar_url, bio,
  is_online, is_active, last_seen, created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated, anon;

-- Add a permissive SELECT policy for the public-safe columns by exposing
-- a definer function path: allow reading other users' rows ONLY through
-- get_public_profile / search_users_public (already SECURITY DEFINER).
-- This means direct table SELECT returns only your own row, but the
-- helper functions can still be used by the app for everyone-else lookups.

-- =====================================================================
-- 6. WALLET_TERMS_ACCEPTANCE: lock down audit trail (no UPDATE/DELETE).
-- =====================================================================
DROP POLICY IF EXISTS wta_update ON public.wallet_terms_acceptance;
DROP POLICY IF EXISTS wta_delete ON public.wallet_terms_acceptance;
-- (No new policies → users cannot UPDATE/DELETE their acceptance rows.)

-- =====================================================================
-- 7. ETOK_GIFTS_SENT: only sender / recipient can read.
-- =====================================================================
DROP POLICY IF EXISTS gifts_select ON public.etok_gifts_sent;
CREATE POLICY gifts_select_participants
  ON public.etok_gifts_sent
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- =====================================================================
-- 8. ETOK_SCHEDULED_REMINDERS: owner-only reads.
-- =====================================================================
DROP POLICY IF EXISTS rem_select ON public.etok_scheduled_reminders;
CREATE POLICY rem_select_own
  ON public.etok_scheduled_reminders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================================
-- 9. STORY_VIEWS: only story owner + viewer can see view records.
-- =====================================================================
DROP POLICY IF EXISTS sv_select ON public.story_views;
CREATE POLICY sv_select_authorized
  ON public.story_views
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = viewer_id
    OR EXISTS (
      SELECT 1 FROM public.user_stories s
      WHERE s.id = story_views.story_id
        AND s.user_id = auth.uid()
    )
  );

-- =====================================================================
-- 10. STORAGE: chat-media — require path ownership.
--     New uploads must use path "{auth.uid()}/..."  (enforced in client).
-- =====================================================================
DROP POLICY IF EXISTS chat_media_select ON storage.objects;
DROP POLICY IF EXISTS chat_media_view ON storage.objects;
DROP POLICY IF EXISTS chat_media_insert ON storage.objects;
DROP POLICY IF EXISTS chat_media_upload ON storage.objects;
DROP POLICY IF EXISTS chat_media_delete ON storage.objects;

CREATE POLICY chat_media_select_own
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY chat_media_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY chat_media_delete_own
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- =====================================================================
-- 11. PUBLIC BUCKETS: remove broad listing policies. Public buckets
--     still serve files via CDN getPublicUrl without RLS.
-- =====================================================================
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Etok videos are publicly accessible" ON storage.objects;

-- =====================================================================
-- 12. SECURITY DEFINER functions: lock down EXECUTE.
--     Helpers used inside RLS need authenticated execute.
--     Public lookup helpers are intentionally callable by authenticated.
--     None of these should be callable by anon.
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_wallet(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_wallet_balance(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_users_public(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_accepted_wallet_terms(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_or_create_chat(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_etok_video_view(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_etok_video_interaction(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_wallet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_wallet_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users_public(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_accepted_wallet_terms(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_chat(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_etok_video_view(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_etok_video_interaction(uuid, text) TO authenticated;

-- =====================================================================
-- 13. REALTIME: require authentication to subscribe to any channel.
-- =====================================================================
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS realtime_authenticated_only ON realtime.messages;
CREATE POLICY realtime_authenticated_only
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS realtime_authenticated_insert ON realtime.messages;
CREATE POLICY realtime_authenticated_insert
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
