
-- Add new columns to bookings
ALTER TABLE public.bookings 
ADD COLUMN source text NOT NULL DEFAULT '',
ADD COLUMN guest_count integer NOT NULL DEFAULT 1,
ADD COLUMN cancelled boolean NOT NULL DEFAULT false,
ADD COLUMN citrus_infusion boolean NOT NULL DEFAULT false;

-- Update public_bookings_view to include cancelled status
DROP VIEW IF EXISTS public.public_bookings_view;
CREATE VIEW public.public_bookings_view AS
SELECT 
  b.id,
  b.house_id,
  b.check_in,
  b.check_out,
  b.total_price,
  b.cancelled,
  h.name AS house_name,
  h.color AS house_color
FROM public.bookings b
JOIN public.houses h ON b.house_id = h.id;
