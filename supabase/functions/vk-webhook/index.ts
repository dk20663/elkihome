// Public VK Callback API endpoint.
// VK requires plain "ok" (or confirmation code) as the response body within 10 seconds.
import { admin, corsHeaders, getAccount } from "../_shared/vk.ts";

interface VkEvent {
  type?: string;
  group_id?: number;
  secret?: string;
  object?: {
    message?: {
      from_id?: number;
      peer_id?: number;
      text?: string;
      out?: number;
      date?: number;
    };
    // legacy shape (api < 5.103)
    from_id?: number;
    peer_id?: number;
    text?: string;
    out?: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("ok"); // VK pings only with POST; respond plain ok to others
  }

  let body: VkEvent;
  try {
    body = await req.json();
  } catch {
    return new Response("ok");
  }

  const acc = await getAccount();

  // Confirmation handshake
  if (body.type === "confirmation") {
    const code = acc?.confirmation_string ?? "";
    return new Response(code, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Secret check (if configured)
  if (acc?.callback_secret && body.secret !== acc.callback_secret) {
    return new Response("ok"); // silently ignore
  }

  // Group id check (if configured)
  if (acc?.group_id && body.group_id && Number(body.group_id) !== Number(acc.group_id)) {
    return new Response("ok");
  }

  if (body.type !== "message_new") {
    return new Response("ok");
  }

  const msg = body.object?.message ?? body.object ?? {};
  const peerId = Number((msg as any).peer_id ?? 0);
  const fromId = Number((msg as any).from_id ?? 0);
  const isOutgoing = Number((msg as any).out ?? 0) === 1;
  const text = String((msg as any).text ?? "");

  if (!peerId || isOutgoing) {
    return new Response("ok");
  }
  // Messages sent by the group itself: from_id is negative (-group_id).
  if (fromId < 0) {
    return new Response("ok");
  }

  const sb = admin();
  const now = new Date();

  // Find the single active chain (one community → one active chain).
  const { data: activeChain } = await sb
    .from("vk_autoreply_chains")
    .select("id")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const chainId = activeChain?.id ?? null;

  const { data: existing } = await sb
    .from("vk_chat_state")
    .select("*")
    .eq("peer_id", peerId)
    .maybeSingle();

  if (!existing) {
    let firstDelayMs = 0;
    if (chainId) {
      const { data: step0 } = await sb
        .from("vk_autoreply_steps")
        .select("delay_minutes")
        .eq("chain_id", chainId)
        .order("order_index", { ascending: true })
        .limit(1)
        .maybeSingle();
      firstDelayMs = (step0?.delay_minutes ?? 0) * 60_000;
    }
    await sb.from("vk_chat_state").insert({
      peer_id: peerId,
      chain_id: chainId,
      current_step: 0,
      next_run_at: chainId
        ? new Date(now.getTime() + firstDelayMs).toISOString()
        : null,
      last_client_message_at: now.toISOString(),
      chain_started_at: chainId ? now.toISOString() : null,
    });
  } else {
    const updates: Record<string, unknown> = {
      last_client_message_at: now.toISOString(),
      client_replied_at: now.toISOString(),
    };
    if (existing.chain_completed_at && existing.chain_id) {
      const { data: chain } = await sb
        .from("vk_autoreply_chains")
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
    await sb.from("vk_chat_state").update(updates).eq("peer_id", peerId);
  }

  await sb.from("vk_message_log").insert({
    peer_id: peerId,
    chain_id: chainId,
    text: `[вх. от клиента] ${text.slice(0, 200)}`,
    status: "skipped",
  });

  return new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } });
});
