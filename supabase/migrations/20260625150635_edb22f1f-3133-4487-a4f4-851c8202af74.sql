
REVOKE EXECUTE ON FUNCTION public.generate_invite_code() FROM anon, authenticated;
DO $guard$
BEGIN
  IF to_regprocedure('public.is_household_member(uuid, uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) FROM anon, authenticated';
  END IF;
  IF to_regprocedure('public.user_household_ids(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.user_household_ids(uuid) FROM anon, authenticated';
  END IF;
END $guard$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_household(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_household_by_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_household_invite_code(uuid) FROM anon;
