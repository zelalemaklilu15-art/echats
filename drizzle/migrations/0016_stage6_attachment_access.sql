CREATE OR REPLACE FUNCTION public.decode_attachment_path(p_path text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE result bytea := ''::bytea; i integer := 1; c text;
BEGIN
  WHILE i <= char_length(p_path) LOOP
    c := substr(p_path,i,1);
    IF c='%' AND substr(p_path,i+1,2) ~ '^[0-9A-Fa-f]{2}$' THEN
      result := result || decode(substr(p_path,i+1,2),'hex'); i := i+3;
    ELSE result := result || convert_to(c,'UTF8'); i := i+1; END IF;
  END LOOP;
  RETURN convert_from(result,'UTF8');
EXCEPTION WHEN OTHERS THEN RETURN p_path;
END $$;
CREATE OR REPLACE FUNCTION public.chat_attachment_path(p_source text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE WHEN p_source LIKE 'chat-media/%' THEN substr(p_source,12)
    ELSE public.decode_attachment_path(public.feature_media_path(p_source,'chat-media')) END;
$$;
CREATE OR REPLACE FUNCTION public.can_read_chat_attachment(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND split_part(p_name,'/',1)<>'stories' AND (
    EXISTS(SELECT 1 FROM public.messages m WHERE auth.uid() IN (m.sender_id,m.receiver_id)
      AND m.sender_id::text=split_part(p_name,'/',1) AND public.chat_attachment_path(m.media_url)=p_name)
    OR EXISTS(SELECT 1 FROM public.group_messages m WHERE public.is_group_member(m.group_id,auth.uid())
      AND m.sender_id::text=split_part(p_name,'/',1) AND public.chat_attachment_path(m.media_url)=p_name)
  );
$$;
REVOKE ALL ON FUNCTION public.decode_attachment_path(text),public.chat_attachment_path(text),public.can_read_chat_attachment(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.decode_attachment_path(text),public.chat_attachment_path(text),public.can_read_chat_attachment(text) TO authenticated,service_role;
DROP POLICY IF EXISTS chat_media_recipient_read ON storage.objects;
CREATE POLICY chat_media_recipient_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='chat-media' AND public.can_read_chat_attachment(name));