// Public webhook endpoint that Avito calls on new messenger events.
// Must be reachable without auth (verify_jwt = false).
import { admin, corsHeaders, getSelfUserId } from "../_shared/avito.ts";

interface AvitoWebhookPayload {
  id?: string;
  version?: string;
  timestamp?: number;
  payload?: {
    type?: string;
    value?: {
      id?: string;
      chat_id?: string;
      user_id?: number;
      author_id?: number;
      created?: number;
      type?: string;
      chat_type?: string;
      content?: { text?: string };
      item_id?: number;
      published_at?: number;
    };
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  let body: AvitoWebhookPayload;
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400, headers: corsHeaders });
  }

  const v = body.payload?.value;
  const chatId = v?.chat_id;
  if (!chatId) {
    return new Response(JSON.stringify({ ok: true, skip: "no chat_id" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = admin();

  let selfId = 0;
  try {
    selfId = await getSelfUserId();
  } catch (_) {
    // continue without selfId — we'll still log
  }
  const authorId = Number(v?.author_id ?? v?.user_id ?? 0);
  const isClient = selfId > 0 && authorId > 0 && authorId !== selfId;
  const itemId = v?.item_id ? Number(v.item_id) : null;
  const text = v?.content?.text ?? "";

  const { data: existing } = await sb
    .from("avito_chat_state")
    .select("*")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (!isClient) {
    // Outgoing message (we or admin sent it manually) — record but no action.
    return new Response(JSON.stringify({ ok: true, ignored: "outgoing" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find the chain for this item
  let chainId: string | null = null;
  if (itemId) {
    const { data: ad } = await sb
      .from("avito_ads")
      .select("chain_id")
      .eq("item_id", itemId)
      .maybeSingle();
    chainId = ad?.chain_id ?? null;
  }

  const now = new Date();
  if (!existing) {
    // New chat → start chain at step 0 (will be picked up by processor)
    let firstDelayMs = 0;
    if (chainId) {
      const { data: step0 } = await sb
        .from("autoreply_steps")
        .select("delay_minutes")
        .eq("chain_id", chainId)
        .order("order_index", { ascending: true })
        .limit(1)
        .maybeSingle();
      firstDelayMs = (step0?.delay_minutes ?? 0) * 60_000;
    }
    await sb.from("avito_chat_state").insert({
      chat_id: chatId,
      item_id: itemId,
      chain_id: chainId,
      current_step: 0,
      next_run_at: chainId
        ? new Date(now.getTime() + firstDelayMs).toISOString()
        : null,
      last_client_message_at: now.toISOString(),
      chain_started_at: chainId ? now.toISOString() : null,
    });
  } else {
    // Existing chat — client replied. Stop only if the current step explicitly
    // has stop_on_client_reply; otherwise wake the processor so keyword steps
    // and due follow-ups can answer this message.
    const updates: Record<string, unknown> = {
      last_client_message_at: now.toISOString(),
    };

    if (!existing.chain_id && chainId) {
      updates.chain_id = chainId;
      updates.item_id = itemId;
      updates.current_step = 0;
      updates.chain_started_at = now.toISOString();
      updates.chain_completed_at = null;
      updates.client_replied_at = null;
      updates.next_run_at = now.toISOString();
    } else if (existing.chain_id && !existing.chain_completed_at) {
      const { data: currentStep } = await sb
        .from("autoreply_steps")
        .select("stop_on_client_reply")
        .eq("chain_id", existing.chain_id)
        .order("order_index", { ascending: true })
        .range(existing.current_step ?? 0, existing.current_step ?? 0)
        .maybeSingle();

      if (currentStep?.stop_on_client_reply) {
        updates.client_replied_at = now.toISOString();
        updates.next_run_at = null;
      } else {
        updates.client_replied_at = null;
        updates.next_run_at = now.toISOString();
      }
    }

    // Retrigger: if chain is complete and retrigger_after_days passed → restart.
    if (existing.chain_completed_at && existing.chain_id) {
      const { data: chain } = await sb
        .from("autoreply_chains")
        .select("retrigger_after_days")
        .eq("id", existing.chain_id)
        .maybeSingle();
      const days = chain?.retrigger_after_days ?? null;
      if (days && existing.last_client_message_at) {
        const elapsedDays =
          (now.getTime() - new Date(existing.last_client_message_at).getTime()) /
          86_400_000;
        if (elapsedDays >= days) {
          updates.current_step = 0;
          updates.chain_started_at = now.toISOString();
          updates.chain_completed_at = null;
          updates.client_replied_at = null;
          updates.next_run_at = now.toISOString();
        }
      }
    }
    await sb.from("avito_chat_state").update(updates).eq("chat_id", chatId);
  }

  // Save inbound text snippet to log for visibility
  await sb.from("avito_message_log").insert({
    chat_id: chatId,
    item_id: itemId,
    chain_id: chainId,
    text: `[вх. от клиента] ${text.slice(0, 200)}`,
    status: "skipped",
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
