BEGIN;

SELECT plan(3);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.get_my_household()',
    'EXECUTE'
  ),
  'authenticated users can discover their own household through the RPC'
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

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT results_eq(
  $$ SELECT id, name FROM public.get_my_household() $$,
  $$ VALUES ('30000000-0000-0000-0000-000000000003'::uuid, 'First household'::text) $$,
  'the RPC returns only the current user household'
);

SELECT throws_ok(
  $$ SELECT invite_code FROM public.get_my_household() $$,
  '42703',
  'column "invite_code" does not exist',
  'the RPC does not expose invite codes'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
