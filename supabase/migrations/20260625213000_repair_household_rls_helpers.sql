-- Repair live databases where household RLS policies still reference the old
-- public membership helpers after EXECUTE was revoked from authenticated users.
-- The client should be able to load the signed-in user's own household without
-- exposing helper functions that accept arbitrary user IDs.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
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

REVOKE ALL ON FUNCTION private.is_household_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.user_household_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_household_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_household_ids() TO authenticated, service_role;

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
DROP POLICY IF EXISTS "Household members can view items" ON public.grocery_items;
DROP POLICY IF EXISTS "Household members can add items" ON public.grocery_items;
DROP POLICY IF EXISTS "Household members can update items" ON public.grocery_items;
DROP POLICY IF EXISTS "Household members can delete items" ON public.grocery_items;

CREATE POLICY "Household members can view items"
  ON public.grocery_items FOR SELECT TO authenticated
  USING (private.is_household_member(household_id));

CREATE POLICY "Household members can add items"
  ON public.grocery_items FOR INSERT TO authenticated
  WITH CHECK (
    private.is_household_member(household_id)
    AND added_by = auth.uid()
  );

CREATE POLICY "Household members can update items"
  ON public.grocery_items FOR UPDATE TO authenticated
  USING (private.is_household_member(household_id))
  WITH CHECK (private.is_household_member(household_id));

CREATE POLICY "Household members can delete items"
  ON public.grocery_items FOR DELETE TO authenticated
  USING (private.is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can receive realtime" ON realtime.messages;
CREATE POLICY "Household members can receive realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ '^(items|settings)-[0-9a-fA-F-]{36}$'
  AND private.is_household_member(
    substring(realtime.topic() from position('-' in realtime.topic()) + 1)::uuid
  )
);

DROP FUNCTION IF EXISTS public.is_household_member(UUID, UUID);
DROP FUNCTION IF EXISTS public.user_household_ids(UUID);

CREATE OR REPLACE FUNCTION public.get_my_household()
RETURNS TABLE (
  id uuid,
  name text,
  created_by uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id, h.name, h.created_by, h.created_at
  FROM public.household_members hm
  JOIN public.households h ON h.id = hm.household_id
  WHERE hm.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_household() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_household() TO authenticated, service_role;

-- Make PostgREST pick up the repaired RPC/policy state without waiting for the
-- schema cache TTL. This addresses the onboarding "function not found" toast.
NOTIFY pgrst, 'reload schema';
