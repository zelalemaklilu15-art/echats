ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS auto_replied boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.admin_user_detail(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'not found' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
    'is_banned', (u.banned_until IS NOT NULL AND u.banned_until > now()),
    'username', p.username, 'name', p.name, 'phone', p.phone, 'bio', p.bio, 'is_online', coalesce(p.is_online,false),
    'wallet', (SELECT jsonb_build_object('id', w.id, 'balance', w.balance, 'currency', w.currency, 'status', w.status) FROM wallets w WHERE w.user_id = u.id),
    'transactions', coalesce((SELECT jsonb_agg(t ORDER BY t.created_at DESC) FROM (
        SELECT t.id, t.type, t.amount, t.fee, t.status, t.description, t.created_at, t.balance_after
        FROM wallet_transactions t JOIN wallets w ON w.id = t.wallet_id WHERE w.user_id = u.id ORDER BY t.created_at DESC LIMIT 30) t), '[]'::jsonb),
    'tickets', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'subject', s.subject, 'status', s.status, 'created_at', s.created_at) ORDER BY s.created_at DESC) FROM support_tickets s WHERE s.user_id = u.id), '[]'::jsonb)
  ) INTO r
  FROM auth.users u LEFT JOIN profiles p ON p.id = u.id WHERE u.id = p_user;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.admin_wallet_adjust(p_user uuid, p_amount numeric, p_direction text, p_reason text, p_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_wallet uuid; v_tx uuid; v_bal numeric;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'not found' USING ERRCODE='42501'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF p_direction NOT IN ('credit','debit') THEN RAISE EXCEPTION 'Invalid direction'; END IF;
  IF coalesce(length(trim(p_reason)),0) < 3 THEN RAISE EXCEPTION 'Reason required'; END IF;
  SELECT id INTO v_tx FROM wallet_transactions WHERE idempotency_key = 'admin_adjust:' || p_key;
  IF v_tx IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'duplicate', true); END IF;
  SELECT id INTO v_wallet FROM wallets WHERE user_id = p_user FOR UPDATE;
  IF v_wallet IS NULL THEN
    IF p_direction = 'debit' THEN RAISE EXCEPTION 'User has no wallet'; END IF;
    INSERT INTO wallets(user_id, balance) VALUES (p_user, 0) RETURNING id INTO v_wallet;
  END IF;
  INSERT INTO wallet_transactions(wallet_id, type, status, amount, fee, balance_before, balance_after, description, idempotency_key, metadata)
  VALUES (v_wallet, CASE WHEN p_direction='credit' THEN 'bonus' ELSE 'fee' END::wallet_transaction_type, 'completed',
    round(p_amount,2), 0, 0, 0, left(trim(p_reason), 200), 'admin_adjust:' || p_key,
    jsonb_build_object('kind','ADMIN_ADJUSTMENT','admin_id',auth.uid(),'direction',p_direction))
  RETURNING id, balance_after INTO v_tx, v_bal;
  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx, 'balance', v_bal);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_wallet_status(p_user uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'not found' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  PERFORM set_config('app.allow_wallet_financial_update', 'true', true);
  UPDATE wallets SET status = p_status::wallet_status WHERE user_id = p_user;
  PERFORM set_config('app.allow_wallet_financial_update', 'false', true);
END $$;

REVOKE ALL ON FUNCTION public.admin_user_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_wallet_adjust(uuid, numeric, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_wallet_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_wallet_adjust(uuid, numeric, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_wallet_status(uuid, text) TO authenticated;