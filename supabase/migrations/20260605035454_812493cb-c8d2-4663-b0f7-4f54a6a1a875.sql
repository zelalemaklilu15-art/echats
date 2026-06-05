
-- Security definer helpers to avoid recursion
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) TO authenticated;

-- group_members policies
DROP POLICY IF EXISTS gm_select ON public.group_members;
DROP POLICY IF EXISTS gm_delete ON public.group_members;
DROP POLICY IF EXISTS gm_insert ON public.group_members;

CREATE POLICY gm_select ON public.group_members
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY gm_insert ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_group_admin(group_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid())
  );

CREATE POLICY gm_delete ON public.group_members
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_group_admin(group_id, auth.uid()));

-- groups policies (also use self-select via group_members; replace with helper)
DROP POLICY IF EXISTS groups_select ON public.groups;
DROP POLICY IF EXISTS groups_update ON public.groups;
DROP POLICY IF EXISTS groups_delete ON public.groups;

CREATE POLICY groups_select ON public.groups
  FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()) OR created_by = auth.uid());

CREATE POLICY groups_update ON public.groups
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(id, auth.uid()) OR created_by = auth.uid());

CREATE POLICY groups_delete ON public.groups
  FOR DELETE TO authenticated
  USING (public.is_group_admin(id, auth.uid()) OR created_by = auth.uid());

-- group_messages
DROP POLICY IF EXISTS gmsg_select ON public.group_messages;
DROP POLICY IF EXISTS gmsg_insert ON public.group_messages;

CREATE POLICY gmsg_select ON public.group_messages
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY gmsg_insert ON public.group_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.is_group_member(group_id, auth.uid()));
