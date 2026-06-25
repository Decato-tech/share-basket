
-- 1. Pin search_path on generate_invite_code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 2. Revoke EXECUTE on SECURITY DEFINER helpers from public/anon/authenticated.
--    Internal helpers used only inside RLS / triggers stay callable by definer privileges.
REVOKE EXECUTE ON FUNCTION public.generate_invite_code() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_household_ids(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_household(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_household_by_code(text) FROM PUBLIC;

-- Keep user-callable RPCs
GRANT EXECUTE ON FUNCTION public.create_household(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_household_by_code(text) TO authenticated;

-- 3. Restrict invite_code column visibility to the household creator only.
--    Drop SELECT on the whole table and re-grant per-column, excluding invite_code.
REVOKE SELECT ON public.households FROM authenticated, anon;
GRANT SELECT (id, name, created_by, created_at) ON public.households TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.households TO authenticated;

-- RPC to fetch invite code, only for creator
CREATE OR REPLACE FUNCTION public.get_household_invite_code(_household_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT invite_code
  FROM public.households
  WHERE id = _household_id AND created_by = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_household_invite_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_household_invite_code(uuid) TO authenticated;

-- 4. Realtime: restrict channel subscriptions to household members.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household members can receive realtime" ON realtime.messages;
CREATE POLICY "Household members can receive realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ '^(items|settings)-[0-9a-fA-F-]{36}$'
  AND public.is_household_member(
    substring(realtime.topic() from position('-' in realtime.topic()) + 1)::uuid,
    (SELECT auth.uid())
  )
);
