-- Route household leaving through a validated SECURITY DEFINER RPC instead
-- of letting clients delete membership rows directly.
CREATE OR REPLACE FUNCTION public.leave_current_household()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _household_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  WITH deleted_memberships AS (
    DELETE FROM public.household_members
    WHERE user_id = _uid
    RETURNING household_id
  )
  SELECT household_id
  INTO _household_id
  FROM deleted_memberships
  LIMIT 1;

  IF _household_id IS NULL THEN
    RAISE EXCEPTION 'User does not belong to a household';
  END IF;

  RETURN _household_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.leave_current_household() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_current_household() TO authenticated, service_role;

DROP POLICY IF EXISTS "Leave as self" ON public.household_members;
REVOKE DELETE ON TABLE public.household_members FROM authenticated;

NOTIFY pgrst, 'reload schema';
