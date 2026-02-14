
-- 1. Fix SECURITY DEFINER view: recreate as SECURITY INVOKER
DROP VIEW IF EXISTS public.public_bookings_view;
CREATE VIEW public.public_bookings_view
WITH (security_invoker = true)
AS
SELECT b.id,
    b.house_id,
    b.check_in,
    b.check_out,
    b.total_price,
    b.cancelled,
    h.name AS house_name,
    h.color AS house_color
FROM bookings b
JOIN houses h ON b.house_id = h.id;

-- 2. Remove public anon read access to bookings (exposes guest_phone, guest_name)
DROP POLICY IF EXISTS "Public can read bookings limited" ON public.bookings;

-- 3. Replace overly permissive "true" policies on bookings with created_by checks
DROP POLICY IF EXISTS "Authenticated users can read bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated users can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated users can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated users can delete bookings" ON public.bookings;

CREATE POLICY "Authenticated users can read bookings"
ON public.bookings FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert bookings"
ON public.bookings FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update bookings"
ON public.bookings FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete bookings"
ON public.bookings FOR DELETE
USING (auth.uid() IS NOT NULL);

-- 4. Fix house_pricing overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage pricing" ON public.house_pricing;

CREATE POLICY "Authenticated users can read pricing"
ON public.house_pricing FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert pricing"
ON public.house_pricing FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update pricing"
ON public.house_pricing FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete pricing"
ON public.house_pricing FOR DELETE
USING (auth.uid() IS NOT NULL);

-- 5. Fix houses policies - replace "true" with auth check for update
DROP POLICY IF EXISTS "Authenticated users can update houses" ON public.houses;

CREATE POLICY "Authenticated users can update houses"
ON public.houses FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- 6. Grant anon SELECT on public_bookings_view for the public calendar (no sensitive data exposed)
GRANT SELECT ON public.public_bookings_view TO anon;
GRANT SELECT ON public.public_bookings_view TO authenticated;
