CREATE TABLE IF NOT EXISTS public.household_category_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  normalized_name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT household_category_overrides_name_not_empty CHECK (btrim(normalized_name) <> ''),
  CONSTRAINT household_category_overrides_category_check CHECK (
    category IN (
      'fruit',
      'vegetables',
      'dairy',
      'eggs',
      'meat',
      'fish_seafood',
      'vegetarian_vegan',
      'bakery',
      'breakfast',
      'pantry',
      'canned_jarred',
      'sauces_condiments',
      'herbs_spices',
      'snacks',
      'drinks',
      'frozen',
      'household',
      'cleaning',
      'personal_care',
      'baby_kids',
      'pet_supplies',
      'other'
    )
  ),
  CONSTRAINT household_category_overrides_unique_name UNIQUE (household_id, normalized_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_category_overrides TO authenticated;
GRANT ALL ON public.household_category_overrides TO service_role;

ALTER TABLE public.household_category_overrides ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.enforce_household_category_override_integrity()
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

  NEW.normalized_name := btrim(lower(NEW.normalized_name));

  IF NEW.normalized_name = '' THEN
    RAISE EXCEPTION 'Category override product name cannot be empty'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := _uid;
    NEW.updated_by := _uid;
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.household_id IS DISTINCT FROM OLD.household_id
    OR NEW.normalized_name IS DISTINCT FROM OLD.normalized_name
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Category override ownership fields are immutable'
      USING ERRCODE = '42501';
  END IF;

  NEW.updated_by := _uid;
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_household_category_override_integrity() FROM PUBLIC;

DROP TRIGGER IF EXISTS household_category_overrides_enforce_integrity
  ON public.household_category_overrides;
CREATE TRIGGER household_category_overrides_enforce_integrity
  BEFORE INSERT OR UPDATE ON public.household_category_overrides
  FOR EACH ROW EXECUTE FUNCTION private.enforce_household_category_override_integrity();

DROP POLICY IF EXISTS "Household members can view category overrides"
  ON public.household_category_overrides;
CREATE POLICY "Household members can view category overrides"
  ON public.household_category_overrides FOR SELECT TO authenticated
  USING (private.is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can add category overrides"
  ON public.household_category_overrides;
CREATE POLICY "Household members can add category overrides"
  ON public.household_category_overrides FOR INSERT TO authenticated
  WITH CHECK (private.is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can update category overrides"
  ON public.household_category_overrides;
CREATE POLICY "Household members can update category overrides"
  ON public.household_category_overrides FOR UPDATE TO authenticated
  USING (private.is_household_member(household_id))
  WITH CHECK (private.is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can delete category overrides"
  ON public.household_category_overrides;
CREATE POLICY "Household members can delete category overrides"
  ON public.household_category_overrides FOR DELETE TO authenticated
  USING (private.is_household_member(household_id));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'household_category_overrides'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.household_category_overrides;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
