
ALTER TABLE public.autoreply_chains ADD COLUMN IF NOT EXISTS reset_after_days integer NOT NULL DEFAULT 30;
ALTER TABLE public.vk_autoreply_chains ADD COLUMN IF NOT EXISTS reset_after_days integer NOT NULL DEFAULT 30;
ALTER TABLE public.avito_chat_state ADD COLUMN IF NOT EXISTS session_started_at timestamp with time zone;
ALTER TABLE public.vk_chat_state ADD COLUMN IF NOT EXISTS session_started_at timestamp with time zone;
UPDATE public.avito_chat_state SET session_started_at = COALESCE(chain_started_at, created_at) WHERE session_started_at IS NULL;
UPDATE public.vk_chat_state SET session_started_at = COALESCE(chain_started_at, created_at) WHERE session_started_at IS NULL;
