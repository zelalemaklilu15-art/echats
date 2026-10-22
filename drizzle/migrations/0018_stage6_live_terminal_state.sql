CREATE OR REPLACE FUNCTION public.guard_live_terminal_state()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF NOT OLD.is_live AND NEW.is_live THEN
      RAISE EXCEPTION 'Ended broadcasts cannot be resumed; start a new live stream';
    END IF;
    IF OLD.is_live AND NOT NEW.is_live THEN
      NEW.ended_at := now();
    ELSIF NEW.ended_at IS DISTINCT FROM OLD.ended_at THEN
      RAISE EXCEPTION 'The live end time is server-managed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_live_terminal_state BEFORE UPDATE ON public.etok_live_streams FOR EACH ROW EXECUTE FUNCTION public.guard_live_terminal_state();