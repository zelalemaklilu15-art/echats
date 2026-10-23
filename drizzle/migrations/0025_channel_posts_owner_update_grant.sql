-- The channel owner edits a post (e.g. turning comments on/off) through the
-- existing owner-only row policy, which also needs the table-level privilege.
GRANT UPDATE ON public.channel_posts TO authenticated;