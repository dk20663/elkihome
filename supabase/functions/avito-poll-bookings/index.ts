// Polls Avito realty bookings every few minutes and, for new active bookings,
// finds the buyer's chat and starts the autoreply chain immediately so the
// processor sends the very first message proactively (the user clicked
// "Забронировать" — the platform-side chat already exists).
import {
  admin,
  avitoFetch,
  corsHeaders,
  getSelfUserId,
} from "../_shared/avito.ts";

interface Booking {
  avito_booking_id: number;
  status: string;
  check_in?: string;
  check_out?: string;
  contact?: { name?: string; phone?: string; email?: string };
}

async function listBookings(userId: number, itemId: number): Promise<Booking[]> {
  const r = await avitoFetch(
    `/realty/v1/accounts/${userId}/items/${itemId}/bookings`,
  );
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  return Array.isArray(j?.bookings) ? j.bookings : [];
}

async function findChatForItem(
  userId: number,
  itemId: number,
): Promise<{ chatId: string; updated: number } | null> {
  // Newest chats first; the just-created booking chat should be near the top.
  const r = await avitoFetch(
    `/messenger/v2/accounts/${userId}/chats?item_ids=${itemId}&limit=20`,
  );
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  const chats: any[] = Array.isArray(j?.chats) ? j.chats : [];
  if (chats.length === 0) return null;
  // Pick the most recently updated one
  const sorted = [...chats].sort(
    (a, b) => (b?.updated ?? 0) - (a?.updated ?? 0),
  );
  const top = sorted[0];
  return top?.id ? { chatId: String(top.id), updated: Number(top.updated ?? 0) } : null;
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
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Pull all realty ads that have a chain with trigger_on_booking = true.
  // Лимит — защита от перерасхода Avito Realty API (≈1000 req/h на токен):
  // при росте числа объявлений берём не более 25 за запуск (=750/час макс).
  const { data: ads } = await sb
    .from("avito_ads")
    .select("item_id, chain_id, category")
    .eq("category", "realty")
    .not("chain_id", "is", null)
    .limit(25);

  const results: any[] = [];
  for (const ad of ads ?? []) {
    const { data: chain } = await sb
      .from("autoreply_chains")
      .select("id, is_active, trigger_on_booking")
      .eq("id", ad.chain_id)
      .maybeSingle();
    if (!chain?.is_active || !chain.trigger_on_booking) continue;

    let bookings: Booking[] = [];
    try {
      bookings = await listBookings(selfId, Number(ad.item_id));
    } catch (_) {
      continue;
    }

    for (const b of bookings) {
      if (b.status !== "active") continue;
      // Idempotency: skip if we already processed this booking_id
      const { data: seen } = await sb
        .from("avito_bookings_seen")
        .select("id")
        .eq("avito_booking_id", b.avito_booking_id)
        .maybeSingle();
      if (seen) continue;

      const chat = await findChatForItem(selfId, Number(ad.item_id));
      if (!chat) {
        await sb.from("avito_bookings_seen").insert({
          avito_booking_id: b.avito_booking_id,
          item_id: ad.item_id,
          chain_id: chain.id,
          status: "no_chat",
          note: "Chat not found via messenger API",
        });
        results.push({ booking: b.avito_booking_id, status: "no_chat" });
        continue;
      }

      // Don't double-start if a chat_state already exists for this chat
      const { data: existingState } = await sb
        .from("avito_chat_state")
        .select("id, chain_id")
        .eq("chat_id", chat.chatId)
        .maybeSingle();

      const now = new Date().toISOString();
      if (existingState) {
        // Restart chain at step 0 regardless of previous state
        await sb.from("avito_chat_state").update({
          chain_id: chain.id,
          item_id: ad.item_id,
          current_step: 0,
          next_run_at: now, // send immediately
          chain_started_at: now,
          chain_completed_at: null,
          client_replied_at: null,
          last_auto_sent_at: null,
        }).eq("id", existingState.id);
      } else {
        await sb.from("avito_chat_state").insert({
          chat_id: chat.chatId,
          item_id: ad.item_id,
          chain_id: chain.id,
          current_step: 0,
          next_run_at: now,
          chain_started_at: now,
        });
      }

      await sb.from("avito_bookings_seen").insert({
        avito_booking_id: b.avito_booking_id,
        item_id: ad.item_id,
        chat_id: chat.chatId,
        chain_id: chain.id,
        status: "triggered",
        processed_at: now,
      });
      results.push({ booking: b.avito_booking_id, status: "triggered", chat: chat.chatId });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed: results.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
