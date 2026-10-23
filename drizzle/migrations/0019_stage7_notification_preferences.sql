CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY,
  messages boolean NOT NULL DEFAULT true,
  groups boolean NOT NULL DEFAULT true,
  calls boolean NOT NULL DEFAULT true,
  message_preview boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_preferences_own_select ON public.notification_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notification_preferences_own_insert ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY notification_preferences_own_update ON public.notification_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.story_notification_allowed(p_story uuid, p_viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_stories s WHERE s.id = p_story AND s.user_id <> p_viewer AND s.expires_at > now() AND (
    s.privacy = 'everyone'
    OR (s.privacy = 'contacts' AND EXISTS(SELECT 1 FROM public.profile_contacts WHERE owner_id = s.user_id AND contact_user_id = p_viewer))
    OR (s.privacy = 'close_friends' AND EXISTS(SELECT 1 FROM public.story_close_friends WHERE owner_id = s.user_id AND contact_user_id = p_viewer))))
$$;
REVOKE ALL ON FUNCTION public.story_notification_allowed(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.story_notification_allowed(uuid, uuid) TO service_role;