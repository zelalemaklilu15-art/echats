REVOKE EXECUTE ON FUNCTION public.record_etok_video_view(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_etok_video_interaction(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_etok_video_view(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_etok_video_interaction(uuid, text) TO authenticated, service_role;