REVOKE EXECUTE ON FUNCTION public.apply_wallet_transaction_balance() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_wallet_transaction_balance() FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_wallet_transaction_balance() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_wallet_transaction_balance() TO service_role;