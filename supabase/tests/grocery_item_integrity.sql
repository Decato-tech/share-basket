BEGIN;

SELECT plan(19);

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

SELECT lives_ok(
  $$
    INSERT INTO public.grocery_items (
      id,
      household_id,
      name,
      added_by,
      checked,
      checked_by,
      checked_at,
      created_at
    )
    VALUES (
      '50000000-0000-0000-0000-000000000005',
      '30000000-0000-0000-0000-000000000003',
      'Milk',
      '20000000-0000-0000-0000-000000000002',
      true,
      '20000000-0000-0000-0000-000000000002',
      '2000-01-01T00:00:00Z',
      '2000-01-01T00:00:00Z'
    )
  $$,
  'a member can add an item to their household'
);

SELECT is(
  (
    SELECT added_by
    FROM public.grocery_items
    WHERE id = '50000000-0000-0000-0000-000000000005'
  ),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'the database records the authenticated user as added_by'
);

SELECT is(
  (
    SELECT checked_by
    FROM public.grocery_items
    WHERE id = '50000000-0000-0000-0000-000000000005'
  ),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'the database records the authenticated user as checked_by'
);

SELECT is(
  (
    SELECT status
    FROM public.grocery_items
    WHERE id = '50000000-0000-0000-0000-000000000005'
  ),
  'bought',
  'checked=true is stored as bought status for compatibility'
);

SELECT is(
  (
    SELECT status_updated_by
    FROM public.grocery_items
    WHERE id = '50000000-0000-0000-0000-000000000005'
  ),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'the database records the authenticated user as status_updated_by'
);

SELECT ok(
  (
    SELECT created_at > '2020-01-01T00:00:00Z'
      AND checked_at > '2020-01-01T00:00:00Z'
      AND status_updated_at > '2020-01-01T00:00:00Z'
    FROM public.grocery_items
    WHERE id = '50000000-0000-0000-0000-000000000005'
  ),
  'client-supplied audit timestamps are replaced by server timestamps'
);

SELECT throws_ok(
  $$
    INSERT INTO public.grocery_items (household_id, name, added_by)
    VALUES (
      '40000000-0000-0000-0000-000000000004',
      'Cross-household item',
      '10000000-0000-0000-0000-000000000001'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "grocery_items"',
  'a member cannot add an item to another household'
);

SELECT throws_ok(
  $$
    UPDATE public.grocery_items
    SET added_by = '20000000-0000-0000-0000-000000000002'
    WHERE id = '50000000-0000-0000-0000-000000000005'
  $$,
  '42501',
  'Grocery item ownership fields are immutable',
  'added_by cannot be changed after insert'
);

SELECT throws_ok(
  $$
    UPDATE public.grocery_items
    SET household_id = '40000000-0000-0000-0000-000000000004'
    WHERE id = '50000000-0000-0000-0000-000000000005'
  $$,
  '42501',
  'Grocery item ownership fields are immutable',
  'an item cannot be moved to another household'
);

SELECT lives_ok(
  $$
    UPDATE public.grocery_items
    SET checked = false,
        checked_by = '20000000-0000-0000-0000-000000000002',
        checked_at = '2000-01-01T00:00:00Z'
    WHERE id = '50000000-0000-0000-0000-000000000005'
  $$,
  'a member can uncheck an item'
);

SELECT ok(
  (
    SELECT NOT checked
      AND status = 'needed'
      AND checked_by IS NULL
      AND checked_at IS NULL
    FROM public.grocery_items
    WHERE id = '50000000-0000-0000-0000-000000000005'
  ),
  'unchecking clears database-managed audit fields'
);

SELECT throws_ok(
  $
    UPDATE public.grocery_items
    SET checked_by = '20000000-0000-0000-0000-000000000002'
    WHERE id = '50000000-0000-0000-0000-000000000005'
  $,
  '42501',
  'Check-off audit fields are managed by the database',
  'check-off audit fields cannot be changed without changing checked state'
);

SELECT throws_ok(
  $
    UPDATE public.grocery_items
    SET status_updated_by = '20000000-0000-0000-0000-000000000002'
    WHERE id = '50000000-0000-0000-0000-000000000005'
  $,
  '42501',
  'Status audit fields are managed by the database',
  'status audit fields cannot be changed without changing item status'
);

SELECT lives_ok(
  $
    UPDATE public.grocery_items
    SET status = 'not_in_stock',
        not_in_stock_note = 'Try Lidl'
    WHERE id = '50000000-0000-0000-0000-000000000005'
  $,
  'a member can mark an item as not in stock'
);

SELECT ok(
  (
    SELECT status = 'not_in_stock'
      AND NOT checked
      AND checked_by IS NULL
      AND checked_at IS NULL
      AND not_in_stock_note = 'Try Lidl'
    FROM public.grocery_items
    WHERE id = '50000000-0000-0000-0000-000000000005'
  ),
  'not-in-stock items remain unchecked and keep their note'
);

SELECT lives_ok(
  $
    UPDATE public.grocery_items
    SET status = 'bought'
    WHERE id = '50000000-0000-0000-0000-000000000005'
  $,
  'a member can change a not-in-stock item to bought'
);

SELECT lives_ok(
  $$
    UPDATE public.grocery_items
    SET name = 'Whole milk'
    WHERE id = '50000000-0000-0000-0000-000000000005'
  $$,
  'members retain intended item editing access'
);

SELECT ok(
  has_column_privilege('authenticated', 'public.households', 'name', 'UPDATE'),
  'members can update the household name'
);

SELECT ok(
  NOT has_column_privilege(
    'authenticated',
    'public.households',
    'invite_code',
    'UPDATE'
  ),
  'members cannot update the household invite code directly'
);

SELECT lives_ok(
  $$
    DELETE FROM public.grocery_items
    WHERE id = '50000000-0000-0000-0000-000000000005'
  $$,
  'members retain intended item deletion access'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
