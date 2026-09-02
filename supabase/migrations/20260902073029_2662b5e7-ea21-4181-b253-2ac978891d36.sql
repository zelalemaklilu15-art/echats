CREATE OR REPLACE FUNCTION public.register_device_token(p_token text, p_platform text DEFAULT 'web', p_user_agent text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_token IS NULL OR length(trim(p_token)) < 10 THEN
    RAISE EXCEPTION 'Invalid device token';
  END IF;

  INSERT INTO public.device_tokens (user_id, token, platform, user_agent)
  VALUES (v_user_id, trim(p_token), COALESCE(NULLIF(p_platform, ''), 'web'), left(COALESCE(p_user_agent, ''), 500))
  ON CONFLICT (token) DO UPDATE
    SET user_id = v_user_id,
        platform = EXCLUDED.platform,
        user_agent = EXCLUDED.user_agent,
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_device_token(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_device_token(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.unregister_device_token(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.device_tokens
  WHERE token = p_token AND user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.unregister_device_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unregister_device_token(text) TO authenticated;