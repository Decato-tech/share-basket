## Problem

When migrations run from scratch (e.g. fresh database via GitHub CI), two migrations fail:

- `20260625150622_*.sql` and `20260625150635_*.sql` reference `public.is_household_member(uuid, uuid)` and `public.user_household_ids(uuid)`.
- These functions were already **dropped** in the earlier `20260622001000_restrict_membership_helpers.sql` migration (they were moved to the `private` schema).
- A later migration (`20260625213000_repair_household_rls_helpers.sql`) already recreates the correct `private.*` helpers and re-binds all RLS / realtime policies.

So those REVOKE statements (and the realtime policy that calls `public.is_household_member`) are referencing functions that no longer exist by the time they run. On live Lovable Cloud the migrations ran in a state where the old functions still existed, so it worked there — but a fresh apply (your GitHub pipeline) fails immediately.

## Fix

Make the two offending migrations safe-to-replay by guarding the missing-function statements. The later `repair_household_rls_helpers` migration already re-establishes the correct end state, so we only need to stop the obsolete statements from erroring.

### Edit `supabase/migrations/20260625150622_*.sql`

- Wrap each REVOKE on `public.is_household_member(uuid, uuid)` and `public.user_household_ids(uuid)` in a `DO` block that checks `pg_proc` first, so it's skipped when the function doesn't exist.
- Wrap the `CREATE POLICY "Household members can receive realtime"` block (which calls `public.is_household_member`) in a conditional `DO` block as well — if the public helper is gone, skip it (the `repair` migration creates the correct `private.*` version right after).

### Edit `supabase/migrations/20260625150635_*.sql`

- Same treatment: guard the two REVOKEs on `public.is_household_member` and `public.user_household_ids` with a `DO` block that no-ops when the functions don't exist.

### Verify

- Re-run the migration set locally against an empty database to confirm it completes cleanly end-to-end.
- No application code changes — runtime behavior is unchanged because `repair_household_rls_helpers` already owns the final policies and helpers.

## Why not just delete the failing statements?

They're historical migrations that already ran on the live database. Editing them to no-op via `DO ... IF EXISTS` keeps the file history intact and is idempotent on both fresh and existing databases.
