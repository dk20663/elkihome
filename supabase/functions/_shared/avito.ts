// Shared Avito API helpers used by avito-* edge functions.
// Uses client_credentials OAuth flow (own-account API access).

import { createClient } from "npm:@supabase/supabase-js@2";

export const AVITO_API = "https://api.avito.ru";

export function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/** Get a valid access_token, refreshing via client_credentials if needed. */
export async function getAccessToken(): Promise<string> {
  const sb = admin();
  const { data: acc } = await sb
    .from("avito_account")
    .select("id, access_token, token_expires_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const now = Date.now();
  if (
    acc?.access_token &&
    acc.token_expires_at &&
    new Date(acc.token_expires_at).getTime() - 60_000 > now
  ) {
    return acc.access_token;
  }

  const clientId = Deno.env.get("AVITO_CLIENT_ID");
  const clientSecret = Deno.env.get("AVITO_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error(
      "AVITO_CLIENT_ID / AVITO_CLIENT_SECRET не настроены. Добавьте их в Secrets.",
    );
  }

  const resp = await fetch(`${AVITO_API}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const body = await resp.text();
  if (!resp.ok) {
    throw new Error(`Avito /token ${resp.status}: ${body}`);
  }
  const json = JSON.parse(body) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  const expiresAt = new Date(now + json.expires_in * 1000).toISOString();
  if (acc?.id) {
    await sb
      .from("avito_account")
      .update({ access_token: json.access_token, token_expires_at: expiresAt })
      .eq("id", acc.id);
  } else {
    await sb.from("avito_account").insert({
      access_token: json.access_token,
      token_expires_at: expiresAt,
    });
  }
  return json.access_token;
}

export async function avitoFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${AVITO_API}${path}`, { ...init, headers });
}

/** Resolve the seller's own Avito user_id via /core/v1/accounts/self. */
export async function getSelfUserId(): Promise<number> {
  const sb = admin();
  const { data: acc } = await sb
    .from("avito_account")
    .select("id, avito_user_id")
    .limit(1)
    .maybeSingle();
  if (acc?.avito_user_id) return Number(acc.avito_user_id);

  const r = await avitoFetch("/core/v1/accounts/self");
  if (!r.ok) throw new Error(`accounts/self ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const uid = Number(j.id);
  if (acc?.id) {
    await sb.from("avito_account").update({ avito_user_id: uid }).eq("id", acc.id);
  } else {
    await sb.from("avito_account").insert({ avito_user_id: uid });
  }
  return uid;
}

export async function sendChatMessage(
  userId: number,
  chatId: string,
  text: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const r = await avitoFetch(
    `/messenger/v1/accounts/${userId}/chats/${chatId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ message: { text }, type: "text" }),
    },
  );
  const body = await r.text();
  return { ok: r.ok, status: r.status, body };
}

export async function getChatInfo(userId: number, chatId: string) {
  const r = await avitoFetch(
    `/messenger/v2/accounts/${userId}/chats/${chatId}`,
  );
  if (!r.ok) throw new Error(`chat ${chatId} ${r.status}: ${await r.text()}`);
  return r.json();
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
