CREATE OR REPLACE FUNCTION public.wallet_tx_is_detach(o public.wallet_transactions, n public.wallet_transactions)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (n.wallet_id IS NULL OR n.wallet_id IS NOT DISTINCT FROM o.wallet_id)
     AND (n.counterparty_wallet_id IS NULL OR n.counterparty_wallet_id IS NOT DISTINCT FROM o.counterparty_wallet_id)
     AND (n.wallet_id IS DISTINCT FROM o.wallet_id OR n.counterparty_wallet_id IS DISTINCT FROM o.counterparty_wallet_id)
     AND (to_jsonb(n) - 'wallet_id' - 'counterparty_wallet_id') = (to_jsonb(o) - 'wallet_id' - 'counterparty_wallet_id')
$$;

CREATE OR REPLACE FUNCTION public.guard_wallet_transaction_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF public.wallet_tx_is_detach(OLD, NEW) AND NOT EXISTS (SELECT 1 FROM public.wallets w WHERE w.id IN (OLD.wallet_id, OLD.counterparty_wallet_id) AND (w.id = OLD.wallet_id AND NEW.wallet_id IS NULL OR w.id = OLD.counterparty_wallet_id AND NEW.counterparty_wallet_id IS NULL)) THEN
   RETURN NEW;
 END IF;
 IF NEW.wallet_id IS DISTINCT FROM OLD.wallet_id OR NEW.amount IS DISTINCT FROM OLD.amount OR NEW.fee IS DISTINCT FROM OLD.fee OR NEW.type IS DISTINCT FROM OLD.type OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR NEW.counterparty_wallet_id IS DISTINCT FROM OLD.counterparty_wallet_id THEN RAISE EXCEPTION 'Cannot change transaction financial fields'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_transaction_modification()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public.wallet_tx_is_detach(OLD, NEW) AND NOT EXISTS (SELECT 1 FROM public.wallets w WHERE (w.id = OLD.wallet_id AND NEW.wallet_id IS NULL) OR (w.id = OLD.counterparty_wallet_id AND NEW.counterparty_wallet_id IS NULL)) THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('completed', 'failed', 'reversed') THEN
    RAISE EXCEPTION 'Cannot modify a completed, failed, or reversed transaction';
  END IF;
  RETURN NEW;
END $$;

ALTER TABLE public.wallet_transactions ALTER COLUMN wallet_id DROP NOT NULL;
ALTER TABLE public.wallet_transactions DROP CONSTRAINT wallet_transactions_wallet_id_fkey,
  ADD CONSTRAINT wallet_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE SET NULL;
ALTER TABLE public.wallet_transactions DROP CONSTRAINT wallet_transactions_counterparty_wallet_id_fkey,
  ADD CONSTRAINT wallet_transactions_counterparty_wallet_id_fkey FOREIGN KEY (counterparty_wallet_id) REFERENCES public.wallets(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.prevent_funded_wallet_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.balance > 0 THEN
    RAISE EXCEPTION 'This wallet still holds a balance of % %. Withdraw or refund it before deleting the account.', OLD.balance, OLD.currency;
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS prevent_funded_wallet_delete_trg ON public.wallets;
CREATE TRIGGER prevent_funded_wallet_delete_trg BEFORE DELETE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.prevent_funded_wallet_delete();