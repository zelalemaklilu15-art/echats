DROP POLICY IF EXISTS sounds_select ON public.etok_sounds;
CREATE POLICY sounds_select ON public.etok_sounds FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR (author_id IS NOT NULL AND public.can_read_profile(author_id)));