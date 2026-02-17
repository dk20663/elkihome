
-- Fix: All policies were accidentally RESTRICTIVE. Recreate as PERMISSIVE (default).

-- bookings
DROP POLICY IF EXISTS "Authenticated users can read bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated users can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated users can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated users can delete bookings" ON public.bookings;

CREATE POLICY "Auth read bookings" ON public.bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update bookings" ON public.bookings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete bookings" ON public.bookings FOR DELETE TO authenticated USING (true);

-- house_pricing
DROP POLICY IF EXISTS "Authenticated users can read pricing" ON public.house_pricing;
DROP POLICY IF EXISTS "Authenticated users can insert pricing" ON public.house_pricing;
DROP POLICY IF EXISTS "Authenticated users can update pricing" ON public.house_pricing;
DROP POLICY IF EXISTS "Authenticated users can delete pricing" ON public.house_pricing;

CREATE POLICY "Auth read pricing" ON public.house_pricing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert pricing" ON public.house_pricing FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update pricing" ON public.house_pricing FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete pricing" ON public.house_pricing FOR DELETE TO authenticated USING (true);

-- houses: allow anon read for guest calendar
DROP POLICY IF EXISTS "Authenticated users can read houses" ON public.houses;
DROP POLICY IF EXISTS "Public can read houses" ON public.houses;
DROP POLICY IF EXISTS "Authenticated users can update houses" ON public.houses;

CREATE POLICY "Anyone can read houses" ON public.houses FOR SELECT USING (true);
CREATE POLICY "Auth update houses" ON public.houses FOR UPDATE TO authenticated USING (true);

-- Fix public_bookings_view: remove security_invoker so anon can query it
DROP VIEW IF EXISTS public.public_bookings_view;
CREATE VIEW public.public_bookings_view AS
SELECT b.id, b.house_id, b.check_in, b.check_out, b.total_price, b.cancelled,
       h.name AS house_name, h.color AS house_color
FROM bookings b
JOIN houses h ON b.house_id = h.id;

GRANT SELECT ON public.public_bookings_view TO anon;
GRANT SELECT ON public.public_bookings_view TO authenticated;
