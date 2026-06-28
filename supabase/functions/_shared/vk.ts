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
