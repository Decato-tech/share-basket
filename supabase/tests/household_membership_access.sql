BEGIN;

SELECT plan(4);

SELECT ok(
  NOT has_table_privilege(
    'authenticated',
    'public.household_members',
    'INSERT'
  ),
  'authenticated users cannot insert household memberships directly'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'household_members'
      AND policyname = 'Join as self'
  ),
  0,
  'the direct self-join policy is removed'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.create_household(text)',
    'EXECUTE'
  ),
  'authenticated users can still create a household through the validated RPC'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.join_household_by_code(text)',
    'EXECUTE'
  ),
  'authenticated users can still join a household through the invite-code RPC'
);

SELECT * FROM finish();

ROLLBACK;
