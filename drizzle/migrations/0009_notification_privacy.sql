CREATE TABLE public.notification_privacy (
  user_id uuid PRIMARY KEY,
  show_identity text NOT NULL DEFAULT 'contacts' CHECK (show_identity IN ('everyone','contacts','nobody')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_privacy TO authenticated;
GRANT ALL ON public.notification_privacy TO service_role;
ALTER TABLE public.notification_privacy ENABLE ROW LEVEL SECURITY;
CREATE POLICY np_select_own ON public.notification_privacy FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY np_insert_own ON public.notification_privacy FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY np_update_own ON public.notification_privacy FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE FUNCTION public.notification_identity_allowed(p_viewer uuid, p_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT public.profile_access_allowed(p_viewer, p_subject) AND (
    CASE coalesce((SELECT show_identity FROM public.notification_privacy WHERE user_id = p_subject), 'contacts')
      WHEN 'everyone' THEN true
      WHEN 'contacts' THEN EXISTS (SELECT 1 FROM public.profile_contacts c WHERE c.owner_id = p_subject AND c.contact_user_id = p_viewer)
      ELSE false
    END)
$$;
REVOKE ALL ON FUNCTION public.notification_identity_allowed(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_identity_allowed(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.notification_profile_name(p_viewer uuid,p_subject uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT CASE WHEN public.notification_identity_allowed(p_viewer,p_subject) THEN coalesce(p.name,p.username,'Hidden profile') ELSE 'Hidden profile' END FROM public.profiles p WHERE p.id=p_subject; $$;
REVOKE ALL ON FUNCTION public.notification_profile_name(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_profile_name(uuid,uuid) TO service_role;