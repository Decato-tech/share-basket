-- Add manual grocery item statuses while preserving the existing checked
-- boolean for compatibility with older rows and existing check-off behavior.
ALTER TABLE public.grocery_items
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS status_updated_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS not_in_stock_note TEXT;

UPDATE public.grocery_items
SET
  status = CASE WHEN checked THEN 'bought' ELSE 'needed' END,
  status_updated_by = COALESCE(checked_by, added_by),
  status_updated_at = COALESCE(checked_at, updated_at, created_at)
WHERE status IS NULL;

ALTER TABLE public.grocery_items
  ALTER COLUMN status SET DEFAULT 'needed',
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'grocery_items_status_check'
      AND conrelid = 'public.grocery_items'::regclass
  ) THEN
    ALTER TABLE public.grocery_items
      ADD CONSTRAINT grocery_items_status_check
      CHECK (status IN ('needed', 'bought', 'not_in_stock'));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_grocery_item_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  _uid UUID := auth.uid();
  _next_status TEXT;
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

    -- Compatibility: an older client may insert checked=true without status.
    IF COALESCE(NEW.status, 'needed') = 'needed' AND NEW.checked THEN
      NEW.status := 'bought';
    ELSE
      NEW.status := COALESCE(NEW.status, 'needed');
    END IF;

    NEW.checked := NEW.status = 'bought';
    NEW.status_updated_by := _uid;
    NEW.status_updated_at := now();

    IF NEW.status = 'bought' THEN
      NEW.checked_by := _uid;
      NEW.checked_at := NEW.status_updated_at;
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

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    _next_status := NEW.status;
  ELSIF NEW.checked IS DISTINCT FROM OLD.checked THEN
    -- Compatibility: older clients can still toggle checked directly.
    _next_status := CASE WHEN NEW.checked THEN 'bought' ELSE 'needed' END;
  ELSE
    _next_status := OLD.status;
  END IF;

  IF _next_status IS DISTINCT FROM OLD.status THEN
    NEW.status := _next_status;
    NEW.checked := NEW.status = 'bought';
    NEW.status_updated_by := _uid;
    NEW.status_updated_at := now();

    IF NEW.status = 'bought' THEN
      NEW.checked_by := _uid;
      NEW.checked_at := NEW.status_updated_at;
    ELSE
      NEW.checked_by := NULL;
      NEW.checked_at := NULL;
    END IF;
  ELSE
    IF NEW.status_updated_by IS DISTINCT FROM OLD.status_updated_by
      OR NEW.status_updated_at IS DISTINCT FROM OLD.status_updated_at
    THEN
      RAISE EXCEPTION 'Status audit fields are managed by the database'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.checked_by IS DISTINCT FROM OLD.checked_by
      OR NEW.checked_at IS DISTINCT FROM OLD.checked_at
    THEN
      RAISE EXCEPTION 'Check-off audit fields are managed by the database'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_grocery_item_integrity() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
