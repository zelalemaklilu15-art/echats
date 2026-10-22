CREATE OR REPLACE FUNCTION public.purchase_stars_with_wallet(p_stars integer,p_bonus integer,p_price numeric,p_idempotency_key text,p_pin text,p_device text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); w public.wallets%ROWTYPE; t public.wallet_transactions%ROWTYPE; err text; k text; stars_balance integer; pid uuid;
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
  RETURN jsonb_build_object('success',true,'duplicate',true,'balance',(SELECT sb.balance FROM public.stars_balances sb WHERE sb.user_id=uid),'wallet_balance',w.balance);
 END IF;
 err:=public.wallet_purchase_error(p_pin,p_device,p_price);
 IF err IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error',err); END IF;
 BEGIN
  INSERT INTO public.wallet_transactions(wallet_id,type,status,amount,fee,balance_before,balance_after,description,idempotency_key,metadata)
  VALUES(w.id,'payment','completed',p_price,0,w.balance,w.balance-p_price,'Stars purchase',k,jsonb_build_object('kind','stars_purchase','stars',p_stars,'bonus_stars',p_bonus)) RETURNING * INTO t;
  INSERT INTO public.stars_balances(user_id,balance) VALUES(uid,100+p_stars)
  ON CONFLICT(user_id) DO UPDATE SET balance=public.stars_balances.balance+p_stars,updated_at=now() RETURNING public.stars_balances.balance INTO stars_balance;
  INSERT INTO public.stars_purchases(user_id,stars,bonus_stars,price,wallet_transaction_id) VALUES(uid,p_stars,p_bonus,p_price,t.id) RETURNING id INTO pid;
 EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error','Purchase failed. No money was moved. Please retry.'); END;
 RETURN jsonb_build_object('success',true,'balance',stars_balance,'purchase_id',pid,'wallet_balance',(SELECT ww.balance FROM public.wallets ww WHERE ww.id=w.id));
END $$;
REVOKE ALL ON FUNCTION public.purchase_stars_with_wallet(integer,integer,numeric,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.purchase_stars_with_wallet(integer,integer,numeric,text,text,text) TO authenticated;