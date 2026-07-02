
-- =========================================================================
-- 1. GROUP MEMBERS: prevent self-promotion to admin role
-- =========================================================================
DROP POLICY IF EXISTS gm_insert ON public.group_members;
CREATE POLICY gm_insert ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_id AND role = 'member')
    OR public.is_group_admin(group_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.created_by = auth.uid())
  );

-- =========================================================================
-- 2. ETOK_VIDEOS: prevent counter/sponsored inflation via direct writes
-- =========================================================================
DROP POLICY IF EXISTS etok_videos_update ON public.etok_videos;
CREATE POLICY etok_videos_update ON public.etok_videos
  FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (
    auth.uid() = author_id
    -- freeze counters and sponsored flag
    AND views = (SELECT views FROM public.etok_videos WHERE id = etok_videos.id)
    AND likes = (SELECT likes FROM public.etok_videos WHERE id = etok_videos.id)
    AND comments = (SELECT comments FROM public.etok_videos WHERE id = etok_videos.id)
    AND shares = (SELECT shares FROM public.etok_videos WHERE id = etok_videos.id)
    AND is_sponsored = (SELECT is_sponsored FROM public.etok_videos WHERE id = etok_videos.id)
    AND author_id = (SELECT author_id FROM public.etok_videos WHERE id = etok_videos.id)
  );

-- =========================================================================
-- 3. ETOK_LIVE_STREAMS: freeze viewer_count and gift_total
-- =========================================================================
DROP POLICY IF EXISTS live_streams_update ON public.etok_live_streams;
CREATE POLICY live_streams_update ON public.etok_live_streams
  FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (
    auth.uid() = host_id
    AND viewer_count = (SELECT viewer_count FROM public.etok_live_streams WHERE id = etok_live_streams.id)
    AND gift_total   = (SELECT gift_total   FROM public.etok_live_streams WHERE id = etok_live_streams.id)
    AND host_id      = (SELECT host_id      FROM public.etok_live_streams WHERE id = etok_live_streams.id)
  );

-- =========================================================================
-- 4. MESSAGES: receiver cannot edit content, only status
-- =========================================================================
DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update ON public.messages
  FOR UPDATE TO authenticated
  USING ((auth.uid() = sender_id) OR (auth.uid() = receiver_id))
  WITH CHECK (
    -- Sender can edit anything about their own message
    (auth.uid() = sender_id AND sender_id = (SELECT sender_id FROM public.messages WHERE id = messages.id))
    OR
    -- Receiver can only touch rows where sensitive fields are unchanged
    (auth.uid() = receiver_id
      AND content    IS NOT DISTINCT FROM (SELECT content    FROM public.messages WHERE id = messages.id)
      AND media_url  IS NOT DISTINCT FROM (SELECT media_url  FROM public.messages WHERE id = messages.id)
      AND file_name  IS NOT DISTINCT FROM (SELECT file_name  FROM public.messages WHERE id = messages.id)
      AND sender_id  = (SELECT sender_id  FROM public.messages WHERE id = messages.id)
      AND receiver_id = (SELECT receiver_id FROM public.messages WHERE id = messages.id)
    )
  );

-- =========================================================================
-- 5. STARS_BALANCES / STARS_GIFTS / ETOK_GIFTS_SENT / ETOK_VIDEO_ANALYTICS /
--    ETOK_CREATOR_REWARDS: revoke direct write access (writes only via
--    SECURITY DEFINER RPCs / service_role).
-- =========================================================================
REVOKE INSERT, UPDATE, DELETE ON public.stars_balances FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.stars_gifts FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.etok_gifts_sent FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.etok_video_analytics_daily FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.etok_creator_rewards FROM authenticated, anon;

-- Ensure service_role keeps full access
GRANT ALL ON public.stars_balances TO service_role;
GRANT ALL ON public.stars_gifts TO service_role;
GRANT ALL ON public.etok_gifts_sent TO service_role;
GRANT ALL ON public.etok_video_analytics_daily TO service_role;
GRANT ALL ON public.etok_creator_rewards TO service_role;

-- =========================================================================
-- 6. PROFILES: hide phone/birthday from other users at the column level
-- =========================================================================
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, username, name, avatar_url, bio, is_online, last_seen, is_active, created_at, updated_at)
  ON public.profiles TO authenticated;
-- Owner still reads phone/birthday via public.get_my_private_profile() (SECURITY DEFINER)

-- =========================================================================
-- 7. REALTIME: restrict broadcast/presence INSERTs to authorized topics
-- =========================================================================
DROP POLICY IF EXISTS realtime_authenticated_insert ON realtime.messages;
CREATE POLICY realtime_authenticated_insert ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (realtime.topic() LIKE ('user:' || auth.uid()::text || '%'))
    OR (realtime.topic() LIKE 'chat:%' AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id::text = SUBSTRING(realtime.topic() FROM 6)
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    ))
    OR (realtime.topic() LIKE 'group:%' AND public.is_group_member(
      (SUBSTRING(realtime.topic() FROM 7))::uuid, auth.uid()
    ))
    OR (realtime.topic() LIKE ('rtc:'  || auth.uid()::text || '%'))
    OR (realtime.topic() LIKE ('rtc-'  || auth.uid()::text || '%'))
    OR (realtime.topic() LIKE ('call:' || auth.uid()::text || '%'))
    OR (realtime.topic() LIKE ('calls:'|| auth.uid()::text || '%'))
    OR (realtime.topic() LIKE 'live:%' AND EXISTS (
      SELECT 1 FROM public.etok_live_streams s
      WHERE s.id::text = SUBSTRING(realtime.topic() FROM 6)
        AND (s.host_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.etok_live_viewers v WHERE v.stream_id = s.id AND v.user_id = auth.uid()
        ))
    ))
    OR (realtime.topic() LIKE 'live-stream-%' AND EXISTS (
      SELECT 1 FROM public.etok_live_streams s
      WHERE s.id::text = SUBSTRING(realtime.topic() FROM 13)
        AND (s.host_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.etok_live_viewers v WHERE v.stream_id = s.id AND v.user_id = auth.uid()
        ))
    ))
    OR (realtime.topic() LIKE 'live-comments-%' AND EXISTS (
      SELECT 1 FROM public.etok_live_streams s
      WHERE s.id::text = SUBSTRING(realtime.topic() FROM 15)
        AND (s.host_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.etok_live_viewers v WHERE v.stream_id = s.id AND v.user_id = auth.uid()
        ))
    ))
  );

-- =========================================================================
-- 8. USER_VERIFICATIONS: server-controlled badges
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.verification_badge AS ENUM ('official','press','business','government','premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_verifications (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  badge       public.verification_badge NOT NULL,
  verified_by text NOT NULL DEFAULT 'system',
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_verifications TO authenticated, anon;
GRANT ALL    ON public.user_verifications TO service_role;

ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_verifications_select ON public.user_verifications;
CREATE POLICY user_verifications_select ON public.user_verifications
  FOR SELECT USING (true);

DROP TRIGGER IF EXISTS trg_user_verifications_updated_at ON public.user_verifications;
CREATE TRIGGER trg_user_verifications_updated_at
  BEFORE UPDATE ON public.user_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 9. GROUP_MUTES + enforcement on group_messages
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.group_mutes (
  group_id    uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_until timestamptz,
  muted_by    uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

GRANT SELECT ON public.group_mutes TO authenticated;
GRANT ALL    ON public.group_mutes TO service_role;

ALTER TABLE public.group_mutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gmute_select ON public.group_mutes;
CREATE POLICY gmute_select ON public.group_mutes
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.is_group_member_muted(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_mutes
    WHERE group_id = _group_id AND user_id = _user_id
      AND (muted_until IS NULL OR muted_until > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.mute_group_member(
  p_group_id uuid, p_user_id uuid, p_mute boolean, p_muted_until timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT public.is_group_admin(p_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only group admins can mute members';
  END IF;

  IF p_mute THEN
    INSERT INTO public.group_mutes(group_id, user_id, muted_until, muted_by)
    VALUES (p_group_id, p_user_id, p_muted_until, auth.uid())
    ON CONFLICT (group_id, user_id) DO UPDATE
      SET muted_until = EXCLUDED.muted_until, muted_by = EXCLUDED.muted_by;
  ELSE
    DELETE FROM public.group_mutes WHERE group_id = p_group_id AND user_id = p_user_id;
  END IF;
END;
$$;

-- Enforce mute at INSERT time via BEFORE trigger
CREATE OR REPLACE FUNCTION public.enforce_group_mute()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.is_group_member_muted(NEW.group_id, NEW.sender_id) THEN
    RAISE EXCEPTION 'You are muted in this group';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_group_messages_mute_check ON public.group_messages;
CREATE TRIGGER trg_group_messages_mute_check
  BEFORE INSERT ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_mute();

-- =========================================================================
-- 10. WALLET PIN: server-side hashing + verification
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_wallet_pin(p_pin text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_pin !~ '^[0-9]{4,8}$' THEN RAISE EXCEPTION 'PIN must be 4-8 digits'; END IF;
  PERFORM set_config('app.allow_wallet_financial_update', 'true', true);
  UPDATE public.wallets
    SET pin_hash = crypt(p_pin, gen_salt('bf', 10)),
        updated_at = now()
    WHERE user_id = v_uid;
  PERFORM set_config('app.allow_wallet_financial_update', 'false', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_wallet_pin(p_user_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_hash text;
BEGIN
  SELECT pin_hash INTO v_hash FROM public.wallets WHERE user_id = p_user_id;
  IF v_hash IS NULL OR v_hash = '' THEN
    RETURN false;
  END IF;
  RETURN v_hash = crypt(p_pin, v_hash);
END;
$$;

CREATE OR REPLACE FUNCTION public.has_wallet_pin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(pin_hash, '') IS NOT NULL, false)
  FROM public.wallets WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.verify_wallet_pin(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_wallet_pin(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_wallet_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_wallet_pin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mute_group_member(uuid, uuid, boolean, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member_muted(uuid, uuid) TO authenticated;
