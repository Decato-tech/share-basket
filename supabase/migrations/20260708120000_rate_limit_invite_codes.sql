-- Slow down authenticated invite-code guessing without invalidating existing codes.
CREATE TABLE private.invite_code_attempts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE private.invite_code_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.invite_code_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.invite_code_attempts TO service_role;

CREATE OR REPLACE FUNCTION private.assert_invite_attempt_allowed(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = pg_catalog, private
AS $$
DECLARE
  _attempt private.invite_code_attempts%ROWTYPE;
BEGIN
  SELECT * INTO _attempt
  FROM private.invite_code_attempts
  WHERE user_id = _user_id;

  IF _attempt.blocked_until > now() THEN
    RAISE EXCEPTION 'Too many invalid invite code attempts. Try again later.';
  END IF;

  IF _attempt.window_started_at < now() - interval '15 minutes' THEN
    DELETE FROM private.invite_code_attempts WHERE user_id = _user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.record_failed_invite_attempt(_user_id UUID)
RETURNS VOID
LANGUAGE sql
SET search_path = pg_catalog, private
AS $$
  INSERT INTO private.invite_code_attempts (
    user_id, failed_attempts, window_started_at, blocked_until, updated_at
  )
  VALUES (_user_id, 1, now(), NULL, now())
  ON CONFLICT (user_id) DO UPDATE
  SET
    failed_attempts = private.invite_code_attempts.failed_attempts + 1,
    blocked_until = CASE
      WHEN private.invite_code_attempts.failed_attempts + 1 >= 5
        THEN now() + interval '15 minutes'
      ELSE private.invite_code_attempts.blocked_until
    END,
    updated_at = now();
$$;

REVOKE ALL ON FUNCTION private.assert_invite_attempt_allowed(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.record_failed_invite_attempt(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_household_by_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
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
  WHERE upper(invite_code) = upper(trim(_code));

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
SET search_path = pg_catalog, public, private
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
  WHERE upper(invite_code) = upper(trim(_code))
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

-- New households receive stronger codes; existing six-character codes remain valid.
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  _chars CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _result TEXT := '';
  _index INTEGER;
BEGIN
  FOR _index IN 1..8 LOOP
    _result := _result || substr(
      _chars,
      1 + floor(random() * length(_chars))::integer,
      1
    );
  END LOOP;
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invite_code() TO service_role;