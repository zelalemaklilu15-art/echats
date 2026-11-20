CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('user','ai','admin')),
  sender_email text NOT NULL,
  mailbox text NOT NULL DEFAULT 'support' CHECK (mailbox IN ('support','partnerships','sales','admin','info')),
  subject text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_ticket_messages_ticket_idx ON public.support_ticket_messages(ticket_id, created_at);
CREATE INDEX support_ticket_messages_email_idx ON public.support_ticket_messages(lower(sender_email), created_at);
GRANT SELECT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their ticket messages" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (ticket_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.support_find_user_by_email(p_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.support_find_user_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_find_user_by_email(text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_list_ticket_messages(p_limit int DEFAULT 500)
RETURNS SETOF public.support_ticket_messages LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'not found'; END IF;
  RETURN QUERY SELECT * FROM public.support_ticket_messages ORDER BY created_at DESC LIMIT LEAST(GREATEST(p_limit,1),2000);
END $$;
REVOKE ALL ON FUNCTION public.admin_list_ticket_messages(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_ticket_messages(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_add_ticket_message(p_ticket uuid, p_email text, p_mailbox text, p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'not found'; END IF;
  IF length(trim(coalesce(p_body,''))) = 0 OR length(p_body) > 10000 THEN RAISE EXCEPTION 'invalid body'; END IF;
  INSERT INTO public.support_ticket_messages(ticket_id, sender_type, sender_email, mailbox, body)
  VALUES (p_ticket, 'admin', lower(p_email), coalesce(p_mailbox,'support'), p_body) RETURNING id INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.admin_add_ticket_message(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_ticket_message(uuid,text,text,text) TO authenticated;