CREATE OR REPLACE FUNCTION public.admin_wallet_adjust(p_user uuid, p_amount numeric, p_direction text, p_reason text, p_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_wallet uuid; v_tx uuid; v_before numeric; v_after numeric; v_amt numeric := round(p_amount,2);
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'not found' USING ERRCODE='42501'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF p_direction NOT IN ('credit','debit') THEN RAISE EXCEPTION 'Invalid direction'; END IF;
  IF coalesce(length(trim(p_reason)),0) < 3 THEN RAISE EXCEPTION 'Reason required'; END IF;
  SELECT id INTO v_tx FROM wallet_transactions WHERE idempotency_key = 'admin_adjust:' || p_key;
  IF v_tx IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'duplicate', true); END IF;
  SELECT id, balance INTO v_wallet, v_before FROM wallets WHERE user_id = p_user FOR UPDATE;
  IF v_wallet IS NULL THEN
    IF p_direction = 'debit' THEN RAISE EXCEPTION 'User has no wallet'; END IF;
    INSERT INTO wallets(user_id, balance) VALUES (p_user, 0) RETURNING id, balance INTO v_wallet, v_before;
  END IF;
  v_after := CASE WHEN p_direction='credit' THEN v_before + v_amt ELSE v_before - v_amt END;
  IF v_after < 0 THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  PERFORM set_config('app.allow_wallet_financial_update', 'true', true);
  UPDATE wallets SET balance = v_after, updated_at = now() WHERE id = v_wallet;
  PERFORM set_config('app.allow_wallet_financial_update', 'false', true);
  INSERT INTO wallet_transactions(wallet_id, type, status, amount, fee, balance_before, balance_after, description, idempotency_key, metadata, completed_at)
  VALUES (v_wallet, CASE WHEN p_direction='credit' THEN 'bonus' ELSE 'fee' END::wallet_transaction_type, 'completed',
    v_amt, 0, v_before, v_after, left(trim(p_reason), 200), 'admin_adjust:' || p_key,
    jsonb_build_object('kind','ADMIN_ADJUSTMENT','admin_id',auth.uid(),'direction',p_direction), now())
  RETURNING id INTO v_tx;
  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx, 'balance', v_after);
END $$;
REVOKE ALL ON FUNCTION public.admin_wallet_adjust(uuid, numeric, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_wallet_adjust(uuid, numeric, text, text, uuid) TO authenticated;
