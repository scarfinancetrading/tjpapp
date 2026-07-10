
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS theme_primary TEXT NOT NULL DEFAULT '#f5b301',
  ADD COLUMN IF NOT EXISTS theme_secondary TEXT NOT NULL DEFAULT '#1f2937',
  ADD COLUMN IF NOT EXISTS theme_background TEXT NOT NULL DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS theme_font TEXT NOT NULL DEFAULT 'Inter',
  ADD COLUMN IF NOT EXISTS theme_shape TEXT NOT NULL DEFAULT 'rounded-lg';

-- Allow the webhook (service role) to bypass RLS is automatic; ensure grants are OK.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
