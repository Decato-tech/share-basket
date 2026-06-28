ALTER TABLE public.grocery_items
  ADD COLUMN IF NOT EXISTS not_in_stock_note text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'needed';