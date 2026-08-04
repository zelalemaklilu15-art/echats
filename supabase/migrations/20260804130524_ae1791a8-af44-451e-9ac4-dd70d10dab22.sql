CREATE TABLE IF NOT EXISTS public.etok_onboarding (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.etok_onboarding TO authenticated;
GRANT ALL ON public.etok_onboarding TO service_role;

ALTER TABLE public.etok_onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own etok onboarding" ON public.etok_onboarding;
CREATE POLICY "Users manage own etok onboarding"
ON public.etok_onboarding FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_etok_onboarding_updated_at ON public.etok_onboarding;
CREATE TRIGGER trg_etok_onboarding_updated_at
BEFORE UPDATE ON public.etok_onboarding
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();