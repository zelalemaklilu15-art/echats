
-- 1. Wallet transactions: remove user INSERT policy
DROP POLICY IF EXISTS "wallet_tx_insert" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.wallet_transactions;

-- 2. etok_coins: remove user UPDATE policy
DROP POLICY IF EXISTS "coins_update" ON public.etok_coins;
DROP POLICY IF EXISTS "Users can update their own coins" ON public.etok_coins;

-- 3. Wallets: restrict UPDATE to non-financial columns only
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "wallets_update" ON public.wallets;

CREATE POLICY "wallets_update_safe_fields"
ON public.wallets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger to prevent users from changing financial columns directly
CREATE OR REPLACE FUNCTION public.prevent_wallet_financial_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role to bypass
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.balance IS DISTINCT FROM OLD.balance
     OR NEW.pin_hash IS DISTINCT FROM OLD.pin_hash
     OR NEW.daily_limit IS DISTINCT FROM OLD.daily_limit
     OR NEW.monthly_limit IS DISTINCT FROM OLD.monthly_limit
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Wallet financial fields can only be changed via server-side functions';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_wallet_financial_changes_trg ON public.wallets;
CREATE TRIGGER prevent_wallet_financial_changes_trg
BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.prevent_wallet_financial_changes();

-- 4. Profiles: restrict phone/birthday to owner only
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select_own_full"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Revoke column access to phone/birthday from authenticated, keep other columns readable
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, username, name, avatar_url, bio, is_online, last_seen, is_active, created_at, updated_at)
  ON public.profiles TO authenticated;

CREATE POLICY "profiles_select_public_columns"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 5. message_reactions: restrict select to participants
DROP POLICY IF EXISTS "reactions_select" ON public.message_reactions;

CREATE POLICY "reactions_select_participants"
ON public.message_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_reactions.message_id
      AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.group_messages gm
    WHERE gm.id = message_reactions.message_id
      AND public.is_group_member(gm.group_id, auth.uid())
  )
);

-- 6. Realtime messages: enable RLS and restrict topic subscriptions
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_can_subscribe_own_topics" ON realtime.messages;
CREATE POLICY "authenticated_can_subscribe_own_topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- User topic scoped to their uid
  (realtime.topic() LIKE 'user:' || auth.uid()::text || '%')
  OR
  -- Chat topics where user is a participant
  (realtime.topic() LIKE 'chat:%' AND EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id::text = substring(realtime.topic() from 6)
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
  ))
  OR
  -- Group topics where user is a member
  (realtime.topic() LIKE 'group:%' AND public.is_group_member(
    substring(realtime.topic() from 7)::uuid, auth.uid()
  ))
  OR
  -- WebRTC signal topics scoped to user
  (realtime.topic() LIKE 'rtc:' || auth.uid()::text || '%')
  OR
  -- Call topics where user is participant
  (realtime.topic() LIKE 'call:' || auth.uid()::text || '%')
);
