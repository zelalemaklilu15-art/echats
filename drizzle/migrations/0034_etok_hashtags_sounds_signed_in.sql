DROP POLICY IF EXISTS hashtags_select ON public.etok_hashtags;
CREATE POLICY hashtags_select ON public.etok_hashtags FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.etok_hashtags FROM anon;
DROP POLICY IF EXISTS sounds_select ON public.etok_sounds;
CREATE POLICY sounds_select ON public.etok_sounds FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.etok_sounds FROM anon;