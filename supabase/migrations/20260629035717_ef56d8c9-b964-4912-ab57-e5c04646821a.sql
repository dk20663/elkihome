
ALTER TABLE public.vk_account
  ADD COLUMN IF NOT EXISTS lp_server TEXT,
  ADD COLUMN IF NOT EXISTS lp_key TEXT,
  ADD COLUMN IF NOT EXISTS lp_ts BIGINT;

-- Schedule Bots Long Poll fallback every minute.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vk-poll-events-every-min') THEN
    PERFORM cron.unschedule('vk-poll-events-every-min');
  END IF;
END$$;

SELECT cron.schedule(
  'vk-poll-events-every-min',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://hpfurpylorcuvcoevpsl.supabase.co/functions/v1/vk-poll-events',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwZnVycHlsb3JjdXZjb2V2cHNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NjIwNDUsImV4cCI6MjA4NjQzODA0NX0.LyeU4FaYiyAjbPOrJEgcZN1z-2vWgBmiJXwNZ2ZxpNo"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);
