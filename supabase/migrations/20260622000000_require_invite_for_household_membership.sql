-- Household membership creation must go through the validated SECURITY DEFINER
-- functions create_household() and join_household_by_code(). Allowing clients to
-- insert their own user ID directly lets them bypass invite-code validation when
-- they know a household UUID.
DROP POLICY IF EXISTS "Join as self" ON public.household_members;

REVOKE INSERT ON TABLE public.household_members FROM authenticated;
