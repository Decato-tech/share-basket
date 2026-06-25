-- Allow the client to discover the signed-in user's existing household through
-- one narrow RPC. This avoids trapping users on onboarding when direct table
-- reads are restricted by RLS or column/function permissions, while still
-- keeping invite codes out of the response.
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
