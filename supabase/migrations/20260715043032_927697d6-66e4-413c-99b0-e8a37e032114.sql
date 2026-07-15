ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS funding_account_id text;
CREATE INDEX IF NOT EXISTS trades_funding_account_id_idx ON public.trades(funding_account_id);