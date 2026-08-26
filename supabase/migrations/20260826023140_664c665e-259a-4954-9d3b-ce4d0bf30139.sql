ALTER TABLE public.houses ADD COLUMN IF NOT EXISTS pool_price integer NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pool boolean NOT NULL DEFAULT false;
UPDATE public.houses SET pool_price = 5000 WHERE name = 'BLACK' AND pool_price = 0;