CREATE OR REPLACE FUNCTION public.apply_wallet_transaction_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  UPDATE public.wallets
  SET balance = v_current_balance + v_delta,
      updated_at = now()
  WHERE id = NEW.wallet_id;

  NEW.balance_before := v_current_balance;
  NEW.balance_after := v_current_balance + v_delta;
  NEW.completed_at := COALESCE(NEW.completed_at, now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_wallet_transaction_balance_insert ON public.wallet_transactions;

CREATE TRIGGER apply_wallet_transaction_balance_insert
BEFORE INSERT ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.apply_wallet_transaction_balance();