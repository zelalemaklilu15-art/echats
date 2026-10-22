-- Existing financial records remain untouched. Client wallet creation is forbidden.
REVOKE INSERT ON public.wallets FROM anon, authenticated;
DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.wallets;

-- One serialized failure counter for transfers, unlocks and airtime.
CREATE OR REPLACE FUNCTION public.wallet_pin_error(p_user uuid,p_pin text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.wallets%ROWTYPE; f public.wallet_pin_failures%ROWTYPE; n integer;
BEGIN
 SELECT * INTO w FROM public.wallets WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RETURN 'Wallet not found'; END IF;
 IF coalesce(w.pin_hash,'')='' THEN RETURN 'PIN_NOT_SET'; END IF;
 SELECT * INTO f FROM public.wallet_pin_failures WHERE user_id=p_user FOR UPDATE;
 IF f.locked_until>now() THEN RETURN 'Too many wrong PINs. Try again later.'; END IF;
 IF p_pin IS NULL OR p_pin !~ '^([0-9]{4}|[0-9]{6})$' OR w.pin_hash<>crypt(p_pin,w.pin_hash) THEN
  n:=CASE WHEN f.locked_until<=now() THEN 1 ELSE coalesce(f.failed_count,0)+1 END;
  INSERT INTO public.wallet_pin_failures(user_id,failed_count,locked_until,updated_at)
  VALUES(p_user,n,CASE WHEN n>=5 THEN now()+interval '15 minutes' ELSE NULL END,now())
  ON CONFLICT(user_id) DO UPDATE SET failed_count=excluded.failed_count,locked_until=excluded.locked_until,updated_at=excluded.updated_at;
  RETURN CASE WHEN n>=5 THEN 'Too many wrong PINs. Try again later.' ELSE 'Incorrect wallet PIN.' END;
 END IF;
 DELETE FROM public.wallet_pin_failures WHERE user_id=p_user;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.wallet_pin_error(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_pin_error(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.verify_wallet_pin(p_user_id uuid,p_pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RETURN public.wallet_pin_error(p_user_id,p_pin) IS NULL; END $$;
REVOKE ALL ON FUNCTION public.verify_wallet_pin(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_wallet_pin(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.check_wallet_device(p_device_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 IF coalesce(length(p_device_id),0)<6 OR length(p_device_id)>200 THEN RAISE EXCEPTION 'Invalid device'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('wallet-device:'||uid::text,0));
 IF EXISTS(SELECT 1 FROM public.wallet_trusted_devices WHERE user_id=uid AND device_id=p_device_id) THEN RETURN 'trusted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.wallet_trusted_devices WHERE user_id=uid) OR public.has_recent_otp(600) THEN
  INSERT INTO public.wallet_trusted_devices(user_id,device_id) VALUES(uid,p_device_id) ON CONFLICT DO NOTHING;
  RETURN 'trusted';
 END IF;
 RETURN 'step_up_required';
END $$;

CREATE OR REPLACE FUNCTION public.wallet_verify_own_pin(p_pin text,p_device text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE err text;
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Unauthorized'); END IF;
 IF coalesce(length(p_device),0)<6 OR length(p_device)>200 THEN RETURN jsonb_build_object('ok',false,'error','STEP_UP_REQUIRED'); END IF;
 IF public.check_wallet_device(p_device)<>'trusted' THEN RETURN jsonb_build_object('ok',false,'error','STEP_UP_REQUIRED'); END IF;
 err:=public.wallet_pin_error(auth.uid(),p_pin);
 RETURN jsonb_build_object('ok',err IS NULL,'error',err);
END $$;
REVOKE ALL ON FUNCTION public.wallet_verify_own_pin(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.wallet_verify_own_pin(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.wallet_transfer_atomic(p_recipient uuid,p_amount numeric,p_note text,p_key text,p_pin text,p_device text,p_request uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); s public.wallets%ROWTYPE; r public.wallets%ROWTYPE; t public.wallet_transactions%ROWTYPE;
 req public.payment_requests%ROWTYPE; err text; k text; ref text:=gen_random_uuid()::text; n text:=coalesce(p_note,''); total numeric;
BEGIN
 IF uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Unauthorized'); END IF;
 IF p_recipient IS NULL OR p_recipient=uid OR p_amount IS NULL OR p_amount<=0 OR p_amount>100000 OR p_amount<>round(p_amount,2) OR length(n)>500
 OR coalesce(length(p_key),0)<8 OR length(p_key)>100 THEN RETURN jsonb_build_object('success',false,'error','Invalid transfer request'); END IF;
 IF coalesce(length(p_device),0)<6 OR length(p_device)>200 THEN RETURN jsonb_build_object('success',false,'error','STEP_UP_REQUIRED'); END IF;
 IF public.check_wallet_device(p_device)<>'trusted' THEN RETURN jsonb_build_object('success',false,'error','STEP_UP_REQUIRED'); END IF;
 -- All senders lock both wallets in the same order, including opposite-direction transfers.
 PERFORM id FROM public.wallets WHERE user_id IN(uid,p_recipient) ORDER BY id FOR UPDATE;
 SELECT * INTO s FROM public.wallets WHERE user_id=uid;
 SELECT * INTO r FROM public.wallets WHERE user_id=p_recipient;
 IF s.id IS NULL OR r.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Wallet not found'); END IF;
 IF s.status<>'active' OR r.status<>'active' THEN RETURN jsonb_build_object('success',false,'error','Wallet is not active'); END IF;
 err:=public.wallet_pin_error(uid,p_pin);
 IF err IS NOT NULL THEN RETURN jsonb_build_object('success',false,'error',err); END IF;
 IF p_amount>5000 AND NOT public.has_recent_otp(600) THEN RETURN jsonb_build_object('success',false,'error','STEP_UP_REQUIRED'); END IF;
 k:='transfer:'||uid::text||':'||p_key;
 SELECT * INTO t FROM public.wallet_transactions WHERE wallet_id=s.id AND idempotency_key IN(k||':out',p_key||'_out') LIMIT 1;
 IF FOUND THEN
  IF t.amount<>p_amount OR t.counterparty_wallet_id IS DISTINCT FROM r.id OR coalesce(t.metadata->>'note','')<>n OR coalesce(t.metadata->>'payment_request_id','')<>coalesce(p_request::text,'') THEN
   RETURN jsonb_build_object('success',false,'error','Request key already used for a different payment'); END IF;
  RETURN jsonb_build_object('success',true,'duplicate',true,'transaction',to_jsonb(t)||jsonb_build_object('recipient',(SELECT name FROM public.get_public_profile(p_recipient)),'note',nullif(n,'')));
 END IF;
 IF p_request IS NOT NULL THEN
  SELECT * INTO req FROM public.payment_requests WHERE id=p_request FOR UPDATE;
  IF NOT FOUND OR req.status<>'pending' OR req.payer_id<>uid OR req.requester_id<>p_recipient OR req.amount<>p_amount THEN
   RETURN jsonb_build_object('success',false,'error','Payment request is no longer payable or does not match'); END IF;
 END IF;
 IF s.balance<p_amount THEN RETURN jsonb_build_object('success',false,'error','Insufficient balance'); END IF;
 SELECT coalesce(sum(amount+fee),0) INTO total FROM public.wallet_transactions WHERE wallet_id=s.id AND status='completed' AND type IN('transfer_out','payment','withdrawal') AND created_at>=date_trunc('day',now());
 IF total+p_amount>s.daily_limit THEN RETURN jsonb_build_object('success',false,'error','Daily wallet limit exceeded'); END IF;
 SELECT coalesce(sum(amount+fee),0) INTO total FROM public.wallet_transactions WHERE wallet_id=s.id AND status='completed' AND type IN('transfer_out','payment','withdrawal') AND created_at>=date_trunc('month',now());
 IF total+p_amount>s.monthly_limit THEN RETURN jsonb_build_object('success',false,'error','Monthly wallet limit exceeded'); END IF;
 -- Nested exception block rolls back BOTH ledger writes and request status on any failure.
 BEGIN
  INSERT INTO public.wallet_transactions(wallet_id,type,status,amount,fee,balance_before,balance_after,reference_id,counterparty_wallet_id,description,idempotency_key,metadata)
  VALUES(s.id,'transfer_out','completed',p_amount,0,s.balance,s.balance-p_amount,ref,r.id,coalesce(nullif(n,''),'Transfer to user'),k||':out',jsonb_build_object('recipient_user_id',p_recipient,'note',nullif(n,''),'payment_request_id',p_request)) RETURNING * INTO t;
  INSERT INTO public.wallet_transactions(wallet_id,type,status,amount,fee,balance_before,balance_after,reference_id,counterparty_wallet_id,description,idempotency_key,metadata)
  VALUES(r.id,'transfer_in','completed',p_amount,0,r.balance,r.balance+p_amount,ref,s.id,coalesce(nullif(n,''),'Transfer from user'),k||':in',jsonb_build_object('sender_user_id',uid,'note',nullif(n,'')));
  IF p_request IS NOT NULL THEN UPDATE public.payment_requests SET status='paid',paid_transaction_id=t.id WHERE id=p_request; END IF;
 EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error','Transfer failed. No money was moved. Please retry.'); END;
 RETURN jsonb_build_object('success',true,'transaction',to_jsonb(t)||jsonb_build_object('recipient',(SELECT name FROM public.get_public_profile(p_recipient)),'note',nullif(n,'')));
END $$;
REVOKE ALL ON FUNCTION public.wallet_transfer_atomic(uuid,numeric,text,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.wallet_transfer_atomic(uuid,numeric,text,text,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.wallet_activate_secure(p_device text,p_agent text,p_ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); w public.wallets%ROWTYPE;
BEGIN
 IF uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Unauthorized'); END IF;
 IF coalesce(length(p_device),0)<6 OR length(p_device)>200 THEN RETURN jsonb_build_object('success',false,'error','STEP_UP_REQUIRED'); END IF;
 IF public.check_wallet_device(p_device)<>'trusted' THEN RETURN jsonb_build_object('success',false,'error','STEP_UP_REQUIRED'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('wallet-activate:'||uid::text,0));
 SELECT * INTO w FROM public.wallets WHERE user_id=uid FOR UPDATE;
 IF w.status='suspended' THEN RETURN jsonb_build_object('success',false,'error','Wallet is suspended'); END IF;
 IF w.id IS NULL THEN INSERT INTO public.wallets(user_id,balance,status,device_id) VALUES(uid,0,'pending_activation',p_device) RETURNING * INTO w; END IF;
 IF w.status='pending_activation' THEN
  INSERT INTO public.wallet_terms_acceptance(user_id,terms_version,ip_address,user_agent) VALUES(uid,'1.0.0',left(p_ip,100),left(p_agent,500)) ON CONFLICT(user_id) DO NOTHING;
  PERFORM set_config('app.allow_wallet_financial_update','true',true);
  UPDATE public.wallets SET status='active',terms_accepted=true,terms_accepted_at=now() WHERE id=w.id RETURNING * INTO w;
  PERFORM set_config('app.allow_wallet_financial_update','false',true);
 END IF;
 RETURN jsonb_build_object('success',true,'wallet',jsonb_build_object('id',w.id,'status',w.status,'balance',w.balance,'currency',w.currency,'terms_accepted_at',w.terms_accepted_at,'created_at',w.created_at));
END $$;
REVOKE ALL ON FUNCTION public.wallet_activate_secure(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.wallet_activate_secure(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.wallet_deposit_request(p_amount numeric,p_method text,p_key text,p_device text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); w public.wallets%ROWTYPE; t public.wallet_transactions%ROWTYPE; k text; total numeric; attempts integer;
BEGIN
 IF uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Unauthorized'); END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>10000 OR p_amount<>round(p_amount,2) OR p_method IS NULL OR p_method NOT IN('Credit/Debit Card','Bank Transfer','Mobile Money','Telebirr','CBEBirr','Awash Bank','Dashen Bank') OR coalesce(length(p_key),0)<8 OR length(p_key)>100 THEN RETURN jsonb_build_object('success',false,'error','Invalid deposit request (maximum 10,000 ETB)'); END IF;
 IF coalesce(length(p_device),0)<6 OR length(p_device)>200 THEN RETURN jsonb_build_object('success',false,'error','STEP_UP_REQUIRED'); END IF;
 IF public.check_wallet_device(p_device)<>'trusted' THEN RETURN jsonb_build_object('success',false,'error','STEP_UP_REQUIRED'); END IF;
 SELECT * INTO w FROM public.wallets WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND OR w.status<>'active' THEN RETURN jsonb_build_object('success',false,'error','Active wallet not found'); END IF;
 k:='deposit:'||uid::text||':'||p_key;
 SELECT * INTO t FROM public.wallet_transactions WHERE wallet_id=w.id AND type='deposit' AND idempotency_key IN(k,p_key) LIMIT 1;
 IF FOUND THEN
  IF t.amount<>p_amount OR (t.metadata->>'method') IS DISTINCT FROM p_method THEN RETURN jsonb_build_object('success',false,'error','Request key already used for a different deposit'); END IF;
  RETURN jsonb_build_object('success',true,'duplicate',true,'pending',t.status='pending','transaction',to_jsonb(t)||jsonb_build_object('method',p_method));
 END IF;
 SELECT count(*) INTO attempts FROM public.wallet_transactions WHERE wallet_id=w.id AND type='deposit' AND created_at>=now()-interval '1 hour';
 IF attempts>=20 THEN RETURN jsonb_build_object('success',false,'error','Too many deposit attempts. Please try again later.'); END IF;
 SELECT coalesce(sum(amount),0) INTO total FROM public.wallet_transactions WHERE wallet_id=w.id AND type='deposit' AND status IN('pending','completed') AND created_at>=date_trunc('day',now());
 IF total+p_amount>50000 THEN RETURN jsonb_build_object('success',false,'error','Daily deposit limit exceeded'); END IF;
 INSERT INTO public.wallet_transactions(wallet_id,type,status,amount,fee,balance_before,balance_after,description,idempotency_key,metadata)
 VALUES(w.id,'deposit','pending',p_amount,0,w.balance,w.balance,'Deposit via '||p_method||' (awaiting confirmation)',k,jsonb_build_object('method',p_method,'requires_webhook_confirmation',true)) RETURNING * INTO t;
 RETURN jsonb_build_object('success',true,'pending',true,'transaction',to_jsonb(t)||jsonb_build_object('method',p_method));
END $$;
REVOKE ALL ON FUNCTION public.wallet_deposit_request(numeric,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.wallet_deposit_request(numeric,text,text,text) TO authenticated;

-- Safe read helpers never return another user's wallet or PIN hash.
CREATE OR REPLACE FUNCTION public.get_user_wallet(p_user_id uuid)
RETURNS TABLE(id uuid,user_id uuid,balance numeric,currency text,status public.wallet_status,terms_accepted boolean,daily_limit numeric,monthly_limit numeric,created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT w.id,w.user_id,w.balance,w.currency,w.status,w.terms_accepted,w.daily_limit,w.monthly_limit,w.created_at FROM public.wallets w WHERE w.user_id=p_user_id AND p_user_id=auth.uid() $$;
CREATE OR REPLACE FUNCTION public.get_wallet_balance(p_wallet_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT w.balance FROM public.wallets w WHERE w.id=p_wallet_id AND (w.user_id=auth.uid() OR auth.role()='service_role') $$;

-- Pending settlement applies a balance exactly once; terminal transactions remain immutable.
CREATE OR REPLACE FUNCTION public.guard_wallet_transaction_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.wallet_id IS DISTINCT FROM OLD.wallet_id OR NEW.amount IS DISTINCT FROM OLD.amount OR NEW.fee IS DISTINCT FROM OLD.fee OR NEW.type IS DISTINCT FROM OLD.type OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR NEW.counterparty_wallet_id IS DISTINCT FROM OLD.counterparty_wallet_id THEN RAISE EXCEPTION 'Cannot change transaction financial fields'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_wallet_transaction_fields BEFORE UPDATE ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION public.guard_wallet_transaction_fields();
CREATE TRIGGER apply_wallet_transaction_balance_update BEFORE UPDATE ON public.wallet_transactions FOR EACH ROW WHEN (OLD.status='pending' AND NEW.status='completed') EXECUTE FUNCTION public.apply_wallet_transaction_balance();

-- Financial push delivery is triggered by committed ledger events, not request retries.
CREATE TRIGGER wallet_ledger_push AFTER INSERT OR UPDATE OF status ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_event();
-- The legacy signature cannot bypass the device check; current clients supply the device.
CREATE OR REPLACE FUNCTION public.airtime_topup(p_phone text,p_amount numeric,p_pin text,p_idempotency_key text)
RETURNS TABLE(success boolean,error text,balance numeric,topup_id uuid,duplicate boolean)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT false,'STEP_UP_REQUIRED'::text,NULL::numeric,NULL::uuid,false $$;
CREATE OR REPLACE FUNCTION public.airtime_topup(p_phone text,p_amount numeric,p_pin text,p_idempotency_key text,p_device text)
RETURNS TABLE(success boolean,error text,balance numeric,topup_id uuid,duplicate boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); w public.wallets%ROWTYPE; t public.airtime_topups%ROWTYPE; phone text; err text; tx uuid; tid uuid; total numeric;
BEGIN
 IF uid IS NULL THEN RETURN QUERY SELECT false,'Unauthorized'::text,NULL::numeric,NULL::uuid,false; RETURN; END IF;
 phone:=regexp_replace(coalesce(p_phone,''),'[\s-]','','g');
 IF phone ~ '^\+?251[79][0-9]{8}$' THEN phone:='0'||right(phone,9); END IF;
 IF phone !~ '^0[79][0-9]{8}$' OR p_amount IS NULL OR p_amount<5 OR p_amount>1000 OR p_amount<>round(p_amount,2) OR coalesce(length(p_idempotency_key),0)<8 OR length(p_idempotency_key)>100 THEN
  RETURN QUERY SELECT false,'Invalid phone or amount (5–1,000 ETB)'::text,NULL::numeric,NULL::uuid,false; RETURN; END IF;
 IF coalesce(length(p_device),0)<6 OR length(p_device)>200 THEN RETURN QUERY SELECT false,'STEP_UP_REQUIRED'::text,NULL::numeric,NULL::uuid,false; RETURN; END IF;
 IF public.check_wallet_device(p_device)<>'trusted' THEN RETURN QUERY SELECT false,'STEP_UP_REQUIRED'::text,NULL::numeric,NULL::uuid,false; RETURN; END IF;
 SELECT * INTO w FROM public.wallets WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND OR w.status<>'active' THEN RETURN QUERY SELECT false,'Active wallet not found'::text,NULL::numeric,NULL::uuid,false; RETURN; END IF;
 err:=public.wallet_pin_error(uid,p_pin);
 IF err IS NOT NULL THEN RETURN QUERY SELECT false,err,w.balance,NULL::uuid,false; RETURN; END IF;
 SELECT * INTO t FROM public.airtime_topups WHERE idempotency_key=p_idempotency_key;
 IF FOUND THEN
  IF t.user_id<>uid OR t.phone<>phone OR t.amount<>p_amount THEN RETURN QUERY SELECT false,'Request key already used'::text,w.balance,NULL::uuid,false; RETURN; END IF;
  RETURN QUERY SELECT true,NULL::text,w.balance,t.id,true; RETURN;
 END IF;
 IF w.balance<p_amount THEN RETURN QUERY SELECT false,'Insufficient balance'::text,w.balance,NULL::uuid,false; RETURN; END IF;
 SELECT coalesce(sum(amount+fee),0) INTO total FROM public.wallet_transactions WHERE wallet_id=w.id AND status='completed' AND type IN('transfer_out','payment','withdrawal') AND created_at>=date_trunc('day',now());
 IF total+p_amount>w.daily_limit THEN RETURN QUERY SELECT false,'Daily wallet limit exceeded'::text,w.balance,NULL::uuid,false; RETURN; END IF;
 SELECT coalesce(sum(amount+fee),0) INTO total FROM public.wallet_transactions WHERE wallet_id=w.id AND status='completed' AND type IN('transfer_out','payment','withdrawal') AND created_at>=date_trunc('month',now());
 IF total+p_amount>w.monthly_limit THEN RETURN QUERY SELECT false,'Monthly wallet limit exceeded'::text,w.balance,NULL::uuid,false; RETURN; END IF;
 BEGIN
  INSERT INTO public.wallet_transactions(wallet_id,type,status,amount,fee,balance_before,balance_after,description,idempotency_key,metadata)
  VALUES(w.id,'payment','completed',p_amount,0,w.balance,w.balance-p_amount,'Airtime top-up '||phone,'airtime:'||uid::text||':'||p_idempotency_key,jsonb_build_object('kind','AIRTIME_TOPUP','phone',phone)) RETURNING id INTO tx;
  INSERT INTO public.airtime_topups(user_id,phone,amount,status,wallet_transaction_id,idempotency_key)
  VALUES(uid,phone,p_amount,'pending',tx,p_idempotency_key) RETURNING id INTO tid;
 EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT false,'Top-up failed. No money was moved.'::text,w.balance,NULL::uuid,false; RETURN; END;
 RETURN QUERY SELECT true,NULL::text,(SELECT ww.balance FROM public.wallets ww WHERE ww.id=w.id),tid,false;
END $$;
REVOKE ALL ON FUNCTION public.airtime_topup(text,numeric,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.airtime_topup(text,numeric,text,text,text) TO authenticated;
-- Resolving a payment destination never grants access to private identity.
CREATE OR REPLACE FUNCTION public.resolve_payment_destination(p_username text DEFAULT NULL,p_request uuid DEFAULT NULL,p_user uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); dest uuid; req public.payment_requests%ROWTYPE; prof record;
BEGIN
 IF uid IS NULL THEN RETURN jsonb_build_object('error','Please sign in'); END IF;
 IF p_request IS NOT NULL THEN
  SELECT * INTO req FROM public.payment_requests WHERE id=p_request AND payer_id=uid;
  IF NOT FOUND OR req.status<>'pending' THEN RETURN jsonb_build_object('error','Payment request is unavailable'); END IF;
  dest:=req.requester_id;
 ELSIF p_user IS NOT NULL THEN
  SELECT id INTO dest FROM public.profiles WHERE id=p_user;
 ELSE
  SELECT id INTO dest FROM public.profiles WHERE lower(username)=lower(trim(both '@' from coalesce(p_username,'')));
 END IF;
 IF dest IS NULL OR dest=uid THEN RETURN jsonb_build_object('error','Payment recipient is unavailable'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.wallets WHERE user_id=dest AND status='active') THEN RETURN jsonb_build_object('error','Recipient wallet is not active'); END IF;
 SELECT * INTO prof FROM public.get_public_profile(dest);
 RETURN jsonb_build_object('contact',jsonb_build_object('id',dest,'name',prof.name,'username',prof.username,'avatar_url',prof.avatar_url),
  'amount',req.amount,'note',req.note,'requestId',req.id);
END $$;
REVOKE ALL ON FUNCTION public.resolve_payment_destination(text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_payment_destination(text,uuid,uuid) TO authenticated;
