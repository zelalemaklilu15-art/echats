CREATE TABLE public.channels (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  avatar_color text NOT NULL DEFAULT 'hsl(210, 80%, 55%)',
  pinned_message_id text,
  link text,
  subscriber_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.channel_subscribers (
  channel_id text NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.channel_subscribers TO authenticated;
GRANT ALL ON public.channel_subscribers TO service_role;
ALTER TABLE public.channel_subscribers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.channel_posts (
  id text PRIMARY KEY,
  channel_id text NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_name text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 8000),
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text','image','announcement')),
  views integer NOT NULL DEFAULT 0,
  edited boolean NOT NULL DEFAULT false,
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX channel_posts_channel_idx ON public.channel_posts(channel_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_posts TO authenticated;
GRANT ALL ON public.channel_posts TO service_role;
ALTER TABLE public.channel_posts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_channel(_channel_id text, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.channels c WHERE c.id = _channel_id
    AND (c.is_public OR c.created_by = _uid
      OR EXISTS (SELECT 1 FROM public.channel_subscribers s WHERE s.channel_id = c.id AND s.user_id = _uid)));
$$;
CREATE OR REPLACE FUNCTION public.is_channel_owner(_channel_id text, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.channels WHERE id = _channel_id AND created_by = _uid);
$$;

CREATE POLICY "view channels" ON public.channels FOR SELECT TO authenticated
  USING (is_public OR created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.channel_subscribers s WHERE s.channel_id = id AND s.user_id = auth.uid()));
CREATE POLICY "create own channels" ON public.channels FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "owner updates channel" ON public.channels FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "owner deletes channel" ON public.channels FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "see own subscriptions" ON public.channel_subscribers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_channel_owner(channel_id, auth.uid()));
CREATE POLICY "subscribe self" ON public.channel_subscribers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "unsubscribe self" ON public.channel_subscribers FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "view posts" ON public.channel_posts FOR SELECT TO authenticated USING (public.can_view_channel(channel_id, auth.uid()));
CREATE POLICY "owner posts" ON public.channel_posts FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_channel_owner(channel_id, auth.uid()));
CREATE POLICY "owner edits posts" ON public.channel_posts FOR UPDATE TO authenticated
  USING (public.is_channel_owner(channel_id, auth.uid())) WITH CHECK (public.is_channel_owner(channel_id, auth.uid()));
CREATE POLICY "owner deletes posts" ON public.channel_posts FOR DELETE TO authenticated USING (public.is_channel_owner(channel_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.sync_channel_subscriber_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id text := COALESCE(NEW.channel_id, OLD.channel_id);
BEGIN
  UPDATE public.channels SET subscriber_count = (SELECT count(*) FROM public.channel_subscribers WHERE channel_id = v_id) WHERE id = v_id;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_channel_sub_count AFTER INSERT OR DELETE ON public.channel_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.sync_channel_subscriber_count();

CREATE OR REPLACE FUNCTION public.toggle_channel_reaction(p_post_id text, p_emoji text, p_add boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_post public.channel_posts%ROWTYPE; v_list jsonb; v_r jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_emoji IS NULL OR char_length(p_emoji) > 16 THEN RAISE EXCEPTION 'Invalid reaction'; END IF;
  SELECT * INTO v_post FROM public.channel_posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_view_channel(v_post.channel_id, v_uid) THEN RAISE EXCEPTION 'Not found'; END IF;
  v_list := COALESCE(v_post.reactions->p_emoji, '[]'::jsonb) - v_uid::text;
  IF p_add THEN v_list := v_list || to_jsonb(v_uid::text); END IF;
  IF jsonb_array_length(v_list) = 0 THEN v_r := v_post.reactions - p_emoji;
  ELSE v_r := jsonb_set(v_post.reactions, ARRAY[p_emoji], v_list); END IF;
  UPDATE public.channel_posts SET reactions = v_r WHERE id = p_post_id;
  RETURN v_r;
END $$;
REVOKE EXECUTE ON FUNCTION public.toggle_channel_reaction(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_channel_reaction(text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_channel_views(p_channel_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_view_channel(p_channel_id, auth.uid())
     OR public.is_channel_owner(p_channel_id, auth.uid()) THEN RETURN; END IF;
  UPDATE public.channel_posts SET views = views + 1 WHERE channel_id = p_channel_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_channel_views(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_channel_views(text) TO authenticated;

-- Payment requests
CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  payer_id uuid NOT NULL,
  amount numeric(15,2) NOT NULL CHECK (amount > 0 AND amount <= 1000000),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 300),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','declined','cancelled')),
  paid_transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> payer_id)
);
CREATE INDEX payment_requests_payer_idx ON public.payment_requests(payer_id, status);
CREATE INDEX payment_requests_requester_idx ON public.payment_requests(requester_id, created_at DESC);
GRANT SELECT, INSERT ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties view requests" ON public.payment_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR payer_id = auth.uid());
CREATE POLICY "create own requests" ON public.payment_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'pending' AND paid_transaction_id IS NULL);
CREATE TRIGGER trg_payment_requests_updated_at BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.respond_payment_request(p_id uuid, p_action text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_req public.payment_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO v_req FROM public.payment_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_req.status <> 'pending' THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;
  IF p_action = 'decline' AND v_req.payer_id = v_uid THEN
    UPDATE public.payment_requests SET status = 'declined' WHERE id = p_id; RETURN 'declined';
  ELSIF p_action = 'cancel' AND v_req.requester_id = v_uid THEN
    UPDATE public.payment_requests SET status = 'cancelled' WHERE id = p_id; RETURN 'cancelled';
  END IF;
  RAISE EXCEPTION 'Not allowed';
END $$;
REVOKE EXECUTE ON FUNCTION public.respond_payment_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_payment_request(uuid, text) TO authenticated;

CREATE TRIGGER trg_push_channel_posts AFTER INSERT ON public.channel_posts FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_event();
CREATE TRIGGER trg_push_payment_requests AFTER INSERT OR UPDATE OF status ON public.payment_requests FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_event();