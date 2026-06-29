SELECT cron.schedule(
  'avito-poll-messages-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://hpfurpylorcuvcoevpsl.supabase.co/functions/v1/avito-poll-messages',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwZnVycHlsb3JjdXZjb2V2cHNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NjIwNDUsImV4cCI6MjA4NjQzODA0NX0.LyeU4FaYiyAjbPOrJEgcZN1z-2vWgBmiJXwNZ2ZxpNo"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);