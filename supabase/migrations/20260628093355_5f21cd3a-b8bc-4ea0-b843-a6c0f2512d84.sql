
-- ENUM types
CREATE TYPE public.avito_ad_category AS ENUM ('realty', 'services');
CREATE TYPE public.avito_message_status AS ENUM ('sent', 'blocked', 'error', 'skipped');

-- 1) avito_account (single-row config)
CREATE TABLE public.avito_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avito_user_id bigint,
  access_token text,
  token_expires_at timestamptz,
  webhook_registered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avito_account TO authenticated;
GRANT ALL ON public.avito_account TO service_role;
ALTER TABLE public.avito_account ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all avito_account" ON public.avito_account FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_avito_account_updated BEFORE UPDATE ON public.avito_account FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) autoreply_chains
CREATE TABLE public.autoreply_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category public.avito_ad_category NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  retrigger_after_days integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autoreply_chains TO authenticated;
GRANT ALL ON public.autoreply_chains TO service_role;
ALTER TABLE public.autoreply_chains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all chains" ON public.autoreply_chains FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_chains_updated BEFORE UPDATE ON public.autoreply_chains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) autoreply_steps
CREATE TABLE public.autoreply_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES public.autoreply_chains(id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  text text NOT NULL,
  delay_minutes integer NOT NULL DEFAULT 0,
  keyword_triggers text[] NOT NULL DEFAULT '{}',
  stop_on_client_reply boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, order_index)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.autoreply_steps TO authenticated;
GRANT ALL ON public.autoreply_steps TO service_role;
ALTER TABLE public.autoreply_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all steps" ON public.autoreply_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_steps_updated BEFORE UPDATE ON public.autoreply_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) avito_ads
CREATE TABLE public.avito_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id bigint NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  category public.avito_ad_category NOT NULL DEFAULT 'services',
  chain_id uuid REFERENCES public.autoreply_chains(id) ON DELETE SET NULL,
  url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avito_ads TO authenticated;
GRANT ALL ON public.avito_ads TO service_role;
ALTER TABLE public.avito_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all ads" ON public.avito_ads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ads_updated BEFORE UPDATE ON public.avito_ads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) avito_chat_state
CREATE TABLE public.avito_chat_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL UNIQUE,
  item_id bigint,
  chain_id uuid REFERENCES public.autoreply_chains(id) ON DELETE SET NULL,
  current_step integer NOT NULL DEFAULT 0,
  next_run_at timestamptz,
  client_replied_at timestamptz,
  last_client_message_at timestamptz,
  last_auto_sent_at timestamptz,
  chain_started_at timestamptz,
  chain_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_state_due ON public.avito_chat_state (next_run_at) WHERE client_replied_at IS NULL AND chain_completed_at IS NULL;
CREATE INDEX idx_chat_state_item ON public.avito_chat_state (item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avito_chat_state TO authenticated;
GRANT ALL ON public.avito_chat_state TO service_role;
ALTER TABLE public.avito_chat_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all chat_state" ON public.avito_chat_state FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_chat_state_updated BEFORE UPDATE ON public.avito_chat_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) avito_message_log
CREATE TABLE public.avito_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  item_id bigint,
  chain_id uuid,
  step_id uuid,
  step_index integer,
  text text NOT NULL,
  status public.avito_message_status NOT NULL,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_msg_log_sent ON public.avito_message_log (sent_at DESC);
CREATE INDEX idx_msg_log_chat ON public.avito_message_log (chat_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avito_message_log TO authenticated;
GRANT ALL ON public.avito_message_log TO service_role;
ALTER TABLE public.avito_message_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all msg_log" ON public.avito_message_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- seed empty account row
INSERT INTO public.avito_account (avito_user_id) VALUES (NULL);
