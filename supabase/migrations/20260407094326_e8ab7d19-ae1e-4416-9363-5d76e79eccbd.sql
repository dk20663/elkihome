
CREATE TABLE public.page_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  visited_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, visited_at)
);

ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert visits"
ON public.page_visits FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Auth can read visits"
ON public.page_visits FOR SELECT
TO authenticated
USING (true);

CREATE INDEX idx_page_visits_date ON public.page_visits(visited_at);
