CREATE TABLE public.mm_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_transaction_id uuid NOT NULL,
  provider text NOT NULL,
  phone text NOT NULL,
  amount numeric(15,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payout_ref text,
  admin_note text,
  refund_transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mm_withdrawals TO authenticated;
GRANT ALL ON public.mm_withdrawals TO service_role;
ALTER TABLE public.mm_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own withdrawals" ON public.mm_withdrawals FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.wallet_request_withdrawal(p_amount numeric, p_provider text, p_phone text, p_pin text, p_device text, p_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid:=auth.uid(); w public.wallets%ROWTYPE; t public.wallet_transactions%ROWTYPE; r public.mm_withdrawals%ROWTYPE; err text; k text; ph text; n int;
BEGIN
 IF uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Unauthorized'); END IF;
 IF p_provider NOT IN ('telebirr','ebirr') THEN RETURN jsonb_build_object('success',false,'error','Unknown provider'); END IF;
 IF p_amount IS NULL OR p_amount<50 OR p_amount>5000 OR p_amount<>round(p_amount,2) THEN RETURN jsonb_build_object('success',false,'error','Amount must be between 50 and 5,000'); END IF;
 IF coalesce(length(p_key),0)<8 OR length(p_key)>100 THEN RETURN jsonb_build_object('success',false,'error','Invalid request'); END IF;
 ph:=public.mm_norm_phone(p_phone);
 IF ph IS NULL OR ph !~ '^0[79]\d{8}$' THEN RETURN jsonb_build_object('success',false,'error','Enter a valid phone number'); END IF;
 k:='wd:'||uid::text||':'||p_key;
 SELECT * INTO t FROM public.wallet_transactions WHERE idempotency_key=k;
 IF FOUND THEN SELECT * INTO r FROM public.mm_withdrawals WHERE wallet_transaction_id=t.id;
   RETURN jsonb_build_object('success',true,'duplicate',true,'withdrawal_id',r.id); END IF;
 err:=public.wallet_purchase_error(p_pin,p_device,p_amount);
 IF err IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error',err); END IF;
 SELECT count(*) INTO n FROM public.mm_withdrawals WHERE user_id=uid AND status='pending';
 IF n>=3 THEN RETURN jsonb_build_object('success',false,'error','You already have pending withdrawals. Please wait for them to finish.'); END IF;
 SELECT * INTO w FROM public.wallets WHERE user_id=uid FOR UPDATE;
 INSERT INTO public.wallet_transactions(wallet_id,type,status,amount,fee,balance_before,balance_after,description,idempotency_key,metadata)
 VALUES(w.id,'withdrawal','completed',p_amount,0,w.balance,w.balance,'Withdrawal to '||initcap(p_provider)||' '||ph,k,jsonb_build_object('method',p_provider,'phone',ph)) RETURNING * INTO t;
 INSERT INTO public.mm_withdrawals(user_id,wallet_transaction_id,provider,phone,amount) VALUES(uid,t.id,p_provider,ph,p_amount) RETURNING * INTO r;
 RETURN jsonb_build_object('success',true,'withdrawal_id',r.id,'amount',r.amount);
END $$;
REVOKE ALL ON FUNCTION public.wallet_request_withdrawal(numeric,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_request_withdrawal(numeric,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_withdrawals()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
 RETURN coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC) FROM (
   SELECT m.id,m.user_id,p.username,m.provider,m.phone,m.amount,m.status,m.payout_ref,m.admin_note,m.created_at
   FROM public.mm_withdrawals m LEFT JOIN public.profiles p ON p.id=m.user_id
   WHERE m.status='pending' OR m.created_at>now()-interval '30 days' ORDER BY m.created_at DESC LIMIT 200) x),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.admin_list_withdrawals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_withdrawals() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_withdrawal(p_id uuid, p_approve boolean, p_ref text, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.mm_withdrawals%ROWTYPE; w public.wallets%ROWTYPE; t public.wallet_transactions%ROWTYPE;
BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO r FROM public.mm_withdrawals WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'pending' THEN RETURN jsonb_build_object('success',false,'error','Not pending'); END IF;
 IF p_approve THEN
   IF coalesce(length(trim(p_ref)),0)<6 OR length(p_ref)>40 THEN RETURN jsonb_build_object('success',false,'error','Enter the payout receipt number'); END IF;
   UPDATE public.mm_withdrawals SET status='sent',payout_ref=trim(p_ref),admin_note=left(p_note,300),updated_at=now() WHERE id=r.id;
 ELSE
   SELECT w2.* INTO w FROM public.wallets w2 JOIN public.wallet_transactions x ON x.wallet_id=w2.id WHERE x.id=r.wallet_transaction_id FOR UPDATE OF w2;
   INSERT INTO public.wallet_transactions(wallet_id,type,status,amount,fee,balance_before,balance_after,description,idempotency_key,metadata)
   VALUES(w.id,'refund','completed',r.amount,0,w.balance,w.balance,'Withdrawal refunded','wdr:'||r.id::text,jsonb_build_object('withdrawal_id',r.id)) RETURNING * INTO t;
   UPDATE public.mm_withdrawals SET status='rejected',admin_note=left(p_note,300),refund_transaction_id=t.id,updated_at=now() WHERE id=r.id;
 END IF;
 RETURN jsonb_build_object('success',true);
END $$;
REVOKE ALL ON FUNCTION public.admin_resolve_withdrawal(uuid,boolean,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_withdrawal(uuid,boolean,text,text) TO authenticated;