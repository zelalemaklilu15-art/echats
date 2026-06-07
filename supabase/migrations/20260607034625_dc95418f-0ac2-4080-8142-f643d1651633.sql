DROP POLICY IF EXISTS gifts_insert ON public.etok_gifts_sent;
DROP POLICY IF EXISTS "gifts_insert" ON public.etok_gifts_sent;

-- The SECURITY DEFINER function public.send_etok_live_gift is now the only path
-- that records Etok live gifts, so every gift spend is paired with an atomic
-- coin deduction and stream total update.