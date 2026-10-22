REVOKE SELECT ON public.channel_posts FROM PUBLIC,anon;
REVOKE SELECT(sender_name) ON public.channel_posts FROM PUBLIC,anon,authenticated;
REVOKE SELECT(author_name) ON public.etok_sounds FROM PUBLIC,anon,authenticated;
REVOKE SELECT(phone,birthday) ON public.profiles FROM PUBLIC,anon,authenticated;