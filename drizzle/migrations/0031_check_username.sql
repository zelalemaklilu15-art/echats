CREATE OR REPLACE FUNCTION public.check_username(p_username text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_username IS NULL OR lower(trim(p_username)) !~ '^[a-z0-9_]{3,30}$' THEN 'invalid'
    WHEN EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(trim(p_username))) THEN 'taken'
    ELSE 'available'
  END
$$;
REVOKE ALL ON FUNCTION public.check_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_username(text) TO anon, authenticated, service_role;