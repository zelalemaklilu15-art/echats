CREATE TABLE public.user_2fa_settings (
  user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_2fa_settings TO authenticated;
GRANT ALL ON public.user_2fa_settings TO service_role;
ALTER TABLE public.user_2fa_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own 2fa settings" ON public.user_2fa_settings FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.session_2fa_verifications (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.session_2fa_verifications TO service_role;
ALTER TABLE public.session_2fa_verifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.email_2fa_attempts (
  user_id uuid PRIMARY KEY,
  failed_count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz
);
GRANT ALL ON public.email_2fa_attempts TO service_role;
ALTER TABLE public.email_2fa_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_session_2fa_ok()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    NOT COALESCE((SELECT enabled FROM public.user_2fa_settings WHERE user_id = auth.uid()), false)
    OR EXISTS (SELECT 1 FROM public.session_2fa_verifications v
               WHERE v.user_id = auth.uid()
                 AND v.session_id::text = COALESCE(auth.jwt() ->> 'session_id', ''))
  );
$$;
REVOKE ALL ON FUNCTION public.is_session_2fa_ok() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_session_2fa_ok() TO authenticated;