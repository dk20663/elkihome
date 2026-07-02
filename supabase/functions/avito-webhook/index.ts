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
      session_started_at: now.toISOString(),
    });
  } else {
    // Existing chat — клиент написал сообщение. Будим процессор.
    const updates: Record<string, unknown> = {
      last_client_message_at: now.toISOString(),
      client_replied_at: now.toISOString(),
      next_run_at: now.toISOString(),
    };

    if (!existing.chain_id && chainId) {
      updates.chain_id = chainId;
      updates.item_id = itemId;
      updates.current_step = 0;
      updates.chain_started_at = now.toISOString();
      updates.session_started_at = now.toISOString();
      updates.chain_completed_at = null;
      updates.last_auto_sent_at = null;
    }

    // Если предыдущая цепочка уже завершена — это НОВАЯ сессия. Всегда
    // сбрасываем состояние (иначе процессор игнорирует чат по фильтру
    // chain_completed_at IS NULL). Также сброс срабатывает по истечению
    // reset_after_days.
    const effectiveChainId = (updates.chain_id as string | undefined) ?? existing.chain_id;
    if (effectiveChainId) {
      let shouldReset = Boolean(existing.chain_completed_at);
      if (!shouldReset && existing.last_client_message_at) {
        const { data: chain } = await sb
          .from("autoreply_chains")
          .select("reset_after_days")
          .eq("id", effectiveChainId)
          .maybeSingle();
        const resetDays = chain?.reset_after_days ?? 30;
        const elapsedDays =
          (now.getTime() - new Date(existing.last_client_message_at).getTime()) /
          86_400_000;
        if (resetDays > 0 && elapsedDays >= resetDays) shouldReset = true;
      }
      if (shouldReset) {
        updates.current_step = 0;
        updates.session_started_at = now.toISOString();
        updates.chain_started_at = now.toISOString();
        updates.chain_completed_at = null;
        updates.last_auto_sent_at = null;
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
