BEGIN;

SELECT plan(9);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_index index_metadata
    JOIN pg_class index_relation
      ON index_relation.oid = index_metadata.indexrelid
    JOIN pg_class table_relation
      ON table_relation.oid = index_metadata.indrelid
    JOIN pg_namespace table_namespace
      ON table_namespace.oid = table_relation.relnamespace
    WHERE table_namespace.nspname = 'public'
      AND table_relation.relname = 'household_members'
      AND index_relation.relname = 'household_members_one_per_user'
      AND index_metadata.indisunique
  ),
  'household membership is unique per user'
);

INSERT INTO auth.users (id, email)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'first@example.test'),
  ('20000000-0000-0000-0000-000000000002', 'second@example.test'),
  ('30000000-0000-0000-0000-000000000003', 'third@example.test');

INSERT INTO public.households (id, name, invite_code, created_by)
VALUES
  (
    '40000000-0000-0000-0000-000000000004',
    'Second household',
    'SECOND',
    '20000000-0000-0000-0000-000000000002'
  ),
  (
    '50000000-0000-0000-0000-000000000005',
    'Third household',
    'THIRD3',
    '30000000-0000-0000-0000-000000000003'
  );

INSERT INTO public.household_members (household_id, user_id)
VALUES
  (
    '40000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000002'
  ),
  (
    '50000000-0000-0000-0000-000000000005',
    '30000000-0000-0000-0000-000000000003'
  );

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$ SELECT public.create_household('First household') $$,
  'a user without a membership can create a household'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.household_members
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'creating a household creates exactly one membership'
);

SELECT throws_ok(
  $$ SELECT public.create_household('Another household') $$,
  'P0001',
  'User already belongs to a household',
  'a member cannot create another household'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

SELECT throws_ok(
  $$ SELECT public.join_household_by_code('THIRD3') $$,
  'P0001',
  'User already belongs to a household',
  'a member cannot join another household'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

SELECT lives_ok(
  $$ SELECT public.leave_current_household() $$,
  'a user can leave their household through the validated RPC'
);

SELECT lives_ok(
  $$ SELECT public.join_household_by_code('SECOND') $$,
  'a user can join a household after leaving the previous one'
);

SELECT is(
  (
    SELECT household_id
    FROM public.household_members
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
  ),
  '40000000-0000-0000-0000-000000000004'::uuid,
  'the user has exactly the newly joined household membership'
);

SELECT throws_ok(
  $$ SELECT public.join_household_by_code('NOTREAL') $$,
  'P0001',
  'User already belongs to a household',
  'membership validation remains deterministic regardless of invite input'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
