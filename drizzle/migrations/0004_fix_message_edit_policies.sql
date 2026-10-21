ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update_parties ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE OR REPLACE FUNCTION public.guard_message_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
     OR NEW.chat_id IS DISTINCT FROM OLD.chat_id THEN
    RAISE EXCEPTION 'Cannot change message participants';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> OLD.sender_id THEN
    IF NEW.content IS DISTINCT FROM OLD.content OR NEW.media_url IS DISTINCT FROM OLD.media_url
       OR NEW.file_name IS DISTINCT FROM OLD.file_name OR NEW.message_type IS DISTINCT FROM OLD.message_type THEN
      RAISE EXCEPTION 'Only the sender can edit this message';
    END IF;
  END IF;
  IF NEW.content IS DISTINCT FROM OLD.content THEN NEW.edited_at := now(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_message_update ON public.messages;
CREATE TRIGGER guard_message_update BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_message_update();

CREATE OR REPLACE FUNCTION public.guard_group_message_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id OR NEW.group_id IS DISTINCT FROM OLD.group_id
     OR NEW.media_url IS DISTINCT FROM OLD.media_url OR NEW.message_type IS DISTINCT FROM OLD.message_type THEN
    RAISE EXCEPTION 'Only text can be edited';
  END IF;
  IF NEW.content IS DISTINCT FROM OLD.content THEN NEW.edited_at := now(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_group_message_update ON public.group_messages;
CREATE TRIGGER guard_group_message_update BEFORE UPDATE ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_group_message_update();

GRANT UPDATE ON public.group_messages TO authenticated;
CREATE POLICY group_messages_update_sender ON public.group_messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);