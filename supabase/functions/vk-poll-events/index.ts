// VK Bots Long Poll fallback.
// Works when VK Callback API is not delivering events to vk-webhook
// (e.g. the URL was never confirmed in Community settings, or the token
// lacks `manage` scope so we can't auto-configure Callback servers).
// Requires only the `messages` scope on the community token.
import { admin, corsHeaders, getAccount, processIncomingVkMessage } from "../_shared/vk.ts";

const LONG_POLL_WAIT_SEC = 10;

async function refreshLongPollServer(accountId: string, accessToken: string, groupId: number, apiVersion: string) {
  const url = new URL("https://api.vk.com/method/messages.getLongPollServer");
  url.searchParams.set("group_id", String(groupId));
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("v", apiVersion || "5.199");
  const r = await fetch(url.toString(), { method: "POST" });
  const j = await r.json().catch(() => null);
  const resp = j?.response;
  if (!resp?.server || !resp?.key || resp?.ts === undefined) {
    return { ok: false, error: j?.error ?? j };
  }
  const server = String(resp.server).startsWith("http") ? resp.server : `https://${resp.server}`;
  const sb = admin();
  await sb.from("vk_account").update({
    lp_server: server,
    lp_key: resp.key,
    lp_ts: Number(resp.ts),
  }).eq("id", accountId);
  return { ok: true, server, key: resp.key, ts: Number(resp.ts) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const acc = await getAccount();
  if (!acc?.access_token || !acc.group_id) {
    return json({ ok: false, error: "VK account not configured" }, 400);
  }

  let server = (acc as any).lp_server as string | null;
  let key = (acc as any).lp_key as string | null;
  let ts = (acc as any).lp_ts as number | null;

  if (!server || !key || ts === null || ts === undefined) {
    const init = await refreshLongPollServer(acc.id, acc.access_token, Number(acc.group_id), acc.api_version);
    if (!init.ok) return json({ ok: false, error: init.error }, 500);
    server = init.server!;
    key = init.key!;
    ts = init.ts!;
  }

  const pollUrl = new URL(server!);
  pollUrl.searchParams.set("act", "a_check");
  pollUrl.searchParams.set("key", key!);
  pollUrl.searchParams.set("ts", String(ts));
  pollUrl.searchParams.set("wait", String(LONG_POLL_WAIT_SEC));
  pollUrl.searchParams.set("mode", "2");
  pollUrl.searchParams.set("version", "3");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), (LONG_POLL_WAIT_SEC + 5) * 1000);
  let pollJson: any = null;
  try {
    const r = await fetch(pollUrl.toString(), { signal: ctrl.signal });
    pollJson = await r.json();
  } catch (e) {
    clearTimeout(timer);
    return json({ ok: false, error: `poll failed: ${String((e as Error).message)}` }, 502);
  }
  clearTimeout(timer);

  // failed: 1 → ts outdated, use new ts; 2/3 → key/server expired, refresh.
  if (pollJson?.failed) {
    if (pollJson.failed === 1 && pollJson.ts !== undefined) {
      await admin().from("vk_account").update({ lp_ts: Number(pollJson.ts) }).eq("id", acc.id);
      return json({ ok: true, failed: 1, ts: Number(pollJson.ts) });
    }
    const init = await refreshLongPollServer(acc.id, acc.access_token, Number(acc.group_id), acc.api_version);
    return json({ ok: init.ok, failed: pollJson.failed, refreshed: init.ok });
  }

  const updates: any[] = Array.isArray(pollJson?.updates) ? pollJson.updates : [];
  let processed = 0;
  for (const u of updates) {
    // User Long Poll event 4 = new message.
    // Format: [4, message_id, flags, peer_id, timestamp, text, {attachments}, {random_id}]
    if (!Array.isArray(u) || u[0] !== 4) continue;
    const flags = Number(u[2] ?? 0);
    const isOutgoing = (flags & 2) === 2;
    if (isOutgoing) continue;
    const peerId = Number(u[3] ?? 0);
    const text = String(u[5] ?? "");
    // Community chats / multi-user chats have peer_id 2_000_000_000+; from_id lives in attachments.from
    const attachments = (u[6] ?? {}) as Record<string, unknown>;
    const fromId = Number((attachments as any)?.from ?? peerId);
    try {
      await processIncomingVkMessage(peerId, fromId, text);
      processed++;
    } catch (e) {
      console.error("processIncomingVkMessage failed", e);
    }
  }

  const newTs = Number(pollJson?.ts ?? ts);
  await admin().from("vk_account").update({ lp_ts: newTs }).eq("id", acc.id);

  return json({ ok: true, processed, updates: updates.length, ts: newTs });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
