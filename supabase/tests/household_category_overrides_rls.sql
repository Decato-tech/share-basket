BEGIN;

SELECT plan(7);

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

INSERT INTO public.household_category_overrides (
  household_id,
  normalized_name,
  category
)
VALUES (
  '40000000-0000-0000-0000-000000000004',
  'tofu',
  'vegetarian_vegan'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.household_category_overrides),
  0::bigint,
  'members cannot see category overrides from another household'
);

SELECT lives_ok(
  $$
    INSERT INTO public.household_category_overrides (
      household_id,
      normalized_name,
      category,
      created_by,
      updated_by
    )
    VALUES (
      '30000000-0000-0000-0000-000000000003',
      'halfvolle melk',
      'drinks',
      '20000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000002'
    )
  $$,
  'a member can add a category override for their household'
);

SELECT is(
  (
    SELECT created_by
    FROM public.household_category_overrides
    WHERE normalized_name = 'halfvolle melk'
  ),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'the database records the authenticated user as override creator'
);

SELECT throws_ok(
  $$
    INSERT INTO public.household_category_overrides (
      household_id,
      normalized_name,
      category
    )
    VALUES (
      '40000000-0000-0000-0000-000000000004',
      'zalm',
      'fish_seafood'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "household_category_overrides"',
  'a member cannot add category overrides to another household'
);

SELECT lives_ok(
  $$
    UPDATE public.household_category_overrides
    SET category = 'dairy'
    WHERE normalized_name = 'halfvolle melk'
  $$,
  'a member can update their household category override'
);

SELECT throws_ok(
  $$
    UPDATE public.household_category_overrides
    SET normalized_name = 'volle melk'
    WHERE normalized_name = 'halfvolle melk'
  $$,
  '42501',
  'Category override ownership fields are immutable',
  'override lookup keys cannot be changed after insert'
);

RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.household_category_overrides),
  1::bigint,
  'another household member sees only their own household overrides'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
