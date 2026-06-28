// Cron-driven processor: sends due auto-reply steps.
import {
  admin,
  corsHeaders,
  getSelfUserId,
  sendChatMessage,
} from "../_shared/avito.ts";

const HOUR_MS = 60 * 60 * 1000;

function pickVariant(text: string): string {
  // Allow "var1|||var2|||var3" syntax for randomized text variants.
  const parts = text.split("|||").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return text;
  return parts[Math.floor(Math.random() * parts.length)];
}

function jitterMs() {
  // ±15s randomization to look less bot-like
  return Math.floor((Math.random() - 0.5) * 30_000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const sb = admin();
  const nowIso = new Date().toISOString();

  let selfId: number;
  try {
    selfId = await getSelfUserId();
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data: due } = await sb
    .from("avito_chat_state")
    .select("*")
    .lte("next_run_at", nowIso)
    .is("client_replied_at", null)
    .is("chain_completed_at", null)
    .not("chain_id", "is", null)
    .limit(20);

  const results: any[] = [];
  for (const state of due ?? []) {
    // hourly per-chat cap
    if (
      state.last_auto_sent_at &&
      Date.now() - new Date(state.last_auto_sent_at).getTime() < HOUR_MS
    ) continue;

    const { data: chain } = await sb
      .from("autoreply_chains")
      .select("is_active")
      .eq("id", state.chain_id)
      .maybeSingle();
    if (!chain?.is_active) continue;

    const { data: steps } = await sb
      .from("autoreply_steps")
      .select("*")
      .eq("chain_id", state.chain_id)
      .order("order_index", { ascending: true });
    if (!steps || steps.length === 0) {
      await sb.from("avito_chat_state").update({
        chain_completed_at: nowIso,
        next_run_at: null,
      }).eq("id", state.id);
      continue;
    }

    const step = steps[state.current_step];
    if (!step) {
      await sb.from("avito_chat_state").update({
        chain_completed_at: nowIso,
        next_run_at: null,
      }).eq("id", state.id);
      continue;
    }

    // keyword filter: if set, last client msg must contain one of them
    if (step.keyword_triggers && step.keyword_triggers.length > 0) {
      const { data: lastIn } = await sb
        .from("avito_message_log")
        .select("text")
        .eq("chat_id", state.chat_id)
        .eq("status", "skipped")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const hay = (lastIn?.text ?? "").toLowerCase();
      const hit = step.keyword_triggers.some((kw: string) =>
        hay.includes(kw.toLowerCase())
      );
      if (!hit) {
        // skip to next step
        const nextIdx = state.current_step + 1;
        await sb.from("avito_chat_state").update({
          current_step: nextIdx,
          next_run_at: new Date(Date.now() + 1000).toISOString(),
        }).eq("id", state.id);
        continue;
      }
    }

    const text = pickVariant(step.text);
    const res = await sendChatMessage(selfId, state.chat_id, text);
    const status = res.ok ? "sent" : "error";
    await sb.from("avito_message_log").insert({
      chat_id: state.chat_id,
      item_id: state.item_id,
      chain_id: state.chain_id,
      step_id: step.id,
      step_index: state.current_step,
      text,
      status,
      error: res.ok ? null : `${res.status}: ${res.body}`,
    });

    if (res.ok) {
      const nextIdx = state.current_step + 1;
      const nextStep = steps[nextIdx];
      const patch: Record<string, unknown> = {
        current_step: nextIdx,
        last_auto_sent_at: new Date().toISOString(),
      };
      if (!nextStep) {
        patch.chain_completed_at = new Date().toISOString();
        patch.next_run_at = null;
      } else {
        patch.next_run_at = new Date(
          Date.now() + nextStep.delay_minutes * 60_000 + jitterMs(),
        ).toISOString();
      }
      await sb.from("avito_chat_state").update(patch).eq("id", state.id);
    } else {
      // retry in 10 min on error
      await sb.from("avito_chat_state").update({
        next_run_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      }).eq("id", state.id);
    }
    results.push({ chat: state.chat_id, status });
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
