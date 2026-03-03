CREATE POLICY "Anyone can read house_pricing"
ON public.house_pricing
FOR SELECT
USING (true);