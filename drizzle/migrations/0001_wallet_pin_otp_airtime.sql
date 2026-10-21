-- Step-up helper: true when the caller's session was verified by email code within the last 10 minutes
CREATE OR REPLACE FUNCTION public.has_recent_otp(p_seconds integer DEFAULT 600)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) e
    WHERE e->>'method' IN ('otp','magiclink','email/signup','recovery')
      AND (e->>'timestamp')::bigint >= extract(epoch from now())::bigint - p_seconds
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_recent_otp(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_recent_otp(integer) TO authenticated;

-- PIN: 4 or 6 digits; changing an existing PIN requires a fresh email code
CREATE OR REPLACE FUNCTION public.set_wallet_pin(p_pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_hash text; v_found boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_pin !~ '^([0-9]{4}|[0-9]{6})$' THEN RAISE EXCEPTION 'PIN must be 4 or 6 digits'; END IF;
  SELECT pin_hash, true INTO v_hash, v_found FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
  IF NOT coalesce(v_found,false) THEN RAISE EXCEPTION 'WALLET_NOT_FOUND'; END IF;
  IF coalesce(v_hash,'') <> '' AND NOT public.has_recent_otp(600) THEN
    RAISE EXCEPTION 'STEP_UP_REQUIRED';
  END IF;
  PERFORM set_config('app.allow_wallet_financial_update', 'true', true);
  UPDATE public.wallets SET pin_hash = crypt(p_pin, gen_salt('bf', 10)), updated_at = now() WHERE user_id = v_uid;
  PERFORM set_config('app.allow_wallet_financial_update', 'false', true);
  DELETE FROM public.wallet_pin_failures WHERE user_id = v_uid;
END $$;

-- Failed PIN attempts (lockout after 5 wrong tries for 15 minutes)
CREATE TABLE IF NOT EXISTS public.wallet_pin_failures (
  user_id uuid PRIMARY KEY,
  failed_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wallet_pin_failures TO service_role;
ALTER TABLE public.wallet_pin_failures ENABLE ROW LEVEL SECURITY;

-- Trusted devices (unrecognized device => email code before wallet access)
CREATE TABLE IF NOT EXISTS public.wallet_trusted_devices (
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_id)
);
GRANT SELECT ON public.wallet_trusted_devices TO authenticated;
GRANT ALL ON public.wallet_trusted_devices TO service_role;
ALTER TABLE public.wallet_trusted_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own trusted devices" ON public.wallet_trusted_devices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Returns 'trusted' | 'step_up_required'. First device ever is trusted automatically.
CREATE OR REPLACE FUNCTION public.check_wallet_device(p_device_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF coalesce(length(p_device_id),0) < 6 OR length(p_device_id) > 200 THEN RAISE EXCEPTION 'Invalid device'; END IF;
  IF EXISTS (SELECT 1 FROM public.wallet_trusted_devices WHERE user_id = v_uid AND device_id = p_device_id) THEN
    RETURN 'trusted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.wallet_trusted_devices WHERE user_id = v_uid)
     OR public.has_recent_otp(600) THEN
    INSERT INTO public.wallet_trusted_devices(user_id, device_id) VALUES (v_uid, p_device_id) ON CONFLICT DO NOTHING;
    RETURN 'trusted';
  END IF;
  RETURN 'step_up_required';
END $$;
REVOKE EXECUTE ON FUNCTION public.check_wallet_device(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_wallet_device(text) TO authenticated;

-- Airtime top-ups (recorded as pending until a real provider is connected)
CREATE TABLE IF NOT EXISTS public.airtime_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  wallet_transaction_id uuid,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.airtime_topups TO authenticated;
GRANT ALL ON public.airtime_topups TO service_role;
ALTER TABLE public.airtime_topups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own airtime topups" ON public.airtime_topups
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_airtime_topups_user ON public.airtime_topups(user_id, created_at DESC);

-- Atomic airtime purchase: PIN check, lockout, balance check, single deduction, idempotent
CREATE OR REPLACE FUNCTION public.airtime_topup(p_phone text, p_amount numeric, p_pin text, p_idempotency_key text)
RETURNS TABLE(success boolean, error text, balance numeric, topup_id uuid, duplicate boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_wallet public.wallets%ROWTYPE;
  v_fail public.wallet_pin_failures%ROWTYPE;
  v_existing public.airtime_topups%ROWTYPE;
  v_phone text;
  v_tx_id uuid;
  v_topup uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN QUERY SELECT false, 'Unauthorized', NULL::numeric, NULL::uuid, false; RETURN; END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 OR length(p_idempotency_key) > 100 THEN
    RETURN QUERY SELECT false, 'Invalid request', NULL::numeric, NULL::uuid, false; RETURN; END IF;

  v_phone := regexp_replace(coalesce(p_phone,''), '[\s-]', '', 'g');
  IF v_phone ~ '^\+?251[79][0-9]{8}$' THEN v_phone := '0' || right(v_phone, 9);
  ELSIF v_phone !~ '^0[79][0-9]{8}$' THEN
    RETURN QUERY SELECT false, 'Enter a valid Ethiopian mobile number', NULL::numeric, NULL::uuid, false; RETURN; END IF;

  IF p_amount IS NULL OR p_amount < 5 OR p_amount > 1000 OR p_amount <> round(p_amount, 2) THEN
    RETURN QUERY SELECT false, 'Amount must be between 5 and 1,000 ETB', NULL::numeric, NULL::uuid, false; RETURN; END IF;

  -- Lock the wallet row: serialises concurrent requests (no double-spend)
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'Wallet not found', NULL::numeric, NULL::uuid, false; RETURN; END IF;

  SELECT * INTO v_existing FROM public.airtime_topups WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.user_id <> v_uid THEN RETURN QUERY SELECT false, 'Invalid request', NULL::numeric, NULL::uuid, false; RETURN; END IF;
    RETURN QUERY SELECT true, NULL::text, v_wallet.balance, v_existing.id, true; RETURN;
  END IF;

  IF v_wallet.status <> 'active' THEN RETURN QUERY SELECT false, 'Wallet is not active', v_wallet.balance, NULL::uuid, false; RETURN; END IF;
  IF coalesce(v_wallet.pin_hash,'') = '' THEN RETURN QUERY SELECT false, 'PIN_NOT_SET', v_wallet.balance, NULL::uuid, false; RETURN; END IF;

  SELECT * INTO v_fail FROM public.wallet_pin_failures WHERE user_id = v_uid FOR UPDATE;
  IF FOUND AND v_fail.locked_until IS NOT NULL AND v_fail.locked_until > now() THEN
    RETURN QUERY SELECT false, 'Too many wrong PINs. Try again later.', v_wallet.balance, NULL::uuid, false; RETURN; END IF;

  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4,8}$' OR v_wallet.pin_hash <> crypt(p_pin, v_wallet.pin_hash) THEN
    INSERT INTO public.wallet_pin_failures(user_id, failed_count, locked_until, updated_at)
      VALUES (v_uid, 1, NULL, now())
      ON CONFLICT (user_id) DO UPDATE SET
        failed_count = CASE WHEN public.wallet_pin_failures.locked_until IS NOT NULL AND public.wallet_pin_failures.locked_until <= now() THEN 1 ELSE public.wallet_pin_failures.failed_count + 1 END,
        locked_until = CASE WHEN (CASE WHEN public.wallet_pin_failures.locked_until IS NOT NULL AND public.wallet_pin_failures.locked_until <= now() THEN 1 ELSE public.wallet_pin_failures.failed_count + 1 END) >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
        updated_at = now();
    RETURN QUERY SELECT false, 'Incorrect PIN', v_wallet.balance, NULL::uuid, false; RETURN;
  END IF;
  DELETE FROM public.wallet_pin_failures WHERE user_id = v_uid;

  IF v_wallet.balance < p_amount THEN
    RETURN QUERY SELECT false, 'Insufficient balance', v_wallet.balance, NULL::uuid, false; RETURN; END IF;

  -- Deduction happens in the existing balance trigger (also re-checks balance >= 0)
  INSERT INTO public.wallet_transactions(wallet_id, type, status, amount, fee, balance_before, balance_after, description, idempotency_key, metadata)
  VALUES (v_wallet.id, 'payment', 'completed', p_amount, 0, v_wallet.balance, v_wallet.balance - p_amount,
          'Airtime top-up ' || v_phone, 'airtime:' || p_idempotency_key,
          jsonb_build_object('kind','AIRTIME_TOPUP','phone',v_phone))
  RETURNING id INTO v_tx_id;

  INSERT INTO public.airtime_topups(user_id, phone, amount, status, wallet_transaction_id, idempotency_key)
  VALUES (v_uid, v_phone, p_amount, 'pending', v_tx_id, p_idempotency_key)
  RETURNING id INTO v_topup;

  RETURN QUERY SELECT true, NULL::text, (SELECT w.balance FROM public.wallets w WHERE w.id = v_wallet.id), v_topup, false;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, CASE WHEN SQLERRM ILIKE '%insufficient%' THEN 'Insufficient balance' ELSE 'Top-up failed. Please try again.' END, NULL::numeric, NULL::uuid, false;
END $$;
REVOKE EXECUTE ON FUNCTION public.airtime_topup(text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.airtime_topup(text, numeric, text, text) TO authenticated;