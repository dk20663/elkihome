ALTER TABLE public.houses ADD COLUMN IF NOT EXISTS sutochno_ical_url text NOT NULL DEFAULT '';
UPDATE public.houses SET sutochno_ical_url = 'https://sutochno.ru/calendar/ical/13c64878758ba65f57aa3e128a0e6386696b8dc.ics' WHERE name = 'GREEN';
UPDATE public.houses SET sutochno_ical_url = 'https://sutochno.ru/calendar/ical/3ba06c7564fc9e1af84d3e1dc52feb98c733671.ics' WHERE name = 'BLACK';