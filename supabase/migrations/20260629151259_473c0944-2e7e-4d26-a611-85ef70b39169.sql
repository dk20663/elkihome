
ALTER TABLE public.autoreply_steps ADD COLUMN IF NOT EXISTS is_greeting boolean NOT NULL DEFAULT false;
ALTER TABLE public.vk_autoreply_steps ADD COLUMN IF NOT EXISTS is_greeting boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS autoreply_steps_one_greeting_per_chain ON public.autoreply_steps(chain_id) WHERE is_greeting;
CREATE UNIQUE INDEX IF NOT EXISTS vk_autoreply_steps_one_greeting_per_chain ON public.vk_autoreply_steps(chain_id) WHERE is_greeting;

-- Mark the first step (order_index = 0) of each existing chain as the greeting,
-- preserving the already-prepared welcome text.
UPDATE public.autoreply_steps s SET is_greeting = true
WHERE order_index = 0
  AND NOT EXISTS (SELECT 1 FROM public.autoreply_steps g WHERE g.chain_id = s.chain_id AND g.is_greeting);

UPDATE public.vk_autoreply_steps s SET is_greeting = true
WHERE order_index = 0
  AND NOT EXISTS (SELECT 1 FROM public.vk_autoreply_steps g WHERE g.chain_id = s.chain_id AND g.is_greeting);
