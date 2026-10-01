CREATE TABLE public.ai_usage_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT current_date,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT ON public.ai_usage_daily TO authenticated;
GRANT ALL ON public.ai_usage_daily TO service_role;
ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own AI usage" ON public.ai_usage_daily FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.ai_premium_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL,
  paid_with text NOT NULL,
  amount numeric NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_premium_subscriptions TO authenticated;
GRANT ALL ON public.ai_premium_subscriptions TO service_role;
ALTER TABLE public.ai_premium_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own AI premium" ON public.ai_premium_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_ai_quota_status(p_user_id uuid DEFAULT NULL)
RETURNS TABLE(used integer, daily_limit integer, is_premium boolean, premium_expires_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := COALESCE(auth.uid(), p_user_id);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND p_user_id <> auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT COALESCE((SELECT u.count FROM ai_usage_daily u WHERE u.user_id = v_uid AND u.day = current_date), 0) INTO used;
  daily_limit := 15;
  SELECT max(s.expires_at) INTO premium_expires_at FROM ai_premium_subscriptions s WHERE s.user_id = v_uid AND s.expires_at > now();
  is_premium := premium_expires_at IS NOT NULL;
  RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.get_ai_quota_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_quota_status(uuid) TO authenticated, service_role;

-- server-only: consume one request
CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_user_id uuid)
RETURNS TABLE(allowed boolean, used integer, daily_limit integer, is_premium boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  daily_limit := 15;
  is_premium := EXISTS (SELECT 1 FROM ai_premium_subscriptions s WHERE s.user_id = p_user_id AND s.expires_at > now());
  INSERT INTO ai_usage_daily(user_id, day, count) VALUES (p_user_id, current_date, 0) ON CONFLICT DO NOTHING;
  SELECT u.count INTO v_count FROM ai_usage_daily u WHERE u.user_id = p_user_id AND u.day = current_date FOR UPDATE;
  IF NOT is_premium AND v_count >= daily_limit THEN
    allowed := false; used := v_count; RETURN NEXT; RETURN;
  END IF;
  UPDATE ai_usage_daily SET count = count + 1, updated_at = now() WHERE user_id = p_user_id AND day = current_date;
  allowed := true; used := v_count + 1; RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.consume_ai_quota(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.purchase_ai_premium(p_plan text, p_method text)
RETURNS TABLE(success boolean, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_days integer; v_stars integer; v_birr numeric;
  v_wallet_id uuid; v_wallet_bal numeric; v_stars_bal integer;
  v_base timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_plan = 'day' THEN v_days := 1; v_stars := 50; v_birr := 10;
  ELSIF p_plan = 'month' THEN v_days := 30; v_stars := 500; v_birr := 100;
  ELSE RAISE EXCEPTION 'Invalid plan'; END IF;

  IF p_method = 'stars' THEN
    INSERT INTO stars_balances(user_id, balance) VALUES (v_uid, 100) ON CONFLICT (user_id) DO NOTHING;
    SELECT balance INTO v_stars_bal FROM stars_balances WHERE user_id = v_uid FOR UPDATE;
    IF v_stars_bal < v_stars THEN RAISE EXCEPTION 'Insufficient Stars'; END IF;
    UPDATE stars_balances SET balance = balance - v_stars, updated_at = now() WHERE user_id = v_uid;
  ELSIF p_method = 'wallet' THEN
    SELECT id, balance INTO v_wallet_id, v_wallet_bal FROM wallets WHERE user_id = v_uid AND status = 'active' FOR UPDATE;
    IF v_wallet_id IS NULL THEN RAISE EXCEPTION 'Active wallet not found'; END IF;
    IF v_wallet_bal < v_birr THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;
    INSERT INTO wallet_transactions(wallet_id, type, status, amount, fee, balance_before, balance_after, description, metadata, completed_at)
    VALUES (v_wallet_id, 'payment', 'completed', v_birr, 0, v_wallet_bal, v_wallet_bal - v_birr, 'Echat AI Premium',
      jsonb_build_object('kind','ai_premium','plan',p_plan), now());
  ELSE RAISE EXCEPTION 'Invalid payment method'; END IF;

  SELECT GREATEST(now(), COALESCE(max(s.expires_at), now())) INTO v_base FROM ai_premium_subscriptions s WHERE s.user_id = v_uid;
  expires_at := v_base + make_interval(days => v_days);
  INSERT INTO ai_premium_subscriptions(user_id, plan, paid_with, amount, expires_at)
  VALUES (v_uid, p_plan, p_method, CASE WHEN p_method='stars' THEN v_stars ELSE v_birr END, expires_at);
  success := true; RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.purchase_ai_premium(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_ai_premium(text, text) TO authenticated;