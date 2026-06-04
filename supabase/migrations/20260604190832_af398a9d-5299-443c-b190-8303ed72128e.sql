CREATE TABLE public.ai_message_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  conversation_id uuid,
  message_id text NOT NULL,
  rating text NOT NULL CHECK (rating IN ('like','dislike','report')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_message_feedback TO authenticated;
GRANT ALL ON public.ai_message_feedback TO service_role;

ALTER TABLE public.ai_message_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own feedback select" ON public.ai_message_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own feedback insert" ON public.ai_message_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own feedback update" ON public.ai_message_feedback FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own feedback delete" ON public.ai_message_feedback FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_ai_feedback_updated_at
  BEFORE UPDATE ON public.ai_message_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();