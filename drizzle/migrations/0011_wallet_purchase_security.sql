-- No existing financial records are modified. Legacy wallet-spend entrypoint becomes internal only.
REVOKE ALL ON FUNCTION public.purchase_stars_with_wallet(integer,integer,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_stars_with_wallet(integer,integer,numeric,text) TO service_role;
ALTER TABLE public.ai_premium_subscriptions ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS ai_premium_operation_key ON public.ai_premium_subscriptions(user_id,idempotency_key);

CREATE OR REPLACE FUNCTION public.wallet_purchase_error(p_pin text,p_device text,p_amount numeric)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); w public.wallets%ROWTYPE; err text; spent numeric;
BEGIN
 IF uid IS NULL THEN RETURN 'Unauthorized'; END IF;
 IF coalesce(length(p_device),0)<6 OR length(p_device)>200 THEN RETURN 'STEP_UP_REQUIRED'; END IF;
 IF public.check_wallet_device(p_device)<>'trusted' THEN RETURN 'STEP_UP_REQUIRED'; END IF;
 SELECT * INTO w FROM public.wallets WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND OR w.status<>'active' THEN RETURN 'Active wallet not found'; END IF;
 err:=public.wallet_pin_error(uid,p_pin);
 IF err IS NOT NULL THEN RETURN err; END IF;
 IF p_amount=0 THEN RETURN NULL; END IF;
 SELECT coalesce(sum(amount+fee),0) INTO spent FROM public.wallet_transactions WHERE wallet_id=w.id AND status='completed' AND type IN('transfer_out','payment','withdrawal') AND created_at>=date_trunc('day',now());
 IF spent+p_amount>w.daily_limit THEN RETURN 'Daily wallet limit exceeded'; END IF;
 SELECT coalesce(sum(amount+fee),0) INTO spent FROM public.wallet_transactions WHERE wallet_id=w.id AND status='completed' AND type IN('transfer_out','payment','withdrawal') AND created_at>=date_trunc('month',now());
 IF spent+p_amount>w.monthly_limit THEN RETURN 'Monthly wallet limit exceeded'; END IF;
 IF w.balance<p_amount THEN RETURN 'Insufficient wallet balance'; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.wallet_purchase_error(text,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_purchase_error(text,text,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.purchase_stars_with_wallet(p_stars integer,p_bonus integer,p_price numeric,p_idempotency_key text,p_pin text,p_device text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); w public.wallets%ROWTYPE; t public.wallet_transactions%ROWTYPE; err text; k text; result record;
BEGIN
 IF uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Unauthorized'); END IF;
 IF NOT coalesce((p_stars=100 AND p_bonus=0 AND p_price=120) OR (p_stars=500 AND p_bonus=0 AND p_price=550) OR (p_stars=2500 AND p_bonus=0 AND p_price=2400) OR (p_stars=10000 AND p_bonus=0 AND p_price=8900),false)
 OR coalesce(length(p_idempotency_key),0)<8 OR length(p_idempotency_key)>100 THEN RETURN jsonb_build_object('success',false,'error','Invalid Stars package or request'); END IF;
 err:=public.wallet_purchase_error(p_pin,p_device,0);
 IF err IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error',err); END IF;
 SELECT * INTO w FROM public.wallets WHERE user_id=uid;
 k:='stars:'||uid::text||':'||p_idempotency_key;
 SELECT * INTO t FROM public.wallet_transactions WHERE wallet_id=w.id AND idempotency_key=k;
 IF FOUND THEN
  IF t.amount<>p_price OR (t.metadata->>'stars')::integer IS DISTINCT FROM p_stars THEN RETURN jsonb_build_object('success',false,'error','Request key already used for another purchase'); END IF;
  RETURN jsonb_build_object('success',true,'duplicate',true,'balance',(SELECT balance FROM public.stars_balances WHERE user_id=uid),'wallet_balance',w.balance);
 END IF;
 err:=public.wallet_purchase_error(p_pin,p_device,p_price);
 IF err IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error',err); END IF;
 BEGIN
  SELECT * INTO result FROM public.purchase_stars_with_wallet(p_stars,p_bonus,p_price,k);
 EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error','Purchase failed. No money was moved. Please retry.'); END;
 RETURN to_jsonb(result);
END $$;
REVOKE ALL ON FUNCTION public.purchase_stars_with_wallet(integer,integer,numeric,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.purchase_stars_with_wallet(integer,integer,numeric,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.purchase_ai_premium_secure(p_plan text,p_method text,p_key text,p_pin text DEFAULT NULL,p_device text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); v_days integer; v_stars integer; v_birr numeric; w public.wallets%ROWTYPE; old public.ai_premium_subscriptions%ROWTYPE; sb integer; err text; expiry timestamptz; k text;
BEGIN
 IF uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Unauthorized'); END IF;
 IF p_plan='day' THEN v_days:=1; v_stars:=50; v_birr:=10;
 ELSIF p_plan='month' THEN v_days:=30; v_stars:=500; v_birr:=100;
 ELSE RETURN jsonb_build_object('success',false,'error','Invalid plan'); END IF;
 IF p_method IS NULL OR p_method NOT IN('stars','wallet') OR coalesce(length(p_key),0)<8 OR length(p_key)>100 THEN RETURN jsonb_build_object('success',false,'error','Invalid purchase'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ai-purchase:'||uid::text,0));
 IF p_method='wallet' THEN
  err:=public.wallet_purchase_error(p_pin,p_device,0);
  IF err IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error',err); END IF;
 END IF;
 SELECT * INTO old FROM public.ai_premium_subscriptions WHERE user_id=uid AND idempotency_key=p_key;
 IF FOUND THEN
  IF old.plan<>p_plan OR old.paid_with<>p_method THEN RETURN jsonb_build_object('success',false,'error','Request key already used for another purchase'); END IF;
  RETURN jsonb_build_object('success',true,'duplicate',true,'expires_at',old.expires_at);
 END IF;
 IF p_method='wallet' THEN
  err:=public.wallet_purchase_error(p_pin,p_device,v_birr);
  IF err IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error',err); END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id=uid;
 END IF;
 BEGIN
  IF p_method='stars' THEN
   INSERT INTO public.stars_balances(user_id,balance) VALUES(uid,100) ON CONFLICT DO NOTHING;
   SELECT balance INTO sb FROM public.stars_balances WHERE user_id=uid FOR UPDATE;
   IF sb<v_stars THEN RETURN jsonb_build_object('success',false,'error','Insufficient Stars'); END IF;
   UPDATE public.stars_balances SET balance=balance-v_stars,updated_at=now() WHERE user_id=uid;
  ELSE
   k:='ai:'||uid::text||':'||p_key;
   INSERT INTO public.wallet_transactions(wallet_id,type,status,amount,fee,balance_before,balance_after,description,idempotency_key,metadata)
   VALUES(w.id,'payment','completed',v_birr,0,w.balance,w.balance-v_birr,'Echat AI Premium',k,jsonb_build_object('kind','ai_premium','plan',p_plan));
  END IF;
  SELECT greatest(now(),coalesce(max(expires_at),now()))+make_interval(days=>v_days) INTO expiry FROM public.ai_premium_subscriptions WHERE user_id=uid;
  INSERT INTO public.ai_premium_subscriptions(user_id,plan,paid_with,amount,expires_at,idempotency_key) VALUES(uid,p_plan,p_method,CASE WHEN p_method='stars' THEN v_stars ELSE v_birr END,expiry,p_key);
 EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error','Purchase failed. Please retry.'); END;
 RETURN jsonb_build_object('success',true,'expires_at',expiry);
END $$;
REVOKE ALL ON FUNCTION public.purchase_ai_premium_secure(text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.purchase_ai_premium_secure(text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.purchase_ai_premium(p_plan text,p_method text)
RETURNS TABLE(success boolean,expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF p_method IS DISTINCT FROM 'stars' THEN RETURN QUERY SELECT false,NULL::timestamptz; RETURN; END IF;
 result:=public.purchase_ai_premium_secure(p_plan,p_method,gen_random_uuid()::text);
 RETURN QUERY SELECT coalesce((result->>'success')::boolean,false),(result->>'expires_at')::timestamptz;
END $$;