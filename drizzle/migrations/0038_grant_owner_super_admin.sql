INSERT INTO public.user_roles(user_id, role)
SELECT id, 'super_admin'::public.app_role FROM auth.users WHERE id = '172fbfea-a28a-4f96-ad05-7b5d746f6dc6'
ON CONFLICT DO NOTHING;