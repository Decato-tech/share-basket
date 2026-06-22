-- The MVP assumes one active household per user. Refuse to choose a household
-- on behalf of users if older data violates that assumption.
DO $$
DECLARE
  duplicate_users INTEGER;
BEGIN
  SELECT count(*)
  INTO duplicate_users
  FROM (
    SELECT user_id
    FROM public.household_members
    GROUP BY user_id
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_users > 0 THEN
    RAISE EXCEPTION
      'Cannot enforce one household per user: % user(s) have multiple memberships. Resolve them before retrying this migration.',
      duplicate_users
      USING ERRCODE = '23505';
  END IF;
END;
$$;

CREATE UNIQUE INDEX household_members_one_per_user
  ON public.household_members (user_id);

CREATE OR REPLACE FUNCTION public.join_household_by_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _household_id UUID;
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.household_members WHERE user_id = _uid
  ) THEN
    RAISE EXCEPTION 'User already belongs to a household';
  END IF;

  SELECT id
  INTO _household_id
  FROM public.households
  WHERE upper(invite_code) = upper(_code);

  IF _household_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  BEGIN
    INSERT INTO public.household_members (household_id, user_id)
    VALUES (_household_id, _uid);
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'User already belongs to a household';
  END;

  RETURN _household_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_household(_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
  _code TEXT;
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.household_members WHERE user_id = _uid
  ) THEN
    RAISE EXCEPTION 'User already belongs to a household';
  END IF;

  LOOP
    _code := public.generate_invite_code();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.households WHERE invite_code = _code
    );
  END LOOP;

  INSERT INTO public.households (name, invite_code, created_by)
  VALUES (_name, _code, _uid)
  RETURNING id INTO _id;

  BEGIN
    INSERT INTO public.household_members (household_id, user_id)
    VALUES (_id, _uid);
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'User already belongs to a household';
  END;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_household(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_household_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_household(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_household_by_code(TEXT) TO authenticated, service_role;
