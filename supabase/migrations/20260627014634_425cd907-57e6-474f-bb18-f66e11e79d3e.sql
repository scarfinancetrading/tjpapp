ALTER TABLE public.journals ADD COLUMN IF NOT EXISTS commission_per_lot numeric NOT NULL DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS lotaje text;