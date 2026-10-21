CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.push_dispatch_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  secret text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  endpoint text NOT NULL
);
GRANT ALL ON public.push_dispatch_config TO service_role;
ALTER TABLE public.push_dispatch_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.push_dispatch_config(id, endpoint)
VALUES (1, 'https://ldocprioqcxxzadisoii.supabase.co/functions/v1/push-dispatch');

CREATE OR REPLACE FUNCTION public.dispatch_push_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_cfg public.push_dispatch_config%ROWTYPE;
BEGIN
  BEGIN
    SELECT * INTO v_cfg FROM public.push_dispatch_config WHERE id = 1;
    IF v_cfg.endpoint IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_cfg.endpoint,
        headers := jsonb_build_object('Content-Type','application/json','x-push-secret', v_cfg.secret),
        body := jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP, 'record', to_jsonb(NEW))
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push dispatch skipped: %', SQLERRM;
  END;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.dispatch_push_event() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_push_messages AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_event();
CREATE TRIGGER trg_push_group_messages AFTER INSERT ON public.group_messages FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_event();
CREATE TRIGGER trg_push_etok_likes AFTER INSERT ON public.etok_likes FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_event();
CREATE TRIGGER trg_push_etok_comments AFTER INSERT ON public.etok_comments FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_event();
CREATE TRIGGER trg_push_etok_follows AFTER INSERT ON public.etok_follows FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_event();
CREATE TRIGGER trg_push_etok_videos AFTER INSERT ON public.etok_videos FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_event();
CREATE TRIGGER trg_push_etok_live AFTER INSERT ON public.etok_live_streams FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_event();
CREATE TRIGGER trg_push_stars_gifts AFTER INSERT ON public.stars_gifts FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_event();
CREATE TRIGGER trg_push_user_stories AFTER INSERT ON public.user_stories FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_event();
CREATE TRIGGER trg_push_call_logs AFTER INSERT OR UPDATE OF status ON public.call_logs FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_event();