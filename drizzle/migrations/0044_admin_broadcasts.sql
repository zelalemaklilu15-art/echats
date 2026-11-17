CREATE TABLE public.admin_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_broadcasts TO service_role;
ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_push_admin_broadcasts AFTER INSERT ON public.admin_broadcasts
FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_event();

CREATE OR REPLACE FUNCTION public.admin_send_broadcast(p_title text, p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF length(trim(coalesce(p_title,''))) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Title must be 1-80 characters'; END IF;
  IF length(trim(coalesce(p_body,''))) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'Message must be 1-300 characters'; END IF;
  INSERT INTO public.admin_broadcasts(title, body, created_by) VALUES (trim(p_title), trim(p_body), auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_broadcasts(p_limit int DEFAULT 50)
RETURNS SETOF public.admin_broadcasts LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT * FROM public.admin_broadcasts ORDER BY created_at DESC LIMIT least(greatest(p_limit,1),200);
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_send_broadcast(text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_broadcasts(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_send_broadcast(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_broadcasts(int) TO authenticated;