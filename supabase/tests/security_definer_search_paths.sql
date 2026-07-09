BEGIN;

SELECT plan(7);

SELECT ok(
  pg_get_functiondef('public.generate_invite_code()'::regprocedure) LIKE '%SET search_path TO ''''%',
  'generate_invite_code uses an empty search_path'
);

SELECT ok(
  pg_get_functiondef('public.create_household(text)'::regprocedure) LIKE '%SET search_path TO ''''%',
  'create_household uses an empty search_path'
);

SELECT ok(
  pg_get_functiondef('public.join_household_by_code(text)'::regprocedure) LIKE '%SET search_path TO ''''%',
  'join_household_by_code uses an empty search_path'
);

SELECT ok(
  pg_get_functiondef('public.get_household_name_by_invite_code(text)'::regprocedure) LIKE '%SET search_path TO ''''%',
  'get_household_name_by_invite_code uses an empty search_path'
);

SELECT ok(
  pg_get_functiondef('public.get_my_household()'::regprocedure) LIKE '%SET search_path TO ''''%',
  'get_my_household uses an empty search_path'
);

SELECT ok(
  pg_get_functiondef('public.get_household_invite_code(uuid)'::regprocedure) LIKE '%SET search_path TO ''''%',
  'get_household_invite_code uses an empty search_path'
);

SELECT ok(
  pg_get_functiondef('public.leave_current_household()'::regprocedure) LIKE '%SET search_path TO ''''%',
  'leave_current_household uses an empty search_path'
);

SELECT * FROM finish();

ROLLBACK;