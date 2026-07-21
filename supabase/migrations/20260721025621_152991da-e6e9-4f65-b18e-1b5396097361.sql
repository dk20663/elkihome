
CREATE TABLE public.report_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  salary_green NUMERIC NOT NULL DEFAULT 2250,
  salary_black NUMERIC NOT NULL DEFAULT 2650,
  salary_sauna_bonus NUMERIC NOT NULL DEFAULT 250,
  salary_pool_bonus NUMERIC NOT NULL DEFAULT 500,
  laundry_per_guest NUMERIC NOT NULL DEFAULT 500,
  electricity_green NUMERIC NOT NULL DEFAULT 5000,
  electricity_black NUMERIC NOT NULL DEFAULT 20000,
  water_delivery_price NUMERIC NOT NULL DEFAULT 5500,
  pools_per_delivery INTEGER NOT NULL DEFAULT 4,
  firewood_per_pool NUMERIC NOT NULL DEFAULT 1500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT report_settings_singleton CHECK (id = true)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_settings TO authenticated;
GRANT ALL ON public.report_settings TO service_role;

ALTER TABLE public.report_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read report_settings"
  ON public.report_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can upsert report_settings"
  ON public.report_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update report_settings"
  ON public.report_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_report_settings_updated_at
  BEFORE UPDATE ON public.report_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.report_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
