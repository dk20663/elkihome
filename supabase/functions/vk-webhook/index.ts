// Public VK Callback API endpoint.
// VK requires plain "ok" (or confirmation code) as the response body within 10 seconds.
import { admin, corsHeaders, getAccount, processIncomingVkMessage } from "../_shared/vk.ts";

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
    let code = (acc?.confirmation_string ?? "").trim();
    const incomingGroupId = Number(body.group_id ?? 0);

    // Auto-fetch code from VK API if we have a token but no saved code
    if (!code && acc?.access_token && incomingGroupId) {
      try {
        const url = new URL("https://api.vk.com/method/groups.getCallbackConfirmationCode");
        url.searchParams.set("group_id", String(incomingGroupId));
        url.searchParams.set("access_token", acc.access_token);
        url.searchParams.set("v", acc.api_version || "5.199");
        const r = await fetch(url.toString(), { method: "POST" });
        const j = await r.json().catch(() => null);
        const fetched = j?.response?.code as string | undefined;
        if (fetched) {
          code = fetched;
          const sb = admin();
          await sb
            .from("vk_account")
            .update({
              confirmation_string: fetched,
              group_id: acc.group_id ?? incomingGroupId,
            })
            .eq("id", acc.id);
        }
      } catch (_) { /* ignore — will return empty */ }
    }

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

  await processIncomingVkMessage(peerId, fromId, text);

  return new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } });
});
