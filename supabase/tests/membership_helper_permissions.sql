BEGIN;

SELECT plan(16);

SELECT ok(
  NOT has_schema_privilege('anon', 'private', 'USAGE'),
  'anonymous users cannot access the private schema'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'private.is_household_member(uuid)',
    'EXECUTE'
  ),
  'anonymous users cannot execute the membership check helper'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'private.user_household_ids()',
    'EXECUTE'
  ),
  'anonymous users cannot execute the household IDs helper'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'private.is_household_member(uuid)',
    'EXECUTE'
  ),
  'authenticated users can execute the policy membership check'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'private.user_household_ids()',
    'EXECUTE'
  ),
  'authenticated users can execute the policy household IDs helper'
);

SELECT is(
  to_regprocedure('public.is_household_member(uuid,uuid)'),
  NULL,
  'the arbitrary-user public membership helper is removed'
);

SELECT is(
  to_regprocedure('public.user_household_ids(uuid)'),
  NULL,
  'the arbitrary-user public household IDs helper is removed'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.create_household(text)', 'EXECUTE'),
  'anonymous users cannot execute create_household'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.join_household_by_code(text)',
    'EXECUTE'
  ),
  'anonymous users cannot execute join_household_by_code'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.create_household(text)',
    'EXECUTE'
  ),
  'authenticated users can execute create_household'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.join_household_by_code(text)',
    'EXECUTE'
  ),
  'authenticated users can execute join_household_by_code'
);

INSERT INTO auth.users (id, email)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'first@example.test'),
  ('20000000-0000-0000-0000-000000000002', 'second@example.test');

INSERT INTO public.households (id, name, invite_code, created_by)
VALUES
  (
    '30000000-0000-0000-0000-000000000003',
    'First household',
    'FIRST1',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    'Second household',
    'SECOND',
    '20000000-0000-0000-0000-000000000002'
  );

INSERT INTO public.household_members (household_id, user_id)
VALUES
  (
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000002'
  );

INSERT INTO public.grocery_items (household_id, name, added_by)
VALUES
  (
    '30000000-0000-0000-0000-000000000003',
    'Visible item',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    'Hidden item',
    '20000000-0000-0000-0000-000000000002'
  );

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT results_eq(
  $$ SELECT private.user_household_ids() $$,
  $$ VALUES ('30000000-0000-0000-0000-000000000003'::uuid) $$,
  'the helper returns only the current user household IDs'
);

SELECT is(
  private.is_household_member(
    '30000000-0000-0000-0000-000000000003'
  ),
  true,
  'the membership helper recognizes the current user household'
);

SELECT is(
  private.is_household_member(
    '40000000-0000-0000-0000-000000000004'
  ),
  false,
  'the membership helper rejects another user household'
);

SELECT is(
  (SELECT count(*) FROM public.households),
  1::bigint,
  'household RLS exposes only the current user household'
);

SELECT is(
  (SELECT count(*) FROM public.grocery_items),
  1::bigint,
  'grocery RLS exposes only items from the current user household'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
