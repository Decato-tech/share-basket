-- Harden privileged household RPCs by removing reliance on the public schema
-- search path. Keep behavior and grants unchanged; only qualify references and
-- pin the function search_path to the empty path.
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  _chars CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _result TEXT := '';
  _index INTEGER;
BEGIN
  FOR _index IN 1..8 LOOP
    _result := _result || pg_catalog.substr(
      _chars,
      1 + pg_catalog.floor(pg_catalog.random() * pg_catalog.length(_chars))::integer,
      1
    );
  END LOOP;
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invite_code() TO service_role;

CREATE OR REPLACE FUNCTION public.create_household(_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
GRANT EXECUTE ON FUNCTION public.create_household(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.join_household_by_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _household_id UUID;
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.household_members WHERE user_id = _uid) THEN
    RAISE EXCEPTION 'User already belongs to a household';
  END IF;

  PERFORM private.assert_invite_attempt_allowed(_uid);

  SELECT id INTO _household_id
  FROM public.households
  WHERE pg_catalog.upper(invite_code) = pg_catalog.upper(pg_catalog.btrim(_code));

  IF _household_id IS NULL THEN
    -- An exception would roll the attempt counter back with the transaction.
    PERFORM private.record_failed_invite_attempt(_uid);
    RETURN NULL;
  END IF;

  DELETE FROM private.invite_code_attempts WHERE user_id = _uid;

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

REVOKE ALL ON FUNCTION public.join_household_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_household_by_code(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_household_name_by_invite_code(_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _household_name TEXT;
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM private.assert_invite_attempt_allowed(_uid);

  SELECT name INTO _household_name
  FROM public.households
  WHERE pg_catalog.upper(invite_code) = pg_catalog.upper(pg_catalog.btrim(_code))
  LIMIT 1;

  IF _household_name IS NULL THEN
    PERFORM private.record_failed_invite_attempt(_uid);
    RETURN NULL;
  END IF;

  DELETE FROM private.invite_code_attempts WHERE user_id = _uid;
  RETURN _household_name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_household_name_by_invite_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_household_name_by_invite_code(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_household()
RETURNS TABLE (
  id UUID,
  name TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT h.id, h.name, h.created_by, h.created_at
  FROM public.household_members hm
  JOIN public.households h ON h.id = hm.household_id
  WHERE hm.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_household() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_household() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_household_invite_code(_household_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT invite_code
  FROM public.households
  WHERE id = _household_id AND created_by = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_household_invite_code(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_household_invite_code(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_current_household()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _uid UUID := auth.uid();
  _household_id UUID;
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

NOTIFY pgrst, 'reload schema';