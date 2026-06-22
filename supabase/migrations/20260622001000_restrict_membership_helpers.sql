-- Keep policy-only membership helpers outside the API-exposed public schema.
-- Both helpers derive the caller from auth.uid() so they cannot be used to
-- inspect another user's memberships.
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_household_member(_household_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members
    WHERE household_id = _household_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION private.user_household_ids()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT household_id
  FROM public.household_members
  WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION private.is_household_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.user_household_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_household_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_household_ids() TO authenticated, service_role;

-- Rebuild policies against the non-exposed, caller-bound helpers.
DROP POLICY IF EXISTS "Members can view household" ON public.households;
CREATE POLICY "Members can view household"
  ON public.households FOR SELECT TO authenticated
  USING (private.is_household_member(id));

DROP POLICY IF EXISTS "Members can update household" ON public.households;
CREATE POLICY "Members can update household"
  ON public.households FOR UPDATE TO authenticated
  USING (private.is_household_member(id))
  WITH CHECK (private.is_household_member(id));

DROP POLICY IF EXISTS "View members of my households" ON public.household_members;
CREATE POLICY "View members of my households"
  ON public.household_members FOR SELECT TO authenticated
  USING (household_id IN (SELECT private.user_household_ids()));

DROP POLICY IF EXISTS "Household members manage items" ON public.grocery_items;
CREATE POLICY "Household members manage items"
  ON public.grocery_items FOR ALL TO authenticated
  USING (private.is_household_member(household_id))
  WITH CHECK (private.is_household_member(household_id));

DROP FUNCTION IF EXISTS public.is_household_member(UUID, UUID);
DROP FUNCTION IF EXISTS public.user_household_ids(UUID);

-- Public membership RPCs are callable only by authenticated users and the
-- service role, rather than inheriting PostgreSQL's default PUBLIC execute.
REVOKE ALL ON FUNCTION public.create_household(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_household_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_household(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_household_by_code(TEXT) TO authenticated, service_role;
