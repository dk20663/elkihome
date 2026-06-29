// Backup polling channel for Avito Messenger.
// If Avito webhooks are delayed/not delivered, this scans recent chats for
// new client messages and starts the same autoreply flow as avito-webhook.
import {
  admin,
  avitoFetch,
  corsHeaders,
  getSelfUserId,
} from "../_shared/avito.ts";

const MAX_ADS_PER_RUN = 25;
const MAX_CHATS_PER_AD = 20;
const MAX_MESSAGES_PER_CHAT = 10;
const RECENT_WINDOW_MS = 2 * 60 * 60 * 1000;

type AdRow = {
  item_id: number | string;
  chain_id: string;
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getMessageCreatedMs(message: Record<string, unknown>): number | null {
  const raw = message.created ?? message.created_at ?? message.timestamp;
  const numeric = asNumber(raw);
  if (numeric !== null) {
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }
  if (typeof raw === "string") {
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function getMessageText(message: Record<string, unknown>): string {
  const content = message.content as Record<string, unknown> | undefined;
  return String(
    content?.text ??
      message.text ??
      message.message ??
      "",
  );
}

function getAuthorId(message: Record<string, unknown>): number | null {
  return asNumber(message.author_id ?? message.user_id ?? message.from_id);
}

async function listChatsForItem(userId: number, itemId: number) {
  const r = await avitoFetch(
    `/messenger/v2/accounts/${userId}/chats?item_ids=${itemId}&limit=${MAX_CHATS_PER_AD}`,
  );
  if (!r.ok) {
    return { chats: [], error: `${r.status}: ${await r.text()}` };
  }
  const json = await r.json().catch(() => ({}));
  return { chats: Array.isArray(json?.chats) ? json.chats : [], error: null };
}

async function getRecentMessages(userId: number, chatId: string) {
  const r = await avitoFetch(
    `/messenger/v3/accounts/${userId}/chats/${chatId}/messages?limit=${MAX_MESSAGES_PER_CHAT}`,
  );
  if (!r.ok) return [];
  const json = await r.json().catch(() => ({}));
  return (Array.isArray(json?.messages) ? json.messages : []) as Array<
    Record<string, unknown>
  >;
}

async function firstStepRunAt(chainId: string, fallback: Date) {
  const { data: step0 } = await admin()
    .from("autoreply_steps")
    .select("delay_minutes")
    .eq("chain_id", chainId)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  return new Date(
    fallback.getTime() + (step0?.delay_minutes ?? 0) * 60_000,
  ).toISOString();
}

async function upsertIncomingMessage(params: {
  chatId: string;
  itemId: number;
  chainId: string;
  createdAt: Date;
  text: string;
}) {
  const sb = admin();
  const { chatId, itemId, chainId, createdAt, text } = params;

  const { data: existing } = await sb
    .from("avito_chat_state")
    .select("*")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (existing?.last_client_message_at) {
    const prev = new Date(existing.last_client_message_at).getTime();
    if (prev >= createdAt.getTime()) {
      return { status: "already_seen" };
    }
  }

  if (!existing) {
    await sb.from("avito_chat_state").insert({
      chat_id: chatId,
      item_id: itemId,
      chain_id: chainId,
      current_step: 0,
      next_run_at: await firstStepRunAt(chainId, createdAt),
      last_client_message_at: createdAt.toISOString(),
      chain_started_at: createdAt.toISOString(),
    });
  } else if (!existing.chain_id && chainId) {
    await sb.from("avito_chat_state").update({
      item_id: itemId,
      chain_id: chainId,
      current_step: 0,
      next_run_at: await firstStepRunAt(chainId, createdAt),
      last_client_message_at: createdAt.toISOString(),
      client_replied_at: null,
      chain_started_at: createdAt.toISOString(),
      chain_completed_at: null,
      last_auto_sent_at: null,
    }).eq("id", existing.id);
  } else if (!existing.chain_completed_at && existing.chain_id) {
    const { data: currentStep } = await sb
      .from("autoreply_steps")
      .select("stop_on_client_reply")
      .eq("chain_id", existing.chain_id)
      .order("order_index", { ascending: true })
      .range(existing.current_step ?? 0, existing.current_step ?? 0)
      .maybeSingle();

    await sb.from("avito_chat_state").update({
      last_client_message_at: createdAt.toISOString(),
      client_replied_at: currentStep?.stop_on_client_reply
        ? createdAt.toISOString()
        : null,
      next_run_at: currentStep?.stop_on_client_reply
        ? null
        : createdAt.toISOString(),
    }).eq("id", existing.id);
  } else {
    await sb.from("avito_chat_state").update({
      item_id: itemId,
      chain_id: chainId,
      current_step: 0,
      next_run_at: await firstStepRunAt(chainId, createdAt),
      last_client_message_at: createdAt.toISOString(),
      client_replied_at: null,
      chain_started_at: createdAt.toISOString(),
      chain_completed_at: null,
      last_auto_sent_at: null,
    }).eq("id", existing.id);
  }

  await sb.from("avito_message_log").insert({
    chat_id: chatId,
    item_id: itemId,
    chain_id: chainId,
    text: `[вх. от клиента / poll] ${text.slice(0, 200)}`,
    status: "skipped",
  });

  return { status: "queued" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sb = admin();
  let selfId: number;
  try {
    selfId = await getSelfUserId();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: ads } = await sb
    .from("avito_ads")
    .select("item_id, chain_id")
    .not("chain_id", "is", null)
    .limit(MAX_ADS_PER_RUN);

  const results: Array<Record<string, unknown>> = [];
  const seenChats = new Set<string>();
  const nowMs = Date.now();

  for (const ad of (ads ?? []) as AdRow[]) {
    const itemId = Number(ad.item_id);
    if (!Number.isFinite(itemId) || !ad.chain_id) continue;

    const { data: chain } = await sb
      .from("autoreply_chains")
      .select("is_active")
      .eq("id", ad.chain_id)
      .maybeSingle();
    if (!chain?.is_active) continue;

    const { chats, error } = await listChatsForItem(selfId, itemId);
    if (error) {
      results.push({ item_id: itemId, status: "chat_list_error", error });
      continue;
    }

    for (const chat of chats) {
      const chatId = String(chat?.id ?? "");
      if (!chatId || seenChats.has(chatId)) continue;
      seenChats.add(chatId);

      const messages = await getRecentMessages(selfId, chatId);
      if (messages.length === 0) continue;

      const withTime = messages
        .map((message) => ({ message, createdMs: getMessageCreatedMs(message) }))
        .filter((row): row is { message: Record<string, unknown>; createdMs: number } =>
          row.createdMs !== null
        )
        .sort((a, b) => b.createdMs - a.createdMs);

      const latestClient = withTime.find((row) => {
        const authorId = getAuthorId(row.message);
        return Boolean(authorId && authorId !== selfId);
      });
      if (!latestClient) continue;

      // If the seller/admin already replied after the latest client message,
      // do not send a late duplicate autoreply. Normal polling will catch the
      // client message first when it runs every minute.
      const sellerReplyAfterClient = withTime.some((row) => {
        const authorId = getAuthorId(row.message);
        return authorId === selfId && row.createdMs > latestClient.createdMs;
      });
      if (sellerReplyAfterClient) continue;

      const createdMs = latestClient.createdMs;
      if (!createdMs || nowMs - createdMs > RECENT_WINDOW_MS) continue;

      const text = getMessageText(latestClient.message);
      const queued = await upsertIncomingMessage({
        chatId,
        itemId,
        chainId: ad.chain_id,
        createdAt: new Date(createdMs),
        text,
      });
      results.push({ chat_id: chatId, item_id: itemId, ...queued });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});