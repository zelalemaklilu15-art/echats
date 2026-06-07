DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.etok_gifts_sent;
  EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN invalid_parameter_value THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.etok_live_viewers;
  EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN invalid_parameter_value THEN NULL;
  END;
END $$;