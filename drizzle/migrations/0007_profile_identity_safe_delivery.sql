CREATE FUNCTION public.get_profiles_safe(p_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT coalesce(jsonb_agg(to_jsonb(g) || jsonb_build_object('profile_hidden',NOT public.can_read_profile(g.id))), '[]'::jsonb)
FROM unnest(p_ids[1:200]) AS requested(id) CROSS JOIN LATERAL public.get_public_profile(requested.id) g; $$;
REVOKE ALL ON FUNCTION public.get_profiles_safe(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_safe(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_profile_call(p_room_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE v_id uuid; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 SELECT id INTO v_id FROM public.call_logs WHERE room_id=p_room_id AND receiver_id=auth.uid() AND ended_at IS NULL AND created_at>now()-interval '2 minutes' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF v_id IS NULL THEN RETURN false; END IF;
 PERFORM set_config('app.profile_call_accept',v_id::text,true);
 UPDATE public.call_logs SET receiver_accepted=true WHERE id=v_id;
 PERFORM set_config('app.profile_call_accept','',true);
 RETURN true;
END $$;

ALTER TABLE public.etok_sounds ADD COLUMN author_id uuid;
UPDATE public.etok_sounds s SET author_id=p.id FROM public.profiles p
WHERE s.author_id IS NULL AND lower(s.author_name)=lower(coalesce(nullif(p.username,''),nullif(p.name,''),'creator'));
COMMENT ON COLUMN public.etok_sounds.author_name IS 'DEPRECATED: identity snapshot. Use author_id with authorized profile resolution.';
REVOKE SELECT ON public.etok_sounds FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,title,author_id,cover_emoji,duration,video_count,is_original,audio_url,created_at) ON public.etok_sounds TO anon,authenticated;
GRANT ALL ON public.etok_sounds TO service_role;
CREATE OR REPLACE FUNCTION public.sync_etok_video_metadata()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE tag text; BEGIN
 IF new.sound_name IS NOT NULL AND length(trim(new.sound_name))>0 THEN
  INSERT INTO public.etok_sounds(title,author_name,author_id,cover_emoji,duration,video_count,is_original)
  VALUES(trim(new.sound_name),'creator:'||new.author_id::text,new.author_id,'🎵',greatest(coalesce(new.duration,1),1),1,true)
  ON CONFLICT(lower(title),lower(author_name)) DO UPDATE SET video_count=public.etok_sounds.video_count+1,duration=greatest(public.etok_sounds.duration,excluded.duration);
 END IF;
 IF new.hashtags IS NOT NULL THEN
  FOREACH tag IN ARRAY new.hashtags LOOP
   tag:=lower(regexp_replace(trim(tag),'^#',''));
   IF tag<>'' THEN INSERT INTO public.etok_hashtags(name,view_count,trending) VALUES(tag,1,false)
   ON CONFLICT(name) DO UPDATE SET view_count=public.etok_hashtags.view_count+1; END IF;
  END LOOP;
 END IF; RETURN new;
END $$;