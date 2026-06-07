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
  v_cost integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_cost := CASE p_gift_id
    WHEN 'rose' THEN 10
    WHEN 'butterfly' THEN 15
    WHEN 'cherry' THEN 5
    WHEN 'fire' THEN 30
    WHEN 'star' THEN 25
    WHEN 'cake' THEN 25
    WHEN 'moon' THEN 45
    WHEN 'heart' THEN 50
    WHEN 'rocket' THEN 75
    WHEN 'lightning' THEN 80
    WHEN 'trophy' THEN 100
    WHEN 'rainbow' THEN 150
    WHEN 'gem' THEN 200
    WHEN 'unicorn' THEN 250
    WHEN 'crystal' THEN 300
    WHEN 'dragon' THEN 500
    WHEN 'planet' THEN 750
    WHEN 'crown' THEN 1000
    ELSE NULL
  END;

  IF v_cost IS NULL OR p_stars <> v_cost THEN
    RAISE EXCEPTION 'Invalid gift cost';
  END IF;

  IF p_receiver_id IS NULL OR p_receiver_id = v_user_id THEN
    RAISE EXCEPTION 'Invalid gift recipient';
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

  IF COALESCE(v_balance, 0) < v_cost THEN
    RAISE EXCEPTION 'Insufficient Stars';
  END IF;

  UPDATE public.stars_balances
  SET balance = balance - v_cost,
      updated_at = now()
  WHERE user_id = v_user_id
  RETURNING public.stars_balances.balance INTO balance;

  v_clean_message := NULLIF(left(COALESCE(p_message, ''), 500), '');

  INSERT INTO public.stars_gifts(gift_id, sender_id, receiver_id, chat_id, message, stars)
  VALUES (p_gift_id, v_user_id, p_receiver_id, p_chat_id, v_clean_message, v_cost)
  RETURNING id INTO v_gift_id;

  success := true;
  gift_instance_id := v_gift_id;
  RETURN NEXT;
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
  v_coins integer;
  v_emoji text;
  v_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT gift_cost, gift_emoji, gift_name
  INTO v_coins, v_emoji, v_name
  FROM (VALUES
    ('lg1', 1, '🌹', 'Rose'),
    ('lg2', 5, '🍭', 'Lollipop'),
    ('lg3', 10, '🍩', 'Doughnut'),
    ('lg4', 30, '🍦', 'Ice Cream'),
    ('lg5', 100, '💎', 'Diamond'),
    ('lg6', 500, '👑', 'Crown'),
    ('lg7', 200, '🚀', 'Rocket'),
    ('lg8', 50, '🦁', 'Lion'),
    ('lg9', 150, '🌈', 'Rainbow'),
    ('lg10', 80, '⚡', 'Thunder'),
    ('lg11', 1000, '🏆', 'Trophy'),
    ('lg12', 300, '🎆', 'Fireworks')
  ) AS gifts(gift_id, gift_cost, gift_emoji, gift_name)
  WHERE gift_id = p_gift_id;

  IF v_coins IS NULL OR p_coins <> v_coins THEN
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

  IF COALESCE(v_balance, 0) < v_coins THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  UPDATE public.etok_coins
  SET balance = balance - v_coins,
      updated_at = now()
  WHERE user_id = v_user_id
  RETURNING public.etok_coins.balance INTO balance;

  INSERT INTO public.etok_gifts_sent(stream_id, sender_id, recipient_id, gift_id, gift_emoji, gift_name, coins)
  VALUES (p_stream_id, v_user_id, p_recipient_id, p_gift_id, v_emoji, v_name, v_coins);

  UPDATE public.etok_live_streams
  SET gift_total = gift_total + v_coins
  WHERE id = p_stream_id;

  INSERT INTO public.etok_live_comments(stream_id, author_id, text, is_gift, gift_emoji)
  VALUES (p_stream_id, v_user_id, 'sent a ' || v_name, true, v_emoji);

  success := true;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.send_chat_gift(text, uuid, uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_etok_live_gift(uuid, text, uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_chat_gift(text, uuid, uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_etok_live_gift(uuid, text, uuid, text, text, integer) TO authenticated;