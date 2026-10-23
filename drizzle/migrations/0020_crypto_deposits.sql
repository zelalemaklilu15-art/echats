CREATE TABLE public.crypto_deposits(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 wallet_transaction_id uuid NOT NULL UNIQUE,
 amount_usd numeric NOT NULL,
 status text NOT NULL DEFAULT 'waiting',
 provider_invoice_id text,
 invoice_url text,
 pay_currency text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crypto_deposits TO authenticated;
GRANT ALL ON public.crypto_deposits TO service_role;
ALTER TABLE public.crypto_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own crypto deposits" ON public.crypto_deposits FOR SELECT TO authenticated USING (user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.crypto_deposit_open(p_amount numeric,p_key text,p_device text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); w public.wallets%ROWTYPE; t public.wallet_transactions%ROWTYPE; d public.crypto_deposits%ROWTYPE; k text; total numeric; attempts integer;
BEGIN
 IF uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Unauthorized'); END IF;
 IF p_amount IS NULL OR p_amount<5 OR p_amount>10000 OR p_amount<>round(p_amount,2) OR coalesce(length(p_key),0)<8 OR length(p_key)>100 THEN RETURN jsonb_build_object('success',false,'error','Amount must be between 5 and 10,000'); END IF;
 IF coalesce(length(p_device),0)<6 OR public.check_wallet_device(p_device)<>'trusted' THEN RETURN jsonb_build_object('success',false,'error','STEP_UP_REQUIRED'); END IF;
 SELECT * INTO w FROM public.wallets WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND OR w.status<>'active' THEN RETURN jsonb_build_object('success',false,'error','Active wallet not found'); END IF;
 k:='crypto:'||uid::text||':'||p_key;
 SELECT * INTO t FROM public.wallet_transactions WHERE wallet_id=w.id AND idempotency_key=k;
 IF FOUND THEN
  IF t.amount<>p_amount THEN RETURN jsonb_build_object('success',false,'error','Request key already used'); END IF;
  SELECT * INTO d FROM public.crypto_deposits WHERE wallet_transaction_id=t.id;
  RETURN jsonb_build_object('success',true,'duplicate',true,'order_id',d.id,'invoice_url',d.invoice_url,'amount',t.amount);
 END IF;
 SELECT count(*) INTO attempts FROM public.wallet_transactions WHERE wallet_id=w.id AND type='deposit' AND created_at>=now()-interval '1 hour';
 IF attempts>=20 THEN RETURN jsonb_build_object('success',false,'error','Too many deposit attempts. Please try again later.'); END IF;
 SELECT coalesce(sum(amount),0) INTO total FROM public.wallet_transactions WHERE wallet_id=w.id AND type='deposit' AND status IN('pending','completed') AND created_at>=date_trunc('day',now());
 IF total+p_amount>50000 THEN RETURN jsonb_build_object('success',false,'error','Daily deposit limit exceeded'); END IF;
 INSERT INTO public.wallet_transactions(wallet_id,type,status,amount,fee,balance_before,balance_after,description,idempotency_key,metadata)
 VALUES(w.id,'deposit','pending',p_amount,0,w.balance,w.balance,'Crypto deposit (awaiting blockchain confirmation)',k,jsonb_build_object('method','Crypto','requires_webhook_confirmation',true)) RETURNING * INTO t;
 INSERT INTO public.crypto_deposits(user_id,wallet_transaction_id,amount_usd) VALUES(uid,t.id,p_amount) RETURNING * INTO d;
 RETURN jsonb_build_object('success',true,'order_id',d.id,'amount',p_amount);
END $$;
REVOKE ALL ON FUNCTION public.crypto_deposit_open(numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crypto_deposit_open(numeric,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.crypto_deposit_attach(p_order uuid,p_invoice text,p_url text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.crypto_deposits SET provider_invoice_id=p_invoice,invoice_url=p_url,updated_at=now() WHERE id=p_order AND provider_invoice_id IS NULL $$;
REVOKE ALL ON FUNCTION public.crypto_deposit_attach(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crypto_deposit_attach(uuid,text,text) TO service_role;

-- Settlement is webhook-only and applies the ledger once; underpayment never credits.
CREATE OR REPLACE FUNCTION public.crypto_deposit_settle(p_order uuid,p_status text,p_price numeric,p_pay_currency text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.crypto_deposits%ROWTYPE;
BEGIN
 SELECT * INTO d FROM public.crypto_deposits WHERE id=p_order FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','unknown order'); END IF;
 IF d.status IN('finished','failed','expired','refunded') THEN RETURN jsonb_build_object('success',true,'duplicate',true); END IF;
 UPDATE public.crypto_deposits SET status=p_status,pay_currency=coalesce(p_pay_currency,pay_currency),updated_at=now() WHERE id=d.id;
 IF p_status='finished' THEN
  IF p_price IS NULL OR p_price<d.amount_usd THEN RETURN jsonb_build_object('success',false,'error','amount mismatch'); END IF;
  UPDATE public.wallet_transactions SET status='completed',completed_at=now(),description='Crypto deposit'||coalesce(' ('||upper(p_pay_currency)||')','') WHERE id=d.wallet_transaction_id AND status='pending';
 ELSIF p_status IN('failed','expired','refunded') THEN
  UPDATE public.wallet_transactions SET status='failed',completed_at=now() WHERE id=d.wallet_transaction_id AND status='pending';
 END IF;
 RETURN jsonb_build_object('success',true);
END $$;
REVOKE ALL ON FUNCTION public.crypto_deposit_settle(uuid,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crypto_deposit_settle(uuid,text,numeric,text) TO service_role;