DROP TRIGGER IF EXISTS prevent_funded_wallet_delete_trg ON public.wallets;
DROP FUNCTION IF EXISTS public.prevent_funded_wallet_delete();