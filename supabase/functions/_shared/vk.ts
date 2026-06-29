// Shared VK Community API helpers used by vk-* edge functions.
import { createClient } from "npm:@supabase/supabase-js@2";

export const VK_API = "https://api.vk.com/method";

export function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export interface VkAccount {
  id: string;
  group_id: number | null;
  access_token: string | null;
  confirmation_string: string | null;
  callback_secret: string | null;
  api_version: string;
  webhook_registered_at: string | null;
}

export async function getAccount(): Promise<VkAccount | null> {
  const sb = admin();
  const { data } = await sb
    .from("vk_account")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as VkAccount | null) ?? null;
}

export async function vkFetch(
  method: string,
  params: Record<string, string | number>,
): Promise<{ ok: boolean; status: number; body: string; data?: any }> {
  const acc = await getAccount();
  if (!acc?.access_token) {
    return { ok: false, status: 0, body: "VK access_token not configured" };
  }
  const url = new URL(`${VK_API}/${method}`);
  url.searchParams.set("access_token", acc.access_token);
  url.searchParams.set("v", acc.api_version || "5.199");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const r = await fetch(url.toString(), { method: "POST" });
  const text = await r.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch (_) { /* ignore */ }
  const apiError = parsed?.error;
  return {
    ok: r.ok && !apiError,
    status: r.status,
    body: apiError ? JSON.stringify(apiError) : text,
    data: parsed?.response,
  };
}

export async function sendVkMessage(
  peerId: number,
  text: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const randomId = Math.floor(Math.random() * 2 ** 31);
  return await vkFetch("messages.send", {
    peer_id: peerId,
    message: text,
    random_id: randomId,
    dont_parse_links: 1,
  });
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Shared handler for an incoming client message (used by webhook AND long-poll).
export async function processIncomingVkMessage(
  peerId: number,
  fromId: number,
  text: string,
): Promise<void> {
  if (!peerId) return;
  if (fromId < 0) return; // sent by community itself

  const sb = admin();
  const now = new Date();

  const { data: activeChain } = await sb
    .from("vk_autoreply_chains")
    .select("id")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const chainId = (activeChain as any)?.id ?? null;

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
      firstDelayMs = ((step0 as any)?.delay_minutes ?? 0) * 60_000;
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
      session_started_at: now.toISOString(),
    });
  } else {
    // В новой модели ответ клиента НЕ блокирует цепочку. Просто будим
    // процессор: keyword-шаги отработают по совпадению, sequential продолжится.
    const updates: Record<string, unknown> = {
      last_client_message_at: now.toISOString(),
      client_replied_at: now.toISOString(),
      next_run_at: now.toISOString(),
    };
    const effectiveChainId = (existing as any).chain_id ?? chainId;
    if (effectiveChainId && (existing as any).last_client_message_at) {
      const { data: chain } = await sb
        .from("vk_autoreply_chains")
        .select("reset_after_days, retrigger_after_days")
        .eq("id", effectiveChainId)
        .maybeSingle();
      const resetDays = (chain as any)?.reset_after_days ?? 30;
      const elapsedDays =
        (now.getTime() -
          new Date((existing as any).last_client_message_at).getTime()) /
        86_400_000;
      if (resetDays > 0 && elapsedDays >= resetDays) {
        // Авто-сброс: забываем состояние автоответчика, журнал не трогаем.
        updates.chain_id = effectiveChainId;
        updates.current_step = 0;
        updates.session_started_at = now.toISOString();
        updates.chain_started_at = now.toISOString();
        updates.chain_completed_at = null;
        updates.last_auto_sent_at = null;
      } else if (
        (existing as any).chain_completed_at &&
        (chain as any)?.retrigger_after_days &&
        elapsedDays >= (chain as any).retrigger_after_days
      ) {
        updates.current_step = 0;
        updates.session_started_at = now.toISOString();
        updates.chain_started_at = now.toISOString();
        updates.chain_completed_at = null;
        updates.last_auto_sent_at = null;
      }
    }
    await sb.from("vk_chat_state").update(updates).eq("peer_id", peerId);
  }

  await sb.from("vk_message_log").insert({
    peer_id: peerId,
    chain_id: chainId,
    text: `[вх. от клиента] ${String(text ?? "").slice(0, 200)}`,
    status: "skipped",
  });
}
