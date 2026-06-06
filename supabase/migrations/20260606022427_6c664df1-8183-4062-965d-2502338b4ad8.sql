
-- Revert to permissive SELECT so contact/story/call lookups keep working.
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;

CREATE POLICY profiles_select
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Lock down sensitive columns at the column-grant level.
REVOKE SELECT (phone, birthday) ON public.profiles FROM authenticated, anon, PUBLIC;
GRANT SELECT (phone, birthday) ON public.profiles TO service_role;

-- Owner-only helper to read your own private fields.
CREATE OR REPLACE FUNCTION public.get_my_private_profile()
RETURNS TABLE (phone text, birthday date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.phone, p.birthday
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_private_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_private_profile() TO authenticated;

-- Drop the public-safe view (no longer needed; permissive policy + column
-- grants achieve the same goal without changing the client).
DROP VIEW IF EXISTS public.profiles_public;
