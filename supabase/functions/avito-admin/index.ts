// Admin operations callable from the admin UI:
//   POST { action: "status" }
//   POST { action: "subscribe", webhook_url: "..." }
//   POST { action: "unsubscribe", webhook_url: "..." }
//   POST { action: "self" }                   // refresh own user_id
//   POST { action: "load_ads" }               // pull items from Avito
//   POST { action: "send_test", chat_id, text }
import {
  admin,
  avitoFetch,
  corsHeaders,
  getSelfUserId,
  sendChatMessage,
} from "../_shared/avito.ts";

async function requireAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // Token is validated by Supabase platform when verify_jwt = true (default).
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
        const sb = admin();
        const { data: acc } = await sb
          .from("avito_account")
          .select("avito_user_id, token_expires_at, webhook_registered_at")
          .limit(1)
          .maybeSingle();
        const hasSecrets = Boolean(
          Deno.env.get("AVITO_CLIENT_ID") &&
            Deno.env.get("AVITO_CLIENT_SECRET"),
        );
        return json({ ok: true, account: acc, has_secrets: hasSecrets });
      }
      case "self": {
        const uid = await getSelfUserId();
        return json({ ok: true, avito_user_id: uid });
      }
      case "subscribe": {
        const uid = await getSelfUserId();
        const url = body.webhook_url as string;
        if (!url) return json({ error: "webhook_url required" }, 400);
        const r = await avitoFetch(
          `/messenger/v3/accounts/${uid}/subscriptions`,
          { method: "POST", body: JSON.stringify({ url }) },
        );
        const text = await r.text();
        if (r.ok) {
          await admin().from("avito_account").update({
            webhook_registered_at: new Date().toISOString(),
          }).eq("avito_user_id", uid);
        }
        return json({ ok: r.ok, status: r.status, body: text });
      }
      case "unsubscribe": {
        const uid = await getSelfUserId();
        const url = body.webhook_url as string;
        const r = await avitoFetch(
          `/messenger/v1/accounts/${uid}/subscriptions`,
          { method: "POST", body: JSON.stringify({ url }) },
        );
        return json({ ok: r.ok, status: r.status, body: await r.text() });
      }
      case "load_ads": {
        // Pull active items from Avito and upsert into avito_ads
        const r = await avitoFetch(
          "/core/v1/items?per_page=50&status=active",
        );
        if (!r.ok) return json({ error: await r.text() }, r.status);
        const data = await r.json();
        const sb = admin();
        const rows = (data.resources ?? []).map((it: any) => ({
          item_id: Number(it.id),
          title: String(it.title ?? ""),
          url: it.url ?? null,
        }));
        if (rows.length) {
          await sb.from("avito_ads").upsert(rows, {
            onConflict: "item_id",
            ignoreDuplicates: false,
          });
        }
        return json({ ok: true, count: rows.length });
      }
      case "send_test": {
        const uid = await getSelfUserId();
        const r = await sendChatMessage(uid, body.chat_id, body.text);
        return json({ ok: r.ok, status: r.status, body: r.body });
      }
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
