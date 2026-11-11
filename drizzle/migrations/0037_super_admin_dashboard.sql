CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'super_admin')
$$;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM auth.users),
    'users_7d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days'),
    'online', (SELECT count(*) FROM public.profiles WHERE is_online),
    'wallets', (SELECT count(*) FROM public.wallets),
    'wallet_total', (SELECT coalesce(sum(balance),0) FROM public.wallets),
    'tx_24h', (SELECT count(*) FROM public.wallet_transactions WHERE created_at > now() - interval '24 hours'),
    'messages_24h', (SELECT count(*) FROM public.messages WHERE created_at > now() - interval '24 hours'),
    'groups', (SELECT count(*) FROM public.groups),
    'channels', (SELECT count(*) FROM public.channels),
    'videos', (SELECT count(*) FROM public.etok_videos),
    'reports', (SELECT count(*) FROM public.etok_reports)
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_users(p_search text DEFAULT NULL, p_limit int DEFAULT 50)
RETURNS TABLE(id uuid, email text, username text, name text, phone text, is_online boolean, created_at timestamptz, last_sign_in_at timestamptz, wallet_balance numeric, wallet_status text, is_banned boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, p.username, p.name, p.phone, coalesce(p.is_online,false), u.created_at, u.last_sign_in_at,
         w.balance, w.status::text, (u.banned_until IS NOT NULL AND u.banned_until > now())
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.wallets w ON w.user_id = u.id
  WHERE p_search IS NULL OR p_search = '' OR u.email ILIKE '%'||p_search||'%' OR p.username ILIKE '%'||p_search||'%' OR p.name ILIKE '%'||p_search||'%' OR p.phone ILIKE '%'||p_search||'%'
  ORDER BY u.created_at DESC
  LIMIT least(greatest(p_limit,1),200);
END $$;

CREATE OR REPLACE FUNCTION public.admin_recent_transactions(p_limit int DEFAULT 50)
RETURNS TABLE(id uuid, user_email text, type text, amount numeric, fee numeric, status text, description text, counterparty_name text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT t.id, u.email::text, t.type::text, t.amount, t.fee, t.status::text, t.description, t.counterparty_name, t.created_at
  FROM public.wallet_transactions t
  LEFT JOIN public.wallets w ON w.id = t.wallet_id
  LEFT JOIN auth.users u ON u.id = w.user_id
  ORDER BY t.created_at DESC
  LIMIT least(greatest(p_limit,1),200);
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_reports(p_limit int DEFAULT 50)
RETURNS TABLE(id uuid, reporter_email text, content_type text, content_id text, reason text, reported_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT r.id, u.email::text, r.content_type, r.content_id, r.reason, r.reported_at
  FROM public.etok_reports r LEFT JOIN auth.users u ON u.id = r.reporter_id
  ORDER BY r.reported_at DESC LIMIT least(greatest(p_limit,1),200);
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['admin_overview()','admin_list_users(text,int)','admin_recent_transactions(int)','admin_list_reports(int)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;