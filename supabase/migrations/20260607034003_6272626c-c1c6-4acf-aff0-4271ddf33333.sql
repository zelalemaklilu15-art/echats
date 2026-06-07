-- Secure virtual currency, public reads, wallet audit columns, and realtime live topics

-- 1) Backend-enforced Stars balances and ledger tables
CREATE TABLE IF NOT EXISTS public.stars_balances (
  user_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 100 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stars_balances TO authenticated;
GRANT ALL ON public.stars_balances TO service_role;
ALTER TABLE public.stars_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stars_balances_select_own ON public.stars_balances;
CREATE POLICY stars_balances_select_own
  ON public.stars_balances
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.stars_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stars integer NOT NULL CHECK (stars > 0),
  bonus_stars integer NOT NULL DEFAULT 0 CHECK (bonus_stars >= 0),
  price numeric(15,2) NOT NULL CHECK (price > 0),
  wallet_transaction_id uuid,
  purchased_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stars_purchases TO authenticated;
GRANT ALL ON public.stars_purchases TO service_role;
ALTER TABLE public.stars_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stars_purchases_select_own ON public.stars_purchases;
CREATE POLICY stars_purchases_select_own
  ON public.stars_purchases
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.stars_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id text NOT NULL,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  chat_id uuid NOT NULL,
  message text,
  stars integer NOT NULL CHECK (stars > 0),
  converted boolean NOT NULL DEFAULT false,
  stars_converted integer,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stars_gifts TO authenticated;
GRANT ALL ON public.stars_gifts TO service_role;
ALTER TABLE public.stars_gifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stars_gifts_select_participants ON public.stars_gifts;
CREATE POLICY stars_gifts_select_participants
  ON public.stars_gifts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE INDEX IF NOT EXISTS idx_stars_purchases_user_purchased ON public.stars_purchases(user_id, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_stars_gifts_sender_sent ON public.stars_gifts(sender_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_stars_gifts_receiver_sent ON public.stars_gifts(receiver_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_stars_gifts_chat_sent ON public.stars_gifts(chat_id, sent_at DESC);

CREATE TRIGGER update_stars_balances_updated_at
  BEFORE UPDATE ON public.stars_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_stars_balance()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.stars_balances(user_id, balance)
  VALUES (v_user_id, 100)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM public.stars_balances
  WHERE user_id = v_user_id;

  RETURN COALESCE(v_balance, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_stars_with_wallet(
  p_stars integer,
  p_bonus integer,
  p_price numeric,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE(success boolean, balance integer, purchase_id uuid, wallet_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_wallet_id uuid;
  v_wallet_balance numeric(15,2);
  v_purchase_id uuid;
  v_tx_id uuid;
  v_total integer;
  v_allowed boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_allowed :=
    (p_stars = 100 AND COALESCE(p_bonus, 0) = 0 AND p_price = 120)
    OR (p_stars = 500 AND COALESCE(p_bonus, 0) = 0 AND p_price = 550)
    OR (p_stars = 2500 AND COALESCE(p_bonus, 0) = 0 AND p_price = 2400)
    OR (p_stars = 10000 AND COALESCE(p_bonus, 0) = 0 AND p_price = 8900);

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid stars package';
  END IF;

  SELECT id, balance INTO v_wallet_id, v_wallet_balance
  FROM public.wallets
  WHERE user_id = v_user_id AND status = 'active'
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Active wallet not found';
  END IF;

  IF v_wallet_balance < p_price THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT sp.id INTO v_purchase_id
    FROM public.stars_purchases sp
    JOIN public.wallet_transactions wt ON wt.id = sp.wallet_transaction_id
    WHERE sp.user_id = v_user_id
      AND wt.idempotency_key = p_idempotency_key
    LIMIT 1;

    IF v_purchase_id IS NOT NULL THEN
      SELECT balance INTO balance FROM public.stars_balances WHERE user_id = v_user_id;
      SELECT w.balance INTO wallet_balance FROM public.wallets w WHERE w.id = v_wallet_id;
      success := true;
      purchase_id := v_purchase_id;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.wallet_transactions(
    wallet_id, type, status, amount, fee, balance_before, balance_after,
    description, idempotency_key, metadata, completed_at
  ) VALUES (
    v_wallet_id, 'payment', 'completed', p_price, 0, v_wallet_balance, v_wallet_balance - p_price,
    'Stars purchase', p_idempotency_key,
    jsonb_build_object('kind', 'stars_purchase', 'stars', p_stars, 'bonus_stars', COALESCE(p_bonus, 0)),
    now()
  ) RETURNING id INTO v_tx_id;

  v_total := p_stars + COALESCE(p_bonus, 0);

  INSERT INTO public.stars_balances(user_id, balance)
  VALUES (v_user_id, 100 + v_total)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.stars_balances.balance + v_total,
        updated_at = now()
  RETURNING public.stars_balances.balance INTO balance;

  INSERT INTO public.stars_purchases(user_id, stars, bonus_stars, price, wallet_transaction_id)
  VALUES (v_user_id, p_stars, COALESCE(p_bonus, 0), p_price, v_tx_id)
  RETURNING id INTO v_purchase_id;

  success := true;
  purchase_id := v_purchase_id;
  wallet_balance := v_wallet_balance - p_price;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_chat_gift(
  p_gift_id text,
  p_receiver_id uuid,
  p_chat_id uuid,
  p_message text,
  p_stars integer
)
RETURNS TABLE(success boolean, gift_instance_id uuid, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_gift_id uuid;
  v_clean_message text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_receiver_id IS NULL OR p_receiver_id = v_user_id THEN
    RAISE EXCEPTION 'Invalid gift recipient';
  END IF;

  IF p_stars NOT IN (5,10,15,25,30,45,50,75,80,100,150,200,250,300,500,750,1000) THEN
    RAISE EXCEPTION 'Invalid gift cost';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = p_chat_id
      AND ((c.participant_1 = v_user_id AND c.participant_2 = p_receiver_id)
        OR (c.participant_2 = v_user_id AND c.participant_1 = p_receiver_id))
  ) THEN
    RAISE EXCEPTION 'Not a chat participant';
  END IF;

  INSERT INTO public.stars_balances(user_id, balance)
  VALUES (v_user_id, 100)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT sb.balance INTO v_balance
  FROM public.stars_balances sb
  WHERE sb.user_id = v_user_id
  FOR UPDATE;

  IF COALESCE(v_balance, 0) < p_stars THEN
    RAISE EXCEPTION 'Insufficient Stars';
  END IF;

  UPDATE public.stars_balances
  SET balance = balance - p_stars,
      updated_at = now()
  WHERE user_id = v_user_id
  RETURNING public.stars_balances.balance INTO balance;

  v_clean_message := NULLIF(left(COALESCE(p_message, ''), 500), '');

  INSERT INTO public.stars_gifts(gift_id, sender_id, receiver_id, chat_id, message, stars)
  VALUES (p_gift_id, v_user_id, p_receiver_id, p_chat_id, v_clean_message, p_stars)
  RETURNING id INTO v_gift_id;

  success := true;
  gift_instance_id := v_gift_id;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_chat_gift_to_stars(p_gift_instance_id uuid)
RETURNS TABLE(success boolean, stars_added integer, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_gift public.stars_gifts%ROWTYPE;
  v_added integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_gift
  FROM public.stars_gifts
  WHERE id = p_gift_instance_id
  FOR UPDATE;

  IF v_gift.id IS NULL OR v_gift.receiver_id <> v_user_id OR v_gift.converted THEN
    success := false;
    stars_added := 0;
    SELECT COALESCE(sb.balance, 0) INTO balance FROM public.stars_balances sb WHERE sb.user_id = v_user_id;
    RETURN NEXT;
    RETURN;
  END IF;

  v_added := floor(v_gift.stars * 0.5)::integer;

  UPDATE public.stars_gifts
  SET converted = true,
      stars_converted = v_added
  WHERE id = p_gift_instance_id;

  INSERT INTO public.stars_balances(user_id, balance)
  VALUES (v_user_id, 100 + v_added)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.stars_balances.balance + v_added,
        updated_at = now()
  RETURNING public.stars_balances.balance INTO balance;

  success := true;
  stars_added := v_added;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_stars_balance() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purchase_stars_with_wallet(integer, integer, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_chat_gift(text, uuid, uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.convert_chat_gift_to_stars(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_stars_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_stars_with_wallet(integer, integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_gift(text, uuid, uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_chat_gift_to_stars(uuid) TO authenticated;

-- 2) Backend-enforced Etok coin spending and live gift sending
CREATE OR REPLACE FUNCTION public.get_or_create_etok_coins()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.etok_coins(user_id, balance)
  VALUES (v_user_id, 500)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM public.etok_coins
  WHERE user_id = v_user_id;

  RETURN COALESCE(v_balance, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.send_etok_live_gift(
  p_stream_id uuid,
  p_gift_id text,
  p_recipient_id uuid,
  p_gift_emoji text,
  p_gift_name text,
  p_coins integer
)
RETURNS TABLE(success boolean, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_coins NOT IN (1,5,10,30,50,80,100,150,200,300,500,1000) THEN
    RAISE EXCEPTION 'Invalid gift cost';
  END IF;

  IF p_recipient_id IS NULL OR p_recipient_id = v_user_id THEN
    RAISE EXCEPTION 'Invalid gift recipient';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.etok_live_streams s
    WHERE s.id = p_stream_id
      AND s.host_id = p_recipient_id
      AND s.is_live = true
  ) THEN
    RAISE EXCEPTION 'Live stream not found';
  END IF;

  INSERT INTO public.etok_coins(user_id, balance)
  VALUES (v_user_id, 500)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT ec.balance INTO v_balance
  FROM public.etok_coins ec
  WHERE ec.user_id = v_user_id
  FOR UPDATE;

  IF COALESCE(v_balance, 0) < p_coins THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  UPDATE public.etok_coins
  SET balance = balance - p_coins,
      updated_at = now()
  WHERE user_id = v_user_id
  RETURNING public.etok_coins.balance INTO balance;

  INSERT INTO public.etok_gifts_sent(stream_id, sender_id, recipient_id, gift_id, gift_emoji, gift_name, coins)
  VALUES (p_stream_id, v_user_id, p_recipient_id, p_gift_id, left(p_gift_emoji, 16), left(p_gift_name, 80), p_coins);

  UPDATE public.etok_live_streams
  SET gift_total = gift_total + p_coins
  WHERE id = p_stream_id;

  INSERT INTO public.etok_live_comments(stream_id, author_id, text, is_gift, gift_emoji)
  VALUES (p_stream_id, v_user_id, 'sent a ' || left(p_gift_name, 80), true, left(p_gift_emoji, 16));

  success := true;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_etok_coins() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_etok_live_gift(uuid, text, uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_etok_coins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_etok_live_gift(uuid, text, uuid, text, text, integer) TO authenticated;

-- Keep direct coin writes unavailable to clients. Service role/function owner can still manage balances.
DROP POLICY IF EXISTS coins_insert ON public.etok_coins;
DROP POLICY IF EXISTS coins_update ON public.etok_coins;
DROP POLICY IF EXISTS "Users can insert their own coins" ON public.etok_coins;
DROP POLICY IF EXISTS "Users can update their own coins" ON public.etok_coins;

-- 3) Restrict public Etok reads to authenticated users only
DROP POLICY IF EXISTS etok_comments_select ON public.etok_comments;
CREATE POLICY etok_comments_select
  ON public.etok_comments
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS etok_follows_select ON public.etok_follows;
CREATE POLICY etok_follows_select
  ON public.etok_follows
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS etok_likes_select ON public.etok_likes;
CREATE POLICY etok_likes_select
  ON public.etok_likes
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS live_comments_select ON public.etok_live_comments;
CREATE POLICY live_comments_select
  ON public.etok_live_comments
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS live_streams_select ON public.etok_live_streams;
CREATE POLICY live_streams_select
  ON public.etok_live_streams
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS live_viewers_select ON public.etok_live_viewers;
CREATE POLICY live_viewers_select
  ON public.etok_live_viewers
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS sched_select ON public.etok_scheduled_lives;
CREATE POLICY sched_select
  ON public.etok_scheduled_lives
  FOR SELECT
  TO authenticated
  USING (true);

-- 4) Hide wallet audit IP/user-agent fields from client SELECTs
REVOKE SELECT ON public.wallet_terms_acceptance FROM anon;
REVOKE SELECT ON public.wallet_terms_acceptance FROM authenticated;
GRANT SELECT (id, user_id, terms_version, accepted_at) ON public.wallet_terms_acceptance TO authenticated;
GRANT ALL ON public.wallet_terms_acceptance TO service_role;

-- 5) Scope realtime authorization to live stream participants and user's own WebRTC/call topics
DROP POLICY IF EXISTS authenticated_can_subscribe_own_topics ON realtime.messages;
CREATE POLICY authenticated_can_subscribe_own_topics
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE ('user:' || auth.uid()::text || '%')
  OR (
    realtime.topic() LIKE 'chat:%'
    AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id::text = substring(realtime.topic() FROM 6)
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  )
  OR (
    realtime.topic() LIKE 'group:%'
    AND public.is_group_member((substring(realtime.topic() FROM 7))::uuid, auth.uid())
  )
  OR realtime.topic() LIKE ('rtc:' || auth.uid()::text || '%')
  OR realtime.topic() LIKE ('rtc-' || auth.uid()::text || '%')
  OR realtime.topic() LIKE ('call:' || auth.uid()::text || '%')
  OR realtime.topic() LIKE ('calls:' || auth.uid()::text || '%')
  OR (
    realtime.topic() LIKE 'live:%'
    AND EXISTS (
      SELECT 1 FROM public.etok_live_streams s
      WHERE s.id::text = substring(realtime.topic() FROM 6)
        AND (
          s.host_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.etok_live_viewers v
            WHERE v.stream_id = s.id AND v.user_id = auth.uid()
          )
        )
    )
  )
  OR (
    realtime.topic() LIKE 'live-stream-%'
    AND EXISTS (
      SELECT 1 FROM public.etok_live_streams s
      WHERE s.id::text = substring(realtime.topic() FROM 13)
        AND (
          s.host_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.etok_live_viewers v
            WHERE v.stream_id = s.id AND v.user_id = auth.uid()
          )
        )
    )
  )
  OR (
    realtime.topic() LIKE 'live-comments-%'
    AND EXISTS (
      SELECT 1 FROM public.etok_live_streams s
      WHERE s.id::text = substring(realtime.topic() FROM 15)
        AND (
          s.host_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.etok_live_viewers v
            WHERE v.stream_id = s.id AND v.user_id = auth.uid()
          )
        )
    )
  )
);

DROP POLICY IF EXISTS realtime_authenticated_insert ON realtime.messages;
CREATE POLICY realtime_authenticated_insert
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);