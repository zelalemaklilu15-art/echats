CREATE TABLE public.profile_contacts (
  owner_id uuid NOT NULL,
  contact_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, contact_user_id),
  CONSTRAINT profile_contacts_distinct CHECK (owner_id <> contact_user_id),
  CONSTRAINT profile_contacts_owner_fk FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT profile_contacts_contact_fk FOREIGN KEY (contact_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, DELETE ON public.profile_contacts TO authenticated;
GRANT ALL ON public.profile_contacts TO service_role;
ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contacts_read_own ON public.profile_contacts FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY contacts_add_own ON public.profile_contacts FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY contacts_remove_own ON public.profile_contacts FOR DELETE TO authenticated USING (owner_id = auth.uid());

ALTER TABLE public.call_logs ADD COLUMN receiver_accepted boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS profile_message_interaction_idx ON public.messages(sender_id, receiver_id, chat_id);
CREATE INDEX IF NOT EXISTS profile_contact_viewer_idx ON public.profile_contacts(contact_user_id, owner_id);

CREATE FUNCTION public.profile_access_allowed(p_viewer uuid, p_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 SELECT p_viewer IS NOT NULL AND p_subject IS NOT NULL AND (
   p_viewer = p_subject
   OR EXISTS (SELECT 1 FROM public.profile_contacts pc WHERE pc.owner_id=p_subject AND pc.contact_user_id=p_viewer)
   OR EXISTS (
     SELECT 1 FROM public.chats c
     WHERE ((c.participant_1=p_viewer AND c.participant_2=p_subject) OR (c.participant_2=p_viewer AND c.participant_1=p_subject))
       AND EXISTS (SELECT 1 FROM public.messages m WHERE m.chat_id=c.id AND m.sender_id=p_subject AND m.receiver_id=p_viewer)
       AND EXISTS (SELECT 1 FROM public.messages m WHERE m.chat_id=c.id AND m.sender_id=p_viewer AND m.receiver_id=p_subject)
   )
   OR EXISTS (SELECT 1 FROM public.call_logs cl WHERE cl.receiver_accepted AND
       ((cl.caller_id=p_viewer AND cl.receiver_id=p_subject) OR (cl.receiver_id=p_viewer AND cl.caller_id=p_subject)))
 );
$$;
REVOKE ALL ON FUNCTION public.profile_access_allowed(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profile_access_allowed(uuid,uuid) TO service_role;
CREATE FUNCTION public.can_read_profile(p_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT public.profile_access_allowed(auth.uid(), p_subject); $$;
REVOKE ALL ON FUNCTION public.can_read_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_profile(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS profiles_select_safe ON public.profiles;
CREATE POLICY profiles_select_interactions ON public.profiles FOR SELECT TO authenticated USING (public.can_read_profile(id));
REVOKE SELECT ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,username,name,avatar_url,bio,is_online,last_seen,is_active,created_at,updated_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_profile(profile_id uuid)
RETURNS TABLE(id uuid, username text, name text, avatar_url text, bio text, is_online boolean, last_seen timestamptz, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
 SELECT p.id, CASE WHEN a.allowed THEN p.username ELSE NULL::text END,
 CASE WHEN a.allowed THEN p.name ELSE 'Hidden profile'::text END,
 CASE WHEN a.allowed THEN p.avatar_url ELSE NULL::text END,
 CASE WHEN a.allowed THEN p.bio ELSE NULL::text END,
 CASE WHEN a.allowed THEN p.is_online ELSE false END,
 CASE WHEN a.allowed THEN p.last_seen ELSE NULL::timestamptz END,
 CASE WHEN a.allowed THEN p.is_active ELSE false END
 FROM public.profiles p CROSS JOIN LATERAL (SELECT public.can_read_profile(p.id) AS allowed) a
 WHERE auth.uid() IS NOT NULL AND p.id=profile_id;
$$;
REVOKE ALL ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;
CREATE FUNCTION public.get_profile_access_state(p_subject uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT CASE WHEN public.can_read_profile(p_subject) THEN 'visible' ELSE 'hidden' END; $$;
REVOKE ALL ON FUNCTION public.get_profile_access_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_access_state(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.search_users_public(search_term text)
RETURNS TABLE(id uuid, username text, name text, avatar_url text, bio text, is_online boolean, last_seen timestamptz, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
 WITH t AS (SELECT lower(trim(both '@' from trim(coalesce(search_term,'')))) AS q)
 SELECT p.id,p.username,
 CASE WHEN public.can_read_profile(p.id) THEN p.name ELSE 'Hidden profile'::text END,
 CASE WHEN public.can_read_profile(p.id) THEN p.avatar_url ELSE NULL::text END,
 CASE WHEN public.can_read_profile(p.id) THEN p.bio ELSE NULL::text END,
 CASE WHEN public.can_read_profile(p.id) THEN p.is_online ELSE false END,
 CASE WHEN public.can_read_profile(p.id) THEN p.last_seen ELSE NULL::timestamptz END,
 CASE WHEN public.can_read_profile(p.id) THEN p.is_active ELSE false END
 FROM public.profiles p,t WHERE auth.uid() IS NOT NULL AND length(t.q)>=3 AND p.id<>auth.uid()
 AND (p.username ILIKE replace(replace(t.q,'%','\%'),'_','\_') || '%'
 OR (public.can_read_profile(p.id) AND p.name ILIKE '%' || replace(replace(t.q,'%','\%'),'_','\_') || '%'))
 ORDER BY (p.username=t.q) DESC,p.username LIMIT 20;
$$;
REVOKE ALL ON FUNCTION public.search_users_public(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_users_public(text) TO authenticated;

CREATE FUNCTION public.guard_profile_interaction_updates()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $$ BEGIN
 IF auth.uid() IS NOT NULL THEN
   IF TG_TABLE_NAME='chats' THEN
     IF NEW.participant_1 IS DISTINCT FROM OLD.participant_1 OR NEW.participant_2 IS DISTINCT FROM OLD.participant_2 THEN RAISE EXCEPTION 'Cannot change chat participants'; END IF;
   ELSE
     IF NEW.caller_id IS DISTINCT FROM OLD.caller_id OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id OR NEW.room_id IS DISTINCT FROM OLD.room_id THEN RAISE EXCEPTION 'Cannot change call participants'; END IF;
     IF NEW.receiver_accepted IS DISTINCT FROM OLD.receiver_accepted THEN RAISE EXCEPTION 'Acceptance is recorded by the secure call function'; END IF;
   END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER guard_chat_profile_interaction BEFORE UPDATE ON public.chats FOR EACH ROW EXECUTE FUNCTION public.guard_profile_interaction_updates();
CREATE TRIGGER guard_call_profile_interaction BEFORE UPDATE ON public.call_logs FOR EACH ROW EXECUTE FUNCTION public.guard_profile_interaction_updates();
DROP POLICY IF EXISTS cl_insert ON public.call_logs;
CREATE POLICY cl_insert ON public.call_logs FOR INSERT TO authenticated WITH CHECK (auth.uid()=caller_id AND receiver_accepted=false AND receiver_id<>auth.uid());
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated WITH CHECK (
 auth.uid()=sender_id AND sender_id<>receiver_id AND EXISTS (
  SELECT 1 FROM public.chats c WHERE c.id=chat_id AND
  ((c.participant_1=sender_id AND c.participant_2=receiver_id) OR (c.participant_2=sender_id AND c.participant_1=receiver_id))
 )
);
CREATE FUNCTION public.accept_profile_call(p_room_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE v_id uuid; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 SELECT id INTO v_id FROM public.call_logs WHERE room_id=p_room_id AND receiver_id=auth.uid() AND ended_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF v_id IS NULL THEN RETURN false; END IF;
 -- The trigger guards client changes; this narrowly-scoped function temporarily clears
 -- the UID only for its one verified acceptance update, then restores it.
 PERFORM set_config('app.profile_call_accept',v_id::text,true);
 UPDATE public.call_logs SET receiver_accepted=true WHERE id=v_id;
 PERFORM set_config('app.profile_call_accept','',true);
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.guard_profile_interaction_updates()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $$ BEGIN
 IF auth.uid() IS NOT NULL THEN
  IF TG_TABLE_NAME='chats' THEN
   IF NEW.participant_1 IS DISTINCT FROM OLD.participant_1 OR NEW.participant_2 IS DISTINCT FROM OLD.participant_2 THEN RAISE EXCEPTION 'Cannot change chat participants'; END IF;
  ELSE
   IF NEW.caller_id IS DISTINCT FROM OLD.caller_id OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id OR NEW.room_id IS DISTINCT FROM OLD.room_id THEN RAISE EXCEPTION 'Cannot change call participants'; END IF;
   IF NEW.receiver_accepted IS DISTINCT FROM OLD.receiver_accepted AND (coalesce(current_setting('app.profile_call_accept',true),'')<>OLD.id::text OR auth.uid()<>OLD.receiver_id OR NEW.receiver_accepted=false) THEN RAISE EXCEPTION 'Acceptance is recorded by the secure call function'; END IF;
  END IF;
 END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.accept_profile_call(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_profile_call(text) TO authenticated;

REVOKE SELECT ON public.channel_posts FROM authenticated;
GRANT SELECT(id,channel_id,sender_id,content,type,views,edited,reactions,created_at) ON public.channel_posts TO authenticated;
COMMENT ON COLUMN public.channel_posts.sender_name IS 'DEPRECATED: personal identity snapshots bypass profile privacy; resolve sender_id through get_public_profile.';
CREATE FUNCTION public.get_channel_posts_safe(p_channel_id text)
RETURNS TABLE(id text, channel_id text, sender_id uuid, sender_name text, content text, type text, views integer, edited boolean, reactions jsonb, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT cp.id,cp.channel_id,cp.sender_id,
 CASE WHEN public.can_read_profile(cp.sender_id) THEN coalesce(p.name,p.username,'Hidden profile') ELSE 'Hidden profile' END,
 cp.content,cp.type,cp.views,cp.edited,cp.reactions,cp.created_at
 FROM public.channel_posts cp LEFT JOIN public.profiles p ON p.id=cp.sender_id
 WHERE auth.uid() IS NOT NULL AND cp.channel_id=p_channel_id AND public.can_view_channel(cp.channel_id,auth.uid())
 ORDER BY cp.created_at LIMIT 500; $$;
REVOKE ALL ON FUNCTION public.get_channel_posts_safe(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_channel_posts_safe(text) TO authenticated;

CREATE POLICY avatars_read_profile_access ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id='avatars' AND (storage.foldername(name))[1] IN (SELECT p.id::text FROM public.profiles p WHERE public.can_read_profile(p.id))
);
CREATE FUNCTION public.notification_profile_name(p_viewer uuid,p_subject uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT CASE WHEN public.profile_access_allowed(p_viewer,p_subject) THEN coalesce(p.name,p.username,'Hidden profile') ELSE 'Hidden profile' END FROM public.profiles p WHERE p.id=p_subject; $$;
REVOKE ALL ON FUNCTION public.notification_profile_name(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_profile_name(uuid,uuid) TO service_role;
