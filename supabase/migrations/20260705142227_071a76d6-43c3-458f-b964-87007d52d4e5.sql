CREATE OR REPLACE FUNCTION public.get_household_name_by_invite_code(_code text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT name FROM public.households WHERE upper(invite_code) = upper(_code) LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_household_name_by_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_household_name_by_invite_code(text) TO authenticated;