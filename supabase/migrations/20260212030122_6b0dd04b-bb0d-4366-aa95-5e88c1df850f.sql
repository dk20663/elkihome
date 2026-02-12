
-- Create houses table
CREATE TABLE public.houses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  base_price_weekday NUMERIC NOT NULL DEFAULT 5000,
  base_price_weekend NUMERIC NOT NULL DEFAULT 7000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.houses ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read houses
CREATE POLICY "Authenticated users can read houses"
  ON public.houses FOR SELECT TO authenticated
  USING (true);

-- All authenticated users can update houses (price changes)
CREATE POLICY "Authenticated users can update houses"
  ON public.houses FOR UPDATE TO authenticated
  USING (true);

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id UUID NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  total_price NUMERIC NOT NULL DEFAULT 0,
  guest_name TEXT NOT NULL DEFAULT '',
  guest_phone TEXT NOT NULL DEFAULT '',
  comment TEXT DEFAULT '',
  sauna BOOLEAN NOT NULL DEFAULT false,
  plunge_pool BOOLEAN NOT NULL DEFAULT false,
  bath_brooms BOOLEAN NOT NULL DEFAULT false,
  fir_infusion BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can CRUD bookings
CREATE POLICY "Authenticated users can read bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert bookings"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update bookings"
  ON public.bookings FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete bookings"
  ON public.bookings FOR DELETE TO authenticated
  USING (true);

-- Public view for calendar (no personal data)
CREATE VIEW public.public_bookings_view
WITH (security_invoker = on) AS
  SELECT b.id, b.house_id, b.check_in, b.check_out, b.total_price, h.name as house_name, h.color as house_color
  FROM public.bookings b
  JOIN public.houses h ON h.id = b.house_id;

-- Allow anon to read public view
CREATE POLICY "Public can read houses"
  ON public.houses FOR SELECT TO anon
  USING (true);

CREATE POLICY "Public can read bookings limited"
  ON public.bookings FOR SELECT TO anon
  USING (true);

-- Custom pricing per date
CREATE TABLE public.house_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id UUID NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  price NUMERIC NOT NULL,
  UNIQUE(house_id, date)
);

ALTER TABLE public.house_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage pricing"
  ON public.house_pricing FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Update trigger for bookings
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for bookings
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.houses;

-- Insert predefined houses
INSERT INTO public.houses (name, color, base_price_weekday, base_price_weekend)
VALUES 
  ('GREEN', 'green', 5000, 7000),
  ('BLACK', 'black', 5000, 7000);
