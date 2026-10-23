ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE POLICY "ai attachments owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ai-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "ai attachments owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ai-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "ai attachments owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ai-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);