ALTER TABLE public.houses
  ADD COLUMN IF NOT EXISTS sauna_price integer NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS plunge_pool_price integer NOT NULL DEFAULT 5000;

UPDATE public.houses SET plunge_pool_price = 5500 WHERE name = 'GREEN';
UPDATE public.houses SET plunge_pool_price = 5000 WHERE name = 'BLACK';