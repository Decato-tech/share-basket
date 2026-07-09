BEGIN;

SELECT plan(10);

SELECT has_table(
  'private',
  'invite_code_attempts',
  'invite attempt state is stored outside the public API schema'
);

SELECT function_privs_are(
  'public',
  'join_household_by_code',
  ARRAY['text'],
  'authenticated',
  ARRAY['EXECUTE'],
  'authenticated users can call the protected join RPC'
);

SELECT function_privs_are(
  'public',
  'join_household_by_code',
  ARRAY['text'],
  'anon',
  ARRAY[]::text[],
  'anonymous users cannot call the join RPC'
);

SELECT is(length(public.generate_invite_code()), 8, 'new invite codes contain eight characters');

INSERT INTO auth.users (id, email)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'inviter@example.test'),
  ('20000000-0000-0000-0000-000000000002', 'joiner@example.test');

INSERT INTO public.households (id, name, invite_code, created_by)
VALUES (
  '30000000-0000-0000-0000-000000000003',
  'Test household',
  'LEGACY',
  '10000000-0000-0000-0000-000000000001'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

SELECT is(public.join_household_by_code('wrong1'), NULL::uuid, 'first failure is recorded');
SELECT is(public.join_household_by_code('wrong2'), NULL::uuid, 'second failure is recorded');
SELECT is(public.join_household_by_code('wrong3'), NULL::uuid, 'third failure is recorded');
SELECT is(public.join_household_by_code('wrong4'), NULL::uuid, 'fourth failure is recorded');
SELECT is(public.join_household_by_code('wrong5'), NULL::uuid, 'fifth failure activates the block');

SELECT throws_ok(
  $$ SELECT public.join_household_by_code('LEGACY') $$,
  'P0001',
  'Too many invalid invite code attempts. Try again later.',
  'further attempts are blocked even when the next code is valid'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;