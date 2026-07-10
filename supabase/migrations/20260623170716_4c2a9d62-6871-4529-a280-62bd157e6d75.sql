
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS image_before_path text,
  ADD COLUMN IF NOT EXISTS image_after_path text,
  ADD COLUMN IF NOT EXISTS image_summary jsonb;
