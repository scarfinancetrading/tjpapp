ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS theme_primary,
  DROP COLUMN IF EXISTS theme_secondary,
  DROP COLUMN IF EXISTS theme_background,
  DROP COLUMN IF EXISTS theme_font,
  DROP COLUMN IF EXISTS theme_shape;