CREATE TABLE public.support_reply_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('app','email')),
  ticket_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.support_reply_jobs TO service_role;
ALTER TABLE public.support_reply_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX support_reply_jobs_pending ON public.support_reply_jobs (ticket_id) WHERE status = 'pending';