REVOKE EXECUTE ON FUNCTION public.record_etok_video_view(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_etok_video_interaction(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_etok_video_view(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_etok_video_interaction(uuid, text) TO authenticated, service_role;