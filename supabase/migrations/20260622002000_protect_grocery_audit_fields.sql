-- Enforce grocery ownership and audit fields in the database. Authenticated
-- clients may request state changes, but cannot choose the acting user,
-- timestamps, or move an existing item to another household.
CREATE OR REPLACE FUNCTION private.enforce_grocery_item_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  _uid UUID := auth.uid();
BEGIN
  -- service_role operations have no auth.uid() and retain administrative
  -- control for migrations and recovery tasks.
  IF _uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.added_by := _uid;
    NEW.created_at := now();
    NEW.updated_at := now();

    IF NEW.checked THEN
      NEW.checked_by := _uid;
      NEW.checked_at := now();
    ELSE
      NEW.checked_by := NULL;
      NEW.checked_at := NULL;
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.household_id IS DISTINCT FROM OLD.household_id
    OR NEW.added_by IS DISTINCT FROM OLD.added_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Grocery item ownership fields are immutable'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.checked IS DISTINCT FROM OLD.checked THEN
    IF NEW.checked THEN
      NEW.checked_by := _uid;
      NEW.checked_at := now();
    ELSE
      NEW.checked_by := NULL;
      NEW.checked_at := NULL;
    END IF;
  ELSIF NEW.checked_by IS DISTINCT FROM OLD.checked_by
    OR NEW.checked_at IS DISTINCT FROM OLD.checked_at
  THEN
    RAISE EXCEPTION 'Check-off audit fields are managed by the database'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_grocery_item_integrity() FROM PUBLIC;

DROP TRIGGER IF EXISTS grocery_items_enforce_integrity ON public.grocery_items;
CREATE TRIGGER grocery_items_enforce_integrity
  BEFORE INSERT OR UPDATE ON public.grocery_items
  FOR EACH ROW EXECUTE FUNCTION private.enforce_grocery_item_integrity();

DROP POLICY IF EXISTS "Household members manage items" ON public.grocery_items;

CREATE POLICY "Household members can view items"
  ON public.grocery_items FOR SELECT TO authenticated
  USING (private.is_household_member(household_id));

CREATE POLICY "Household members can add items"
  ON public.grocery_items FOR INSERT TO authenticated
  WITH CHECK (
    private.is_household_member(household_id)
    AND added_by = auth.uid()
  );

CREATE POLICY "Household members can update items"
  ON public.grocery_items FOR UPDATE TO authenticated
  USING (private.is_household_member(household_id))
  WITH CHECK (private.is_household_member(household_id));

CREATE POLICY "Household members can delete items"
  ON public.grocery_items FOR DELETE TO authenticated
  USING (private.is_household_member(household_id));

-- Household members may rename their household, but cannot rewrite its owner,
-- invite code, primary key, or creation timestamp through the API.
REVOKE UPDATE ON TABLE public.households FROM authenticated;
GRANT UPDATE (name) ON TABLE public.households TO authenticated;
