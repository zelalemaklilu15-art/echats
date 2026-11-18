CREATE OR REPLACE FUNCTION public.admin_user_security(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'badge', (SELECT badge::text FROM user_verifications WHERE user_id = p_user),
    'roles', coalesce((SELECT jsonb_agg(role::text) FROM user_roles WHERE user_id = p_user), '[]'::jsonb),
    'two_fa', coalesce((SELECT enabled FROM user_2fa_settings WHERE user_id = p_user), false),
    'devices', (SELECT count(*) FROM device_tokens WHERE user_id = p_user),
    'email_confirmed', (SELECT email_confirmed_at IS NOT NULL FROM auth.users WHERE id = p_user)
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_verification(p_user uuid, p_badge text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  IF p_badge IS NULL OR p_badge = '' THEN
    DELETE FROM user_verifications WHERE user_id = p_user;
  ELSE
    INSERT INTO user_verifications(user_id, badge, verified_by)
    VALUES (p_user, p_badge::verification_badge, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET badge = EXCLUDED.badge, verified_by = 'admin', updated_at = now();
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_user_security(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_verification(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_security(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_verification(uuid, text) TO authenticated;