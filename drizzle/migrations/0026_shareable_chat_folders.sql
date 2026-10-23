CREATE TABLE public.chat_folders (id text PRIMARY KEY, user_id uuid NOT NULL, name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80), icon text NOT NULL DEFAULT 'folder', color text NOT NULL DEFAULT 'primary', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.chat_folders TO authenticated; GRANT ALL ON public.chat_folders TO service_role;
ALTER TABLE public.chat_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY folder_owner_read ON public.chat_folders FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE INDEX chat_folders_owner ON public.chat_folders(user_id);
CREATE TABLE public.chat_folder_items (folder_id text NOT NULL REFERENCES public.chat_folders(id) ON DELETE CASCADE, kind text NOT NULL CHECK (kind IN ('chat','group','channel')), item_id text NOT NULL, PRIMARY KEY(folder_id,kind,item_id));
GRANT SELECT ON public.chat_folder_items TO authenticated; GRANT ALL ON public.chat_folder_items TO service_role;
ALTER TABLE public.chat_folder_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY folder_item_owner_read ON public.chat_folder_items FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.chat_folders f WHERE f.id=folder_id AND f.user_id=auth.uid()));
CREATE TABLE public.chat_folder_invites (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), folder_id text NOT NULL REFERENCES public.chat_folders(id) ON DELETE CASCADE, token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(), revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.chat_folder_invites TO authenticated; GRANT ALL ON public.chat_folder_invites TO service_role;
ALTER TABLE public.chat_folder_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY folder_invite_owner_read ON public.chat_folder_invites FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.chat_folders f WHERE f.id=folder_id AND f.user_id=auth.uid()));
CREATE TABLE public.chat_folder_invite_items (invite_id uuid NOT NULL REFERENCES public.chat_folder_invites(id) ON DELETE CASCADE, kind text NOT NULL CHECK(kind IN ('group','channel')), item_id text NOT NULL, PRIMARY KEY(invite_id,kind,item_id));
GRANT ALL ON public.chat_folder_invite_items TO service_role;
ALTER TABLE public.chat_folder_invite_items ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.chat_folder_acceptances (invite_id uuid NOT NULL REFERENCES public.chat_folder_invites(id) ON DELETE CASCADE, user_id uuid NOT NULL, folder_id text REFERENCES public.chat_folders(id) ON DELETE SET NULL, PRIMARY KEY(invite_id,user_id));
GRANT ALL ON public.chat_folder_acceptances TO service_role;
ALTER TABLE public.chat_folder_acceptances ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.folder_item_access(p_kind text,p_id text,p_user uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF p_kind='chat' THEN RETURN EXISTS(SELECT 1 FROM chats WHERE id::text=p_id AND p_user IN(participant_1,participant_2));
 ELSIF p_kind='group' THEN RETURN EXISTS(SELECT 1 FROM groups g WHERE g.id::text=p_id AND (g.created_by=p_user OR is_group_member(g.id,p_user)));
 ELSIF p_kind='channel' THEN RETURN can_view_channel(p_id,p_user); END IF; RETURN false; END $$;
REVOKE ALL ON FUNCTION public.folder_item_access(text,text,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.folder_item_shareable(p_kind text,p_id text,p_owner uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT CASE WHEN p_kind='group' THEN EXISTS(SELECT 1 FROM groups g WHERE g.id::text=p_id AND (g.created_by=p_owner OR is_group_admin(g.id,p_owner))) WHEN p_kind='channel' THEN EXISTS(SELECT 1 FROM channels c WHERE c.id=p_id AND (c.is_public OR c.created_by=p_owner)) ELSE false END $$;
REVOKE ALL ON FUNCTION public.folder_item_shareable(text,text,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.get_chat_folder_state() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'icon',f.icon,'color',f.color,'items',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',i.kind,'id',i.item_id)) FROM chat_folder_items i WHERE i.folder_id=f.id AND folder_item_access(i.kind,i.item_id,auth.uid())),'[]'::jsonb)) ORDER BY f.created_at,f.id),'[]'::jsonb) FROM chat_folders f WHERE f.user_id=auth.uid() $$;
CREATE FUNCTION public.save_chat_folder(p_id text,p_name text,p_icon text,p_color text,p_items jsonb DEFAULT '[]') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE i jsonb; owner uuid; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF p_id IS NULL OR char_length(p_id)>100 OR char_length(p_id)=0 OR p_name IS NULL OR char_length(trim(p_name)) NOT BETWEEN 1 AND 80 OR p_icon NOT IN('folder','star','briefcase','heart','hash','users') OR p_color IS NULL OR char_length(p_color)>100 OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)>500 THEN RAISE EXCEPTION 'Invalid folder'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id,0));
 SELECT user_id INTO owner FROM chat_folders WHERE id=p_id FOR UPDATE;
 IF owner IS NOT NULL AND owner<>auth.uid() THEN RAISE EXCEPTION 'Folder unavailable'; END IF;
 FOR i IN SELECT * FROM jsonb_array_elements(p_items) LOOP IF NOT folder_item_access(i->>'kind',i->>'id',auth.uid()) THEN RAISE EXCEPTION 'Conversation unavailable'; END IF; END LOOP;
 INSERT INTO chat_folders(id,user_id,name,icon,color) VALUES(p_id,auth.uid(),trim(p_name),p_icon,p_color) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,icon=EXCLUDED.icon,color=EXCLUDED.color;
 DELETE FROM chat_folder_items WHERE folder_id=p_id;
 INSERT INTO chat_folder_items(folder_id,kind,item_id) SELECT p_id,x->>'kind',x->>'id' FROM jsonb_array_elements(p_items) x ON CONFLICT DO NOTHING;
 END $$;
CREATE FUNCTION public.delete_chat_folder(p_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN DELETE FROM chat_folders WHERE id=p_id AND user_id=auth.uid(); IF NOT FOUND THEN RAISE EXCEPTION 'Folder unavailable'; END IF; END $$;
CREATE FUNCTION public.get_folder_candidates() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(jsonb_agg(x ORDER BY x->>'name'),'[]'::jsonb) FROM (
 SELECT jsonb_build_object('kind','group','id',g.id::text,'name',g.name,'shareable',folder_item_shareable('group',g.id::text,auth.uid())) x FROM groups g WHERE g.created_by=auth.uid() OR is_group_member(g.id,auth.uid())
 UNION ALL SELECT jsonb_build_object('kind','channel','id',c.id,'name',c.name,'shareable',folder_item_shareable('channel',c.id,auth.uid())) FROM channels c WHERE c.created_by=auth.uid() OR EXISTS(SELECT 1 FROM channel_subscribers s WHERE s.channel_id=c.id AND s.user_id=auth.uid())
 ) v $$;
CREATE FUNCTION public.create_chat_folder_invite(p_folder_id text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE invite uuid; token_result uuid; BEGIN
 PERFORM 1 FROM chat_folders WHERE id=p_folder_id AND user_id=auth.uid() FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Folder unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM chat_folder_items WHERE folder_id=p_folder_id AND folder_item_shareable(kind,item_id,auth.uid())) THEN RAISE EXCEPTION 'No shareable groups or channels'; END IF;
 INSERT INTO chat_folder_invites(folder_id) VALUES(p_folder_id) RETURNING id,token INTO invite,token_result;
 INSERT INTO chat_folder_invite_items SELECT invite,kind,item_id FROM chat_folder_items WHERE folder_id=p_folder_id AND folder_item_shareable(kind,item_id,auth.uid()); RETURN token_result;
 END $$;
CREATE FUNCTION public.preview_chat_folder_invite(p_token uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE inv chat_folder_invites; folder chat_folders; items jsonb; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO inv FROM chat_folder_invites WHERE token=p_token AND revoked_at IS NULL; IF NOT FOUND THEN RAISE EXCEPTION 'Link unavailable or revoked'; END IF;
 SELECT * INTO folder FROM chat_folders WHERE id=inv.folder_id;
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'name'),'[]'::jsonb) INTO items FROM (
 SELECT jsonb_build_object('kind','group','id',g.id::text,'name',g.name,'joined',is_group_member(g.id,auth.uid())) x FROM chat_folder_invite_items i JOIN groups g ON g.id::text=i.item_id WHERE i.invite_id=inv.id AND i.kind='group' AND folder_item_shareable(i.kind,i.item_id,folder.user_id)
 UNION ALL SELECT jsonb_build_object('kind','channel','id',c.id,'name',c.name,'joined',EXISTS(SELECT 1 FROM channel_subscribers s WHERE s.channel_id=c.id AND s.user_id=auth.uid())) FROM chat_folder_invite_items i JOIN channels c ON c.id=i.item_id WHERE i.invite_id=inv.id AND i.kind='channel' AND folder_item_shareable(i.kind,i.item_id,folder.user_id)
 ) v;
 IF jsonb_array_length(items)=0 THEN RAISE EXCEPTION 'Link has no available conversations'; END IF;
 RETURN jsonb_build_object('name',folder.name,'icon',folder.icon,'color',folder.color,'items',items); END $$;
CREATE FUNCTION public.accept_chat_folder_invite(p_token uuid,p_items jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE inv chat_folder_invites; source chat_folders; target text; i jsonb; BEGIN
 IF auth.uid() IS NULL OR p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Select conversations'; END IF;
 SELECT * INTO inv FROM chat_folder_invites WHERE token=p_token AND revoked_at IS NULL FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Link unavailable or revoked'; END IF;
 SELECT * INTO source FROM chat_folders WHERE id=inv.folder_id FOR UPDATE;
 FOR i IN SELECT * FROM jsonb_array_elements(p_items) LOOP
 IF NOT EXISTS(SELECT 1 FROM chat_folder_invite_items fi WHERE fi.invite_id=inv.id AND fi.kind=i->>'kind' AND fi.item_id=i->>'id') OR NOT folder_item_shareable(i->>'kind',i->>'id',source.user_id) THEN RAISE EXCEPTION 'Conversation unavailable'; END IF;
 END LOOP;
 SELECT folder_id INTO target FROM chat_folder_acceptances WHERE invite_id=inv.id AND user_id=auth.uid();
 IF source.user_id=auth.uid() THEN target:=source.id; END IF;
 IF target IS NULL THEN target:=gen_random_uuid()::text; INSERT INTO chat_folders(id,user_id,name,icon,color) VALUES(target,auth.uid(),source.name,source.icon,source.color); END IF;
 INSERT INTO chat_folder_acceptances(invite_id,user_id,folder_id) VALUES(inv.id,auth.uid(),target) ON CONFLICT(invite_id,user_id) DO UPDATE SET folder_id=EXCLUDED.folder_id;
 FOR i IN SELECT * FROM jsonb_array_elements(p_items) LOOP
 IF i->>'kind'='group' THEN INSERT INTO group_members(group_id,user_id,role) VALUES((i->>'id')::uuid,auth.uid(),'member') ON CONFLICT(group_id,user_id) DO NOTHING;
 ELSIF i->>'kind'='channel' THEN INSERT INTO channel_subscribers(channel_id,user_id) VALUES(i->>'id',auth.uid()) ON CONFLICT(channel_id,user_id) DO NOTHING; END IF;
 INSERT INTO chat_folder_items(folder_id,kind,item_id) VALUES(target,i->>'kind',i->>'id') ON CONFLICT DO NOTHING; END LOOP; RETURN target;
 END $$;
CREATE FUNCTION public.revoke_chat_folder_invite(p_token uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 UPDATE chat_folder_invites i SET revoked_at=now() FROM chat_folders f WHERE i.folder_id=f.id AND f.user_id=auth.uid() AND i.token=p_token; IF NOT FOUND THEN RAISE EXCEPTION 'Link unavailable'; END IF; END $$;
REVOKE ALL ON FUNCTION public.get_chat_folder_state(),public.save_chat_folder(text,text,text,text,jsonb),public.delete_chat_folder(text),public.get_folder_candidates(),public.create_chat_folder_invite(text),public.preview_chat_folder_invite(uuid),public.accept_chat_folder_invite(uuid,jsonb),public.revoke_chat_folder_invite(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_chat_folder_state(),public.save_chat_folder(text,text,text,text,jsonb),public.delete_chat_folder(text),public.get_folder_candidates(),public.create_chat_folder_invite(text),public.preview_chat_folder_invite(uuid),public.accept_chat_folder_invite(uuid,jsonb),public.revoke_chat_folder_invite(uuid) TO authenticated,service_role;
DROP POLICY gm_insert ON public.group_members;
CREATE POLICY gm_insert ON public.group_members FOR INSERT TO authenticated WITH CHECK(public.is_group_admin(group_id,auth.uid()) OR EXISTS(SELECT 1 FROM public.groups g WHERE g.id=group_id AND g.created_by=auth.uid()));