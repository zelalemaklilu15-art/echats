DROP POLICY IF EXISTS user_verifications_select ON public.user_verifications;
CREATE POLICY user_verifications_select ON public.user_verifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.can_read_profile(user_id));
REVOKE SELECT ON public.user_verifications FROM anon;
GRANT SELECT ON public.user_verifications TO authenticated;
GRANT ALL ON public.user_verifications TO service_role;