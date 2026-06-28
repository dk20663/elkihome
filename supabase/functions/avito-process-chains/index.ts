// Cron-driven processor: sends due auto-reply steps.
import {
  admin,
  corsHeaders,
  getSelfUserId,
  sendChatMessage,
} from "../_shared/avito.ts";

const HOUR_MS = 60 * 60 * 1000;
const KEYWORD_LOOKBACK = 3; // analyze last N client messages

function pickVariant(text: string): string {
  const parts = text.split("|||").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return text;
  return parts[Math.floor(Math.random() * parts.length)];
}

function jitterMs() {
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

  for (const initialState of due ?? []) {
    let state = initialState;

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

    // Preload last N client messages once per chat (recent autoreply log entries marked 'skipped' = incoming).
    const { data: recentIn } = await sb
      .from("avito_message_log")
      .select("text")
      .eq("chat_id", state.chat_id)
      .eq("status", "skipped")
      .order("sent_at", { ascending: false })
      .limit(KEYWORD_LOOKBACK);
    const clientHaystack = (recentIn ?? [])
      .map((m) => (m.text ?? "").toLowerCase())
      .join("\n");

    // Inner loop: keep processing steps as long as the next one is due immediately (delay 0).
    let sentInThisRun = false;
    while (true) {
      const step = steps[state.current_step];
      if (!step) {
        await sb.from("avito_chat_state").update({
          chain_completed_at: new Date().toISOString(),
          next_run_at: null,
        }).eq("id", state.id);
        break;
      }

      // keyword filter against last N client messages
      if (step.keyword_triggers && step.keyword_triggers.length > 0) {
        const hit = step.keyword_triggers.some((kw: string) =>
          clientHaystack.includes(kw.toLowerCase())
        );
        if (!hit) {
          const nextIdx = state.current_step + 1;
          const nextStep = steps[nextIdx];
          // Skip to next step immediately if it has no delay, otherwise schedule.
          const patch: Record<string, unknown> = { current_step: nextIdx };
          if (!nextStep) {
            patch.chain_completed_at = new Date().toISOString();
            patch.next_run_at = null;
            await sb.from("avito_chat_state").update(patch).eq("id", state.id);
            break;
          }
          if (nextStep.delay_minutes === 0) {
            // continue inner loop without rescheduling
            await sb.from("avito_chat_state").update({ current_step: nextIdx }).eq("id", state.id);
            state = { ...state, current_step: nextIdx };
            continue;
          }
          patch.next_run_at = new Date(
            Date.now() + nextStep.delay_minutes * 60_000 + jitterMs(),
          ).toISOString();
          await sb.from("avito_chat_state").update(patch).eq("id", state.id);
          break;
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

      if (!res.ok) {
        await sb.from("avito_chat_state").update({
          next_run_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        }).eq("id", state.id);
        results.push({ chat: state.chat_id, status });
        break;
      }

      sentInThisRun = true;
      results.push({ chat: state.chat_id, status });

      const nextIdx = state.current_step + 1;
      const nextStep = steps[nextIdx];
      const nowMs = Date.now();
      const patch: Record<string, unknown> = {
        current_step: nextIdx,
        last_auto_sent_at: new Date(nowMs).toISOString(),
      };
      if (!nextStep) {
        patch.chain_completed_at = new Date(nowMs).toISOString();
        patch.next_run_at = null;
        await sb.from("avito_chat_state").update(patch).eq("id", state.id);
        break;
      }

      if (nextStep.delay_minutes === 0) {
        // Chain into the next step within this run.
        // Small delay so messages don't arrive in the wrong order at Avito side.
        patch.next_run_at = new Date(nowMs).toISOString();
        await sb.from("avito_chat_state").update(patch).eq("id", state.id);
        state = {
          ...state,
          current_step: nextIdx,
          last_auto_sent_at: patch.last_auto_sent_at as string,
        };
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }

      patch.next_run_at = new Date(
        nowMs + nextStep.delay_minutes * 60_000 + jitterMs(),
      ).toISOString();
      await sb.from("avito_chat_state").update(patch).eq("id", state.id);
      break;
    }

    void sentInThisRun;
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
