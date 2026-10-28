DROP POLICY IF EXISTS series_select ON public.etok_series;
CREATE POLICY series_select ON public.etok_series FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.etok_series FROM anon;

DROP POLICY IF EXISTS live_streams_select ON public.etok_live_streams;
CREATE POLICY live_streams_select ON public.etok_live_streams FOR SELECT TO authenticated USING (is_live = true OR host_id = auth.uid());

DROP POLICY IF EXISTS sched_select ON public.etok_scheduled_lives;
CREATE POLICY sched_select ON public.etok_scheduled_lives FOR SELECT TO authenticated USING (scheduled_at > now() - interval '1 hour' OR host_id = auth.uid());

DROP POLICY IF EXISTS shop_select ON public.etok_shop_items;
CREATE POLICY shop_select ON public.etok_shop_items FOR SELECT USING (in_stock = true OR seller_id = auth.uid());