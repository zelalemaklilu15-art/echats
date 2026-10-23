ALTER FUNCTION public.set_wallet_pin(text) SET search_path = public, extensions;
DO $$ DECLARE r record; BEGIN
FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='wallet_pin_error' LOOP
EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', r.sig);
END LOOP; END $$;