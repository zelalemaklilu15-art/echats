CREATE OR REPLACE FUNCTION public.apply_wallet_transaction_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_delta numeric(15,2);
  v_current_balance numeric(15,2);
BEGIN
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  IF NEW.type IN ('deposit', 'transfer_in', 'refund', 'bonus') THEN
    v_delta := COALESCE(NEW.amount, 0) - COALESCE(NEW.fee, 0);
  ELSIF NEW.type IN ('withdrawal', 'transfer_out', 'payment', 'fee') THEN
    v_delta := -1 * (COALESCE(NEW.amount, 0) + COALESCE(NEW.fee, 0));
  ELSE
    v_delta := 0;
  END IF;

  SELECT balance INTO v_current_balance
  FROM public.wallets
  WHERE id = NEW.wallet_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF v_current_balance + v_delta < 0 THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  PERFORM set_config('app.allow_wallet_financial_update', 'true', true);

  UPDATE public.wallets
  SET balance = v_current_balance + v_delta,
      updated_at = now()
  WHERE id = NEW.wallet_id;

  PERFORM set_config('app.allow_wallet_financial_update', 'false', true);

  NEW.balance_before := v_current_balance;
  NEW.balance_after := v_current_balance + v_delta;
  NEW.completed_at := COALESCE(NEW.completed_at, now());

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_wallet_financial_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.allow_wallet_financial_update', true) = 'true'
     OR current_setting('request.jwt.claim.role', true) = 'service_role'
     OR coalesce(current_setting('request.jwt.claims', true)::json->>'role', '') = 'service_role'
     OR current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
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
$function$;