
ALTER TABLE public.autoreply_chains
  ADD COLUMN IF NOT EXISTS trigger_on_booking BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.avito_bookings_seen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avito_booking_id BIGINT NOT NULL UNIQUE,
  item_id BIGINT,
  chat_id TEXT,
  chain_id UUID REFERENCES public.autoreply_chains(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avito_bookings_seen TO authenticated;
GRANT ALL ON public.avito_bookings_seen TO service_role;

ALTER TABLE public.avito_bookings_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated admins manage bookings_seen"
ON public.avito_bookings_seen
FOR ALL
TO authenticated
USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_avito_bookings_seen_item ON public.avito_bookings_seen(item_id);
