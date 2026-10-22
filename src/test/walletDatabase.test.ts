// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002';
let db:PGlite;
async function call(sql:string) { return (await db.query<{r:any}>(`SELECT ${sql} AS r`)).rows[0].r; }
async function transfer(amount=100,key='test-key-0001',request:string|null=null) {return call(`wallet_transfer_atomic('${B}',${amount},'test','${key}','123456','device-a',${request?`'${request}'`:'NULL'})`);}
async function balances(){return (await db.query('SELECT balance FROM wallets ORDER BY user_id')).rows.map((r:any)=>Number(r.balance));}
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated') $$;
 CREATE TYPE wallet_status AS ENUM('active','suspended','pending_activation');
 CREATE TABLE wallets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid UNIQUE,balance numeric DEFAULT 0,currency text DEFAULT 'ETB',status wallet_status DEFAULT 'pending_activation',pin_hash text,terms_accepted boolean DEFAULT false,terms_accepted_at timestamptz,daily_limit numeric DEFAULT 100000,monthly_limit numeric DEFAULT 1000000,created_at timestamptz DEFAULT now(),device_id text);
 GRANT ALL ON wallets TO authenticated; ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
 CREATE POLICY "Users can insert their own wallet" ON wallets FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
 CREATE TABLE wallet_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),wallet_id uuid,type text,status text,amount numeric,fee numeric DEFAULT 0,balance_before numeric,balance_after numeric,reference_id text,counterparty_wallet_id uuid,description text,idempotency_key text UNIQUE,metadata jsonb DEFAULT '{}',created_at timestamptz DEFAULT now(),completed_at timestamptz);
 CREATE TABLE wallet_pin_failures(user_id uuid PRIMARY KEY,failed_count integer,locked_until timestamptz,updated_at timestamptz);
 CREATE TABLE wallet_trusted_devices(user_id uuid,device_id text,PRIMARY KEY(user_id,device_id));
 CREATE TABLE payment_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payer_id uuid,requester_id uuid,amount numeric,status text DEFAULT 'pending',paid_transaction_id uuid);
 CREATE TABLE wallet_terms_acceptance(user_id uuid UNIQUE,terms_version text,ip_address text,user_agent text);
 CREATE TABLE stars_balances(user_id uuid PRIMARY KEY,balance integer,updated_at timestamptz DEFAULT now());
 CREATE TABLE stars_purchases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,stars integer,bonus_stars integer,price numeric,wallet_transaction_id uuid);
 CREATE TABLE ai_premium_subscriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,plan text,paid_with text,amount numeric,expires_at timestamptz);
 CREATE TABLE airtime_topups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,phone text,amount numeric,status text,wallet_transaction_id uuid,idempotency_key text UNIQUE);
 -- Crypto is stubbed ONLY in this disposable database; production uses existing bcrypt.
 CREATE FUNCTION crypt(text,text) RETURNS text LANGUAGE sql AS $$ SELECT $1 $$;
 CREATE FUNCTION has_recent_otp(integer) RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.otp',true),'false')='true' $$;
 CREATE FUNCTION get_public_profile(uuid) RETURNS TABLE(name text) LANGUAGE sql AS $$ SELECT 'Hidden profile'::text $$;
 CREATE FUNCTION dispatch_push_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
 CREATE FUNCTION apply_wallet_transaction_balance() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE d numeric; b numeric; BEGIN
 IF NEW.status<>'completed' THEN RETURN NEW; END IF;
 d:=CASE WHEN NEW.type IN('deposit','transfer_in','refund','bonus') THEN NEW.amount-NEW.fee ELSE -NEW.amount-NEW.fee END;
 SELECT balance INTO b FROM wallets WHERE id=NEW.wallet_id FOR UPDATE;
 IF b+d<0 THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
 UPDATE wallets SET balance=b+d WHERE id=NEW.wallet_id;
 NEW.balance_before:=b; NEW.balance_after:=b+d; RETURN NEW; END $$;
 CREATE TRIGGER balance_insert BEFORE INSERT ON wallet_transactions FOR EACH ROW EXECUTE FUNCTION apply_wallet_transaction_balance();
 CREATE FUNCTION prevent_transaction_modification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.status IN('completed','failed','reversed') THEN RAISE EXCEPTION 'Immutable transaction'; END IF; RETURN NEW; END $$;
 CREATE TRIGGER immutable BEFORE UPDATE ON wallet_transactions FOR EACH ROW EXECUTE FUNCTION prevent_transaction_modification();`);
 await db.exec(readFileSync('supabase/migrations/20261022095300_wallet_audit.sql','utf8'));
 const oldStars=readFileSync('supabase/migrations/20260607034822_5b9e578a-160d-4077-b6e1-edd26e15105e.sql','utf8');
 await db.exec(oldStars.slice(oldStars.indexOf('CREATE OR REPLACE FUNCTION public.purchase_stars_with_wallet')));
 await db.exec(readFileSync('drizzle/migrations/0011_wallet_purchase_security.sql','utf8'));
},30000);
beforeEach(async()=>{
 await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${A}',false); SELECT set_config('test.otp','false',false);
 DROP TRIGGER IF EXISTS fail_credit ON wallet_transactions;
 DELETE FROM wallet_transactions; DELETE FROM payment_requests; DELETE FROM airtime_topups; DELETE FROM wallets; DELETE FROM wallet_pin_failures; DELETE FROM wallet_trusted_devices; DELETE FROM wallet_terms_acceptance;
 DELETE FROM stars_balances; DELETE FROM stars_purchases; DELETE FROM ai_premium_subscriptions;
 INSERT INTO wallets(user_id,balance,status,pin_hash) VALUES('${A}',10000,'active','123456'),('${B}',1000,'active','1234');
 INSERT INTO wallet_trusted_devices VALUES('${A}','device-a');`);
});
afterAll(async()=>{await db?.close();});
describe('actual wallet audit SQL',()=>{
 it('forbids fabricated client wallet creation',async()=>{await db.exec('SET ROLE authenticated'); await expect(db.exec(`INSERT INTO wallets(user_id,balance,status) VALUES('${A}',999999,'active')`)).rejects.toThrow();});
 it('commits debit and credit together',async()=>{expect((await transfer()).success).toBe(true);expect(await balances()).toEqual([9900,1100]);});
 it('rolls back debit when credit fails',async()=>{
 await db.exec(`CREATE OR REPLACE FUNCTION fail_credit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type='transfer_in' THEN RAISE EXCEPTION 'injected credit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_credit BEFORE INSERT ON wallet_transactions FOR EACH ROW EXECUTE FUNCTION fail_credit_test();`);
 expect((await transfer()).success).toBe(false);expect(await balances()).toEqual([10000,1000]); expect((await db.query('SELECT id FROM wallet_transactions')).rows).toHaveLength(0);
 });
 it('replays the same key once and rejects changed amount',async()=>{const t=await transfer();const replay=await transfer();expect(replay.duplicate).toBe(true);expect(replay.transaction.id).toBe(t.transaction.id);expect((await transfer(200)).success).toBe(false);expect(await balances()).toEqual([9900,1100]);});
 it('separates operation keys between users',async()=>{await transfer();await db.exec(`SELECT set_config('request.jwt.claim.sub','${B}',false)`);const r=await call(`wallet_transfer_atomic('${A}',50,'test','test-key-0001','1234','device-b',NULL)`);expect(r.success).toBe(true);expect(r.duplicate).not.toBe(true);expect(await balances()).toEqual([9950,1050]);});
 it('requires PIN on a standard transfer without requiring email',async()=>{expect((await call(`wallet_transfer_atomic('${B}',100,'','wrong-key-01','0000','device-a',NULL)`)).success).toBe(false);expect((await transfer()).success).toBe(true);});
 it('requires email only above 5000 ETB',async()=>{expect((await transfer(5000)).success).toBe(true);expect((await transfer(5000.01,'other-key-01')).error).toBe('STEP_UP_REQUIRED');});
 it('locks every PIN path on five wrong attempts for fifteen minutes',async()=>{for(let i=0;i<5;i++) await call(`wallet_verify_own_pin('0000','device-a')`);expect((await call(`wallet_verify_own_pin('123456','device-a')`)).ok).toBe(false);expect((await transfer()).success).toBe(false);const r=(await db.query<{seconds:number}>(`SELECT extract(epoch FROM locked_until-now()) AS seconds FROM wallet_pin_failures`)).rows[0];expect(Number(r.seconds)).toBeGreaterThan(890);expect(Number(r.seconds)).toBeLessThanOrEqual(900);});
 it.each(['12345','1234567','12345678'])('rejects %s even if stored hash matches',async pin=>{await db.exec(`UPDATE wallets SET pin_hash='${pin}' WHERE user_id='${A}'`);expect((await call(`wallet_verify_own_pin('${pin}','device-a')`)).ok).toBe(false);});
 it('enforces device trust for direct calls',async()=>{expect((await call(`wallet_transfer_atomic('${B}',100,'','test-key-0001','123456','unknown-device',NULL)`)).error).toBe('STEP_UP_REQUIRED');expect(await balances()).toEqual([10000,1000]);});
 it('pays a matching pending request only once',async()=>{const id='00000000-0000-4000-8000-000000000030';await db.exec(`INSERT INTO payment_requests(id,payer_id,requester_id,amount) VALUES('${id}','${A}','${B}',100)`);expect((await transfer(100,'request-key-1',id)).success).toBe(true);expect((await transfer(100,'request-key-2',id)).success).toBe(false);expect((await db.query(`SELECT status FROM payment_requests`)).rows[0]).toEqual({status:'paid'});expect(await balances()).toEqual([9900,1100]);});
 it.each(['cancelled','declined'])('does not debit a %s request',async status=>{const id='00000000-0000-4000-8000-000000000031';await db.exec(`INSERT INTO payment_requests(id,payer_id,requester_id,amount,status) VALUES('${id}','${A}','${B}',100,'${status}')`);expect((await transfer(100,'request-key-1',id)).success).toBe(false);expect(await balances()).toEqual([10000,1000]);});
 it('cannot reactivate suspended wallets or disclose PIN hashes',async()=>{await db.exec(`UPDATE wallets SET status='suspended' WHERE user_id='${A}'`);expect((await call(`wallet_activate_secure('device-a','','')`)).success).toBe(false);await db.exec(`UPDATE wallets SET status='pending_activation' WHERE user_id='${A}'`);const r=await call(`wallet_activate_secure('device-a','','')`);expect(r.wallet.balance).toBe(10000);expect(r.wallet).not.toHaveProperty('pin_hash');});
 it('records airtime pending, debits once, and rejects changed payload',async()=>{const sql=`airtime_topup('0911223344',5,'123456','airtime-key-1','device-a')`;const r=(await db.query(`SELECT * FROM ${sql}`)).rows[0] as any;expect(r.success).toBe(true);expect((await db.query(`SELECT * FROM ${sql}`)).rows[0]).toMatchObject({duplicate:true});expect((await db.query(`SELECT * FROM airtime_topup('0911223344',10,'123456','airtime-key-1','device-a')`)).rows[0]).toMatchObject({success:false});expect((await db.query('SELECT status FROM airtime_topups')).rows[0]).toEqual({status:'pending'});expect(await balances()).toEqual([9995,1000]);});
 it.each([4.99,1000.01])('rejects airtime outside 5–1000 ETB: %s',async amount=>{expect((await db.query(`SELECT * FROM airtime_topup('0911223344',${amount},'123456','airtime-key-1','device-a')`)).rows[0]).toMatchObject({success:false});});
 it('keeps pending deposits uncredited and credits settlement once',async()=>{const r=await call(`wallet_deposit_request(100,'Telebirr','deposit-key-1','device-a')`);expect(r.pending).toBe(true);expect(await balances()).toEqual([10000,1000]);await db.exec(`UPDATE wallet_transactions SET status='completed' WHERE id='${r.transaction.id}'`);expect(await balances()).toEqual([10100,1000]);await expect(db.exec(`UPDATE wallet_transactions SET status='completed' WHERE id='${r.transaction.id}'`)).rejects.toThrow();expect(await balances()).toEqual([10100,1000]);});
 it('never reads another account wallet by ID',async()=>{expect((await db.query(`SELECT * FROM get_user_wallet('${B}')`)).rows).toEqual([]);const id=(await db.query<{id:string}>(`SELECT id FROM wallets WHERE user_id='${B}'`)).rows[0].id;expect(await call(`get_wallet_balance('${id}')`)).toBeNull();});
 it('requires a PIN for Stars wallet purchases',async()=>{expect((await call(`purchase_stars_with_wallet(100,0,120,'stars-key-01',NULL,'device-a')`)).success).toBe(false);expect(await balances()).toEqual([10000,1000]);expect((await call(`purchase_stars_with_wallet(100,0,120,'stars-key-01','123456','device-a')`)).success).toBe(true);expect(await balances()).toEqual([9880,1000]);});
 it('requires a trusted device for Stars purchases',async()=>{expect((await call(`purchase_stars_with_wallet(100,0,120,'stars-key-01','123456','unknown-device')`)).error).toBe('STEP_UP_REQUIRED');expect(await balances()).toEqual([10000,1000]);});
 it('rejects direct legacy Stars purchase calls without PIN',async()=>{await db.exec('SET ROLE authenticated');await expect(db.query(`SELECT * FROM purchase_stars_with_wallet(100,0,120,'legacy-key-01')`)).rejects.toThrow('permission denied');});
 it('Stars retry credits once and rejects changed package',async()=>{const sql=`purchase_stars_with_wallet(100,0,120,'stars-key-01','123456','device-a')`;expect((await call(sql)).success).toBe(true);expect((await call(sql)).duplicate).toBe(true);expect((await call(`purchase_stars_with_wallet(500,0,550,'stars-key-01','123456','device-a')`)).success).toBe(false);expect(await balances()).toEqual([9880,1000]);expect((await db.query(`SELECT balance FROM stars_balances`)).rows).toEqual([{balance:200}]);});
 it('Stars retry still succeeds after spending available wallet balance',async()=>{await db.exec(`UPDATE wallets SET balance=120 WHERE user_id='${A}'`);const sql=`purchase_stars_with_wallet(100,0,120,'stars-key-01','123456','device-a')`;await call(sql);expect((await call(sql)).duplicate).toBe(true);expect(await balances()).toEqual([0,1000]);});
 it('requires PIN for AI wallet purchase, while allowing Stars payment without wallet PIN',async()=>{expect((await call(`purchase_ai_premium_secure('day','wallet','premium-key1',NULL,'device-a')`)).success).toBe(false);expect((await call(`purchase_ai_premium_secure('day','wallet','premium-key1','123456','device-a')`)).success).toBe(true);expect(await balances()).toEqual([9990,1000]);expect((await call(`purchase_ai_premium_secure('day','stars','premium-key2')`)).success).toBe(true);expect(await balances()).toEqual([9990,1000]);expect((await db.query(`SELECT balance FROM stars_balances`)).rows).toEqual([{balance:50}]);});
 it('legacy AI wallet calls cannot debit without PIN',async()=>{expect((await db.query(`SELECT * FROM purchase_ai_premium('day','wallet')`)).rows[0]).toMatchObject({success:false});expect(await balances()).toEqual([10000,1000]);});
 it('AI retry extends subscription once and rejects changed plan',async()=>{const sql=`purchase_ai_premium_secure('day','wallet','premium-key1','123456','device-a')`;const r=await call(sql);const again=await call(sql);expect(again.duplicate).toBe(true);expect(again.expires_at).toBe(r.expires_at);expect((await call(`purchase_ai_premium_secure('month','wallet','premium-key1','123456','device-a')`)).success).toBe(false);expect((await db.query(`SELECT id FROM ai_premium_subscriptions`)).rows).toHaveLength(1);expect(await balances()).toEqual([9990,1000]);});
 it('all purchase failures share the five-attempt fifteen-minute PIN lock',async()=>{for(let i=0;i<5;i++) await call(`purchase_stars_with_wallet(100,0,120,'stars-key-01','0000','device-a')`);expect((await call(`purchase_ai_premium_secure('day','wallet','premium-key1','123456','device-a')`)).success).toBe(false);expect((await transfer()).success).toBe(false);expect(await balances()).toEqual([10000,1000]);});
 it('purchase RPCs cannot exceed configured daily wallet limit',async()=>{await db.exec(`UPDATE wallets SET daily_limit=100 WHERE user_id='${A}'`);expect((await call(`purchase_stars_with_wallet(100,0,120,'stars-key-01','123456','device-a')`)).error).toBe('Daily wallet limit exceeded');expect(await balances()).toEqual([10000,1000]);});
});
