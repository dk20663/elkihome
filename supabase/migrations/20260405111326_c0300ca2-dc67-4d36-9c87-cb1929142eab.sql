
ALTER TABLE public.bookings ADD COLUMN synced_from text DEFAULT NULL;
ALTER TABLE public.bookings ADD COLUMN external_uid text DEFAULT NULL;

CREATE UNIQUE INDEX idx_bookings_external_uid ON public.bookings (external_uid) WHERE external_uid IS NOT NULL;
