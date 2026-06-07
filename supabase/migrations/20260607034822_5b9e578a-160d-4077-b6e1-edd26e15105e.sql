CREATE OR REPLACE FUNCTION public.prevent_wallet_financial_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service-role Edge Functions and explicitly trusted backend RPC flows.
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR current_setting('app.allow_wallet_financial_update', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.balance IS DISTINCT FROM OLD.balance
     OR NEW.pin_hash IS DISTINCT FROM OLD.pin_hash
     OR NEW.daily_limit IS DISTINCT FROM OLD.daily_limit
     OR NEW.monthly_limit IS DISTINCT FROM OLD.monthly_limit
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Wallet financial fields can only be changed via server-side functions';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_stars_with_wallet(
  p_stars integer,
  p_bonus integer,
  p_price numeric,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE(success boolean, balance integer, purchase_id uuid, wallet_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_wallet_id uuid;
  v_wallet_balance numeric(15,2);
  v_purchase_id uuid;
  v_tx_id uuid;
  v_total integer;
  v_allowed boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_allowed :=
    (p_stars = 100 AND COALESCE(p_bonus, 0) = 0 AND p_price = 120)
    OR (p_stars = 500 AND COALESCE(p_bonus, 0) = 0 AND p_price = 550)
    OR (p_stars = 2500 AND COALESCE(p_bonus, 0) = 0 AND p_price = 2400)
    OR (p_stars = 10000 AND COALESCE(p_bonus, 0) = 0 AND p_price = 8900);

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid stars package';
  END IF;

  SELECT id, balance INTO v_wallet_id, v_wallet_balance
  FROM public.wallets
  WHERE user_id = v_user_id AND status = 'active'
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Active wallet not found';
  END IF;

  IF v_wallet_balance < p_price THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT sp.id INTO v_purchase_id
    FROM public.stars_purchases sp
    JOIN public.wallet_transactions wt ON wt.id = sp.wallet_transaction_id
    WHERE sp.user_id = v_user_id
      AND wt.idempotency_key = p_idempotency_key
    LIMIT 1;

    IF v_purchase_id IS NOT NULL THEN
      SELECT sb.balance INTO balance FROM public.stars_balances sb WHERE sb.user_id = v_user_id;
      SELECT w.balance INTO wallet_balance FROM public.wallets w WHERE w.id = v_wallet_id;
      success := true;
      purchase_id := v_purchase_id;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  PERFORM set_config('app.allow_wallet_financial_update', 'true', true);

  INSERT INTO public.wallet_transactions(
    wallet_id, type, status, amount, fee, balance_before, balance_after,
    description, idempotency_key, metadata, completed_at
  ) VALUES (
    v_wallet_id, 'payment', 'completed', p_price, 0, v_wallet_balance, v_wallet_balance - p_price,
    'Stars purchase', p_idempotency_key,
    jsonb_build_object('kind', 'stars_purchase', 'stars', p_stars, 'bonus_stars', COALESCE(p_bonus, 0)),
    now()
  ) RETURNING id INTO v_tx_id;

  PERFORM set_config('app.allow_wallet_financial_update', 'false', true);

  v_total := p_stars + COALESCE(p_bonus, 0);

  INSERT INTO public.stars_balances(user_id, balance)
  VALUES (v_user_id, 100 + v_total)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.stars_balances.balance + v_total,
        updated_at = now()
  RETURNING public.stars_balances.balance INTO balance;

  INSERT INTO public.stars_purchases(user_id, stars, bonus_stars, price, wallet_transaction_id)
  VALUES (v_user_id, p_stars, COALESCE(p_bonus, 0), p_price, v_tx_id)
  RETURNING id INTO v_purchase_id;

  success := true;
  purchase_id := v_purchase_id;
  wallet_balance := v_wallet_balance - p_price;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_stars_with_wallet(integer, integer, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_stars_with_wallet(integer, integer, numeric, text) TO authenticated;