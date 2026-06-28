
-- VK Auto-reply system (independent from Avito)

CREATE TABLE public.vk_account (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id BIGINT,
  group_screen_name TEXT,
  access_token TEXT,
  confirmation_string TEXT,
  callback_secret TEXT,
  api_version TEXT NOT NULL DEFAULT '5.199',
  webhook_registered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vk_account TO authenticated;
GRANT ALL ON public.vk_account TO service_role;
ALTER TABLE public.vk_account ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all vk_account" ON public.vk_account FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_vk_account_updated BEFORE UPDATE ON public.vk_account FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.vk_autoreply_chains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  retrigger_after_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vk_autoreply_chains TO authenticated;
GRANT ALL ON public.vk_autoreply_chains TO service_role;
ALTER TABLE public.vk_autoreply_chains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all vk_chains" ON public.vk_autoreply_chains FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_vk_chains_updated BEFORE UPDATE ON public.vk_autoreply_chains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.vk_autoreply_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_id UUID NOT NULL REFERENCES public.vk_autoreply_chains(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  keyword_triggers TEXT[] NOT NULL DEFAULT '{}',
  stop_on_client_reply BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vk_steps_chain_idx ON public.vk_autoreply_steps(chain_id, order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vk_autoreply_steps TO authenticated;
GRANT ALL ON public.vk_autoreply_steps TO service_role;
ALTER TABLE public.vk_autoreply_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all vk_steps" ON public.vk_autoreply_steps FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_vk_steps_updated BEFORE UPDATE ON public.vk_autoreply_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.vk_chat_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  peer_id BIGINT NOT NULL UNIQUE,
  chain_id UUID REFERENCES public.vk_autoreply_chains(id) ON DELETE SET NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  next_run_at TIMESTAMPTZ,
  last_client_message_at TIMESTAMPTZ,
  client_replied_at TIMESTAMPTZ,
  last_auto_sent_at TIMESTAMPTZ,
  chain_started_at TIMESTAMPTZ,
  chain_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vk_chat_state_due_idx ON public.vk_chat_state(next_run_at) WHERE chain_completed_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vk_chat_state TO authenticated;
GRANT ALL ON public.vk_chat_state TO service_role;
ALTER TABLE public.vk_chat_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all vk_chat_state" ON public.vk_chat_state FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_vk_chat_state_updated BEFORE UPDATE ON public.vk_chat_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.vk_message_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  peer_id BIGINT NOT NULL,
  chain_id UUID,
  step_id UUID,
  step_index INTEGER,
  text TEXT NOT NULL,
  status public.avito_message_status NOT NULL,
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vk_msg_log_peer_idx ON public.vk_message_log(peer_id, sent_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vk_message_log TO authenticated;
GRANT ALL ON public.vk_message_log TO service_role;
ALTER TABLE public.vk_message_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all vk_msg_log" ON public.vk_message_log FOR ALL USING (true) WITH CHECK (true);
