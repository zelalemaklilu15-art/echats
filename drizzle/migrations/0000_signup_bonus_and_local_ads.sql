ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS device_id text UNIQUE;

CREATE TABLE public.signup_bonus_claims (
  device_id text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  amount numeric(15,2) NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.signup_bonus_claims TO service_role;
ALTER TABLE public.signup_bonus_claims ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bonus_budget (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cap numeric(15,2) NOT NULL DEFAULT 100000,
  spent numeric(15,2) NOT NULL DEFAULT 0,
  bonus_amount numeric(15,2) NOT NULL DEFAULT 100
);
GRANT ALL ON public.bonus_budget TO service_role;
ALTER TABLE public.bonus_budget ENABLE ROW LEVEL SECURITY;
INSERT INTO public.bonus_budget (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_signup_bonus()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_device text := NULLIF(trim(NEW.raw_user_meta_data->>'device_id'), '');
  v_amount numeric(15,2);
  v_cap numeric(15,2);
  v_spent numeric(15,2);
  v_wallet uuid;
BEGIN
  IF OLD.email_confirmed_at IS NOT NULL OR NEW.email_confirmed_at IS NULL OR v_device IS NULL THEN
    RETURN NEW;
  END IF;
  BEGIN
    SELECT cap, spent, bonus_amount INTO v_cap, v_spent, v_amount FROM bonus_budget WHERE id = 1 FOR UPDATE;
    IF v_cap IS NULL OR v_spent + v_amount > v_cap THEN RETURN NEW; END IF;
    IF EXISTS (SELECT 1 FROM signup_bonus_claims WHERE device_id = v_device OR user_id = NEW.id) THEN RETURN NEW; END IF;

    INSERT INTO signup_bonus_claims(device_id, user_id, amount) VALUES (v_device, NEW.id, v_amount);
    UPDATE bonus_budget SET spent = spent + v_amount WHERE id = 1;

    SELECT id INTO v_wallet FROM wallets WHERE user_id = NEW.id;
    IF v_wallet IS NULL THEN
      INSERT INTO wallets(user_id, balance, device_id) VALUES (NEW.id, 0, v_device) RETURNING id INTO v_wallet;
    ELSE
      PERFORM set_config('app.allow_wallet_financial_update', 'true', true);
      UPDATE wallets SET device_id = COALESCE(device_id, v_device) WHERE id = v_wallet;
      PERFORM set_config('app.allow_wallet_financial_update', 'false', true);
    END IF;

    INSERT INTO wallet_transactions(wallet_id, type, status, amount, fee, balance_before, balance_after, description, idempotency_key, metadata)
    VALUES (v_wallet, 'bonus', 'completed', v_amount, 0, 0, 0, 'Signup bonus', 'signup_bonus:' || NEW.id,
      jsonb_build_object('kind', 'SIGNUP_BONUS', 'device_id', v_device));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'signup bonus skipped: %', SQLERRM;
  END;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_signup_bonus() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed_bonus ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed_bonus
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_signup_bonus();

CREATE TABLE public.local_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  image_url text,
  target_url text,
  price_etb numeric(15,2) NOT NULL DEFAULT 0 CHECK (price_etb >= 0),
  currency text NOT NULL DEFAULT 'ETB' CHECK (currency = 'ETB'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (target_url IS NULL OR target_url ~* '^https?://'),
  CHECK (image_url IS NULL OR image_url ~* '^https?://')
);
GRANT SELECT ON public.local_ads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.local_ads TO authenticated;
GRANT ALL ON public.local_ads TO service_role;
ALTER TABLE public.local_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active ads are public" ON public.local_ads FOR SELECT TO anon, authenticated USING (is_active OR owner_id = auth.uid());
CREATE POLICY "Owners create ads" ON public.local_ads FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update ads" ON public.local_ads FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete ads" ON public.local_ads FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE TRIGGER trg_local_ads_updated_at BEFORE UPDATE ON public.local_ads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_local_ads_active ON public.local_ads (is_active, created_at DESC);