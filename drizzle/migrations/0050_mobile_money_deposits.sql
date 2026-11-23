
CREATE TABLE public.mm_receiver_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  public_key_jwk jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mm_nonces (
  device_id uuid NOT NULL,
  nonce text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, nonce)
);
CREATE TABLE public.mm_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_transaction_id uuid NOT NULL UNIQUE,
  provider text NOT NULL CHECK (provider IN ('telebirr','ebirr')),
  amount numeric(15,2) NOT NULL,
  payer_phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','review','expired','rejected')),
  sms_id uuid,
  review_reason text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mm_incoming_sms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL,
  provider text NOT NULL,
  txid text NOT NULL,
  amount numeric(15,2) NOT NULL,
  payer_phone text,
  raw_text text NOT NULL,
  received_at timestamptz NOT NULL,
  matched_deposit_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, txid)
);
CREATE INDEX ON public.mm_deposits (status, provider, amount, payer_phone);
GRANT SELECT ON public.mm_deposits TO authenticated;
GRANT ALL ON public.mm_deposits, public.mm_incoming_sms, public.mm_receiver_devices, public.mm_nonces TO service_role;
ALTER TABLE public.mm_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_incoming_sms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_receiver_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mm_nonces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mm deposits" ON public.mm_deposits FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mm_norm_phone(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN d ~ '^2519\d{8}$' THEN '0'||substr(d,4) WHEN d ~ '^9\d{8}$' THEN '0'||d WHEN d ~ '^7\d{8}$' THEN '0'||d WHEN d ~ '^2517\d{8}$' THEN '0'||substr(d,4) ELSE d END
  FROM (SELECT regexp_replace(coalesce(p,''),'\D','','g') d) x $$;

-- internal: settle one deposit with one sms (caller holds locks)
CREATE OR REPLACE FUNCTION public.mm_settle(p_dep uuid, p_sms uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.mm_deposits SET status='completed', sms_id=p_sms, updated_at=now() WHERE id=p_dep AND status IN ('pending','review','expired');
  UPDATE public.mm_incoming_sms SET matched_deposit_id=p_dep WHERE id=p_sms AND matched_deposit_id IS NULL;
  UPDATE public.wallet_transactions SET status='completed', completed_at=now(), description='Mobile money deposit'
   WHERE id=(SELECT wallet_transaction_id FROM public.mm_deposits WHERE id=p_dep) AND status='pending';
END $$;
REVOKE ALL ON FUNCTION public.mm_settle(uuid,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mm_deposit_open(p_amount numeric, p_provider text, p_key text, p_device text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); w public.wallets%ROWTYPE; t public.wallet_transactions%ROWTYPE; d public.mm_deposits%ROWTYPE; k text; ph text; total numeric; att int;
BEGIN
 IF uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Unauthorized'); END IF;
 IF p_provider NOT IN ('telebirr','ebirr') THEN RETURN jsonb_build_object('success',false,'error','Unknown provider'); END IF;
 IF p_amount IS NULL OR p_amount<10 OR p_amount>25000 OR p_amount<>round(p_amount,2) OR coalesce(length(p_key),0)<8 OR length(p_key)>100 THEN RETURN jsonb_build_object('success',false,'error','Amount must be between 10 and 25,000'); END IF;
 IF coalesce(length(p_device),0)<6 OR public.check_wallet_device(p_device)<>'trusted' THEN RETURN jsonb_build_object('success',false,'error','STEP_UP_REQUIRED'); END IF;
 SELECT public.mm_norm_phone(phone) INTO ph FROM public.profiles WHERE id=uid;
 IF ph IS NULL OR ph !~ '^0[79]\d{8}$' THEN RETURN jsonb_build_object('success',false,'error','PHONE_REQUIRED'); END IF;
 SELECT * INTO w FROM public.wallets WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND OR w.status<>'active' THEN RETURN jsonb_build_object('success',false,'error','Active wallet not found'); END IF;
 k:='mm:'||uid::text||':'||p_key;
 SELECT * INTO t FROM public.wallet_transactions WHERE wallet_id=w.id AND idempotency_key=k;
 IF FOUND THEN SELECT * INTO d FROM public.mm_deposits WHERE wallet_transaction_id=t.id;
   RETURN jsonb_build_object('success',true,'duplicate',true,'deposit_id',d.id,'amount',d.amount,'provider',d.provider,'phone',d.payer_phone); END IF;
 SELECT count(*) INTO att FROM public.mm_deposits WHERE user_id=uid AND created_at>=now()-interval '1 hour';
 IF att>=10 THEN RETURN jsonb_build_object('success',false,'error','Too many attempts. Please try again later.'); END IF;
 IF EXISTS(SELECT 1 FROM public.mm_deposits WHERE user_id=uid AND status='pending' AND expires_at>now() AND provider=p_provider AND amount=p_amount) THEN
   RETURN jsonb_build_object('success',false,'error','You already have a pending top-up of this amount. Finish or wait for it to expire.'); END IF;
 SELECT coalesce(sum(amount),0) INTO total FROM public.wallet_transactions WHERE wallet_id=w.id AND type='deposit' AND status IN('pending','completed') AND created_at>=date_trunc('day',now());
 IF total+p_amount>50000 THEN RETURN jsonb_build_object('success',false,'error','Daily deposit limit exceeded'); END IF;
 INSERT INTO public.wallet_transactions(wallet_id,type,status,amount,fee,balance_before,balance_after,description,idempotency_key,metadata)
 VALUES(w.id,'deposit','pending',p_amount,0,w.balance,w.balance,'Mobile money deposit (awaiting payment)',k,jsonb_build_object('method',p_provider)) RETURNING * INTO t;
 INSERT INTO public.mm_deposits(user_id,wallet_transaction_id,provider,amount,payer_phone) VALUES(uid,t.id,p_provider,p_amount,ph) RETURNING * INTO d;
 RETURN jsonb_build_object('success',true,'deposit_id',d.id,'amount',d.amount,'provider',d.provider,'phone',ph,'expires_at',d.expires_at);
END $$;

-- user fallback: submit provider transaction ID
CREATE OR REPLACE FUNCTION public.mm_deposit_claim_txid(p_deposit uuid, p_txid text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); d public.mm_deposits%ROWTYPE; s public.mm_incoming_sms%ROWTYPE; tx text:=upper(regexp_replace(coalesce(p_txid,''),'\s','','g'));
BEGIN
 IF uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Unauthorized'); END IF;
 IF tx !~ '^[A-Z0-9]{6,20}$' THEN RETURN jsonb_build_object('success',false,'error','Invalid transaction ID'); END IF;
 SELECT * INTO d FROM public.mm_deposits WHERE id=p_deposit AND user_id=uid FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Not found'); END IF;
 IF d.status='completed' THEN RETURN jsonb_build_object('success',true,'status','completed'); END IF;
 IF d.status NOT IN ('pending','expired') THEN RETURN jsonb_build_object('success',true,'status',d.status); END IF;
 SELECT * INTO s FROM public.mm_incoming_sms WHERE provider=d.provider AND txid=tx FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Payment not received yet. Please wait a moment and try again.'); END IF;
 IF s.matched_deposit_id IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error','This transaction was already used'); END IF;
 IF s.received_at < d.created_at - interval '5 minutes' THEN RETURN jsonb_build_object('success',false,'error','This payment is older than your request'); END IF;
 IF s.amount=d.amount AND s.payer_phone=d.payer_phone THEN
   PERFORM public.mm_settle(d.id,s.id); RETURN jsonb_build_object('success',true,'status','completed'); END IF;
 -- different phone or amount: never auto-credit; hold for admin review
 UPDATE public.mm_deposits SET status='review', sms_id=s.id, review_reason=CASE WHEN s.amount<>d.amount THEN 'amount mismatch' ELSE 'paid from another phone' END, updated_at=now() WHERE id=d.id;
 UPDATE public.mm_incoming_sms SET matched_deposit_id=d.id WHERE id=s.id;
 RETURN jsonb_build_object('success',true,'status','review');
END $$;

-- server-only: ingest verified SMS and auto-match
CREATE OR REPLACE FUNCTION public.mm_ingest_sms(p_device uuid, p_provider text, p_txid text, p_amount numeric, p_phone text, p_raw text, p_received timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.mm_incoming_sms%ROWTYPE; ph text:=public.mm_norm_phone(p_phone); ids uuid[];
BEGIN
 INSERT INTO public.mm_incoming_sms(device_id,provider,txid,amount,payer_phone,raw_text,received_at)
 VALUES(p_device,p_provider,upper(p_txid),p_amount,nullif(ph,''),left(p_raw,1000),p_received)
 ON CONFLICT (provider,txid) DO NOTHING RETURNING * INTO s;
 IF s.id IS NULL THEN RETURN jsonb_build_object('success',true,'duplicate',true); END IF;
 IF ph IS NULL OR ph='' THEN RETURN jsonb_build_object('success',true,'matched',false); END IF;
 SELECT array_agg(id ORDER BY created_at) INTO ids FROM (
   SELECT id, created_at FROM public.mm_deposits WHERE status='pending' AND provider=p_provider AND amount=p_amount AND payer_phone=ph
     AND created_at <= p_received + interval '2 minutes' AND expires_at >= p_received FOR UPDATE) x;
 IF coalesce(array_length(ids,1),0)=1 THEN PERFORM public.mm_settle(ids[1],s.id); RETURN jsonb_build_object('success',true,'matched',true); END IF;
 RETURN jsonb_build_object('success',true,'matched',false,'candidates',coalesce(array_length(ids,1),0));
END $$;
REVOKE ALL ON FUNCTION public.mm_ingest_sms(uuid,text,text,numeric,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_ingest_sms(uuid,text,text,numeric,text,text,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.mm_expire_deposits() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.mm_deposits SET status='expired', updated_at=now() WHERE status='pending' AND expires_at < now() - interval '24 hours';
$$;

CREATE OR REPLACE FUNCTION public.admin_list_mm_deposits() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
 RETURN coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC) FROM (
   SELECT d.id,d.user_id,p.username,d.provider,d.amount,d.payer_phone,d.status,d.review_reason,d.created_at,
          s.txid sms_txid,s.amount sms_amount,s.payer_phone sms_phone
   FROM public.mm_deposits d LEFT JOIN public.profiles p ON p.id=d.user_id LEFT JOIN public.mm_incoming_sms s ON s.id=d.sms_id
   WHERE d.status IN ('review','pending') OR d.created_at>now()-interval '7 days' LIMIT 200) x),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_mm_deposit(p_deposit uuid, p_approve boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.mm_deposits%ROWTYPE; s public.mm_incoming_sms%ROWTYPE;
BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO d FROM public.mm_deposits WHERE id=p_deposit FOR UPDATE;
 IF NOT FOUND OR d.status<>'review' THEN RETURN jsonb_build_object('success',false,'error','Not in review'); END IF;
 IF p_approve THEN
   SELECT * INTO s FROM public.mm_incoming_sms WHERE id=d.sms_id FOR UPDATE;
   IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','No payment SMS'); END IF;
   -- credit only what was actually received
   UPDATE public.wallet_transactions SET amount=s.amount WHERE id=d.wallet_transaction_id AND status='pending';
   UPDATE public.mm_deposits SET amount=s.amount WHERE id=d.id;
   PERFORM public.mm_settle(d.id,s.id);
 ELSE
   UPDATE public.mm_deposits SET status='rejected',updated_at=now() WHERE id=d.id;
   UPDATE public.mm_incoming_sms SET matched_deposit_id=NULL WHERE id=d.sms_id;
   UPDATE public.wallet_transactions SET status='failed',completed_at=now() WHERE id=d.wallet_transaction_id AND status='pending';
 END IF;
 RETURN jsonb_build_object('success',true);
END $$;
