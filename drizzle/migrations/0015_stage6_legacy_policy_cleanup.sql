-- Retire historical permissive policies so older deployments cannot bypass content audiences.
DROP POLICY IF EXISTS "Users can view non-expired stories" ON public.user_stories;
DROP POLICY IF EXISTS "Users can create their own stories" ON public.user_stories;
DROP POLICY IF EXISTS "Users can delete their own stories" ON public.user_stories;
DROP POLICY IF EXISTS "chat_media_select" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_view" ON storage.objects;
DROP POLICY IF EXISTS "sv_select" ON public.story_views;
DROP POLICY IF EXISTS "sv_select_authorized" ON public.story_views;
CREATE POLICY sv_select_authorized ON public.story_views FOR SELECT TO authenticated USING(viewer_id=auth.uid() OR EXISTS(SELECT 1 FROM public.user_stories s WHERE s.id=story_id AND s.user_id=auth.uid()));
