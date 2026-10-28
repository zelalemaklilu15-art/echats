DROP POLICY IF EXISTS "etok_follows_select" ON public.etok_follows;
CREATE POLICY "etok_follows_select" ON public.etok_follows FOR SELECT TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

DROP POLICY IF EXISTS "live_viewers_select" ON public.etok_live_viewers;
CREATE POLICY "live_viewers_select" ON public.etok_live_viewers FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.etok_live_streams s WHERE s.id = stream_id AND s.host_id = auth.uid()));

DROP POLICY IF EXISTS "live_comments_select" ON public.etok_live_comments;
CREATE POLICY "live_comments_select" ON public.etok_live_comments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.etok_live_streams s WHERE s.id = stream_id AND s.host_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.etok_live_viewers v WHERE v.stream_id = etok_live_comments.stream_id AND v.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "user_verifications_select" ON public.user_verifications;
CREATE POLICY "user_verifications_select" ON public.user_verifications FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.user_verifications FROM anon;