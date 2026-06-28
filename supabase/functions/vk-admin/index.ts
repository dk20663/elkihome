// VK admin operations:
//   POST { action: "status" }
//   POST { action: "test_connection" } — calls groups.getById to verify token
//   POST { action: "send_test", peer_id, text }
import { admin, corsHeaders, getAccount, sendVkMessage, vkFetch } from "../_shared/vk.ts";

async function requireAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return authHeader.replace("Bearer ", "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    await requireAuth(req);
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case "status": {
        const acc = await getAccount();
        return json({ ok: true, account: acc });
      }
      case "test_connection": {
        const acc = await getAccount();
        if (!acc?.access_token) return json({ ok: false, error: "Не указан access_token" }, 400);
        const r = await vkFetch("groups.getById", { fields: "screen_name" });
        if (!r.ok) return json({ ok: false, error: r.body }, 400);
        const sb = admin();
        const group = r.data?.groups?.[0] ?? r.data?.[0] ?? null;
        if (group?.id) {
          await sb.from("vk_account").update({
            group_id: Number(group.id),
            group_screen_name: group.screen_name ?? null,
            webhook_registered_at: new Date().toISOString(),
          }).eq("id", acc.id);
        }
        return json({ ok: true, group });
      }
      case "send_test": {
        const peer = Number(body.peer_id);
        if (!peer) return json({ error: "peer_id required" }, 400);
        const r = await sendVkMessage(peer, String(body.text ?? ""));
        return json({ ok: r.ok, status: r.status, body: r.body });
      }
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
