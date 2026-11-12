CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 150),
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general','account','wallet','technical','other')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','replied','resolved')),
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own tickets" ON public.support_tickets FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users create own tickets" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'open' AND admin_reply IS NULL AND replied_at IS NULL);
CREATE INDEX support_tickets_user_idx ON public.support_tickets(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_list_tickets(p_limit int DEFAULT 100)
RETURNS TABLE(id uuid, user_email text, user_name text, subject text, category text, message text, status text, admin_reply text, replied_at timestamptz, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT t.id, u.email::text, coalesce(p.name, p.username), t.subject, t.category, t.message, t.status, t.admin_reply, t.replied_at, t.created_at
  FROM public.support_tickets t LEFT JOIN auth.users u ON u.id = t.user_id LEFT JOIN public.profiles p ON p.id = t.user_id
  ORDER BY (t.status = 'open') DESC, t.created_at DESC LIMIT least(greatest(p_limit,1),300);
END $$;

CREATE OR REPLACE FUNCTION public.admin_reply_ticket(p_id uuid, p_reply text, p_status text DEFAULT 'replied')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('replied','resolved') THEN RAISE EXCEPTION 'bad status'; END IF;
  IF p_reply IS NULL OR char_length(trim(p_reply)) = 0 OR char_length(p_reply) > 4000 THEN RAISE EXCEPTION 'bad reply'; END IF;
  UPDATE public.support_tickets SET admin_reply = trim(p_reply), status = p_status, replied_at = now() WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_list_tickets(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_tickets(int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_reply_ticket(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reply_ticket(uuid, text, text) TO authenticated;