// Cron-driven processor for VK auto-reply chains.
// Mirrors avito-process-chains logic: keyword group scan, zero-delay chaining, per-step idempotency.
import { admin, corsHeaders, sendVkMessage } from "../_shared/vk.ts";

const HOUR_MS = 60 * 60 * 1000;
const KEYWORD_LOOKBACK = 3;
// VK messages.send: лимит ~20/сек на токен сообщества.
// Безопасный буфер — 250 мс между чатами (= 4 msg/sec пиково).
const INTER_PEER_DELAY_MS = 250;

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

  const { data: due } = await sb
    .from("vk_chat_state")
    .select("*")
    .lte("next_run_at", nowIso)
    .is("client_replied_at", null)
    .is("chain_completed_at", null)
    .not("chain_id", "is", null)
    .limit(20);

  const results: any[] = [];

  for (const initialState of due ?? []) {
    let state = initialState;

    if (
      state.last_auto_sent_at &&
      Date.now() - new Date(state.last_auto_sent_at).getTime() < HOUR_MS
    ) continue;

    const { data: chain } = await sb
      .from("vk_autoreply_chains")
      .select("is_active")
      .eq("id", state.chain_id)
      .maybeSingle();
    if (!chain?.is_active) continue;

    const { data: steps } = await sb
      .from("vk_autoreply_steps")
      .select("*")
      .eq("chain_id", state.chain_id)
      .order("order_index", { ascending: true });
    if (!steps || steps.length === 0) {
      await sb.from("vk_chat_state").update({
        chain_completed_at: nowIso,
        next_run_at: null,
      }).eq("id", state.id);
      continue;
    }

    const { data: recentIn } = await sb
      .from("vk_message_log")
      .select("text")
      .eq("peer_id", state.peer_id)
      .eq("status", "skipped")
      .order("sent_at", { ascending: false })
      .limit(KEYWORD_LOOKBACK);
    const clientHaystack = (recentIn ?? [])
      .map((m) => (m.text ?? "").toLowerCase())
      .join("\n");

    while (true) {
      const step = steps[state.current_step];
      if (!step) {
        await sb.from("vk_chat_state").update({
          chain_completed_at: new Date().toISOString(),
          next_run_at: null,
        }).eq("id", state.id);
        break;
      }

      if (step.keyword_triggers && step.keyword_triggers.length > 0) {
        const groupStart = state.current_step;
        let groupEnd = groupStart;
        while (
          groupEnd < steps.length &&
          steps[groupEnd].keyword_triggers &&
          steps[groupEnd].keyword_triggers.length > 0
        ) {
          groupEnd++;
        }
        const group = steps.slice(groupStart, groupEnd);
        const groupIds = group.map((s: any) => s.id);
        const { data: sentRows } = await sb
          .from("vk_message_log")
          .select("step_id")
          .eq("peer_id", state.peer_id)
          .eq("status", "sent")
          .in("step_id", groupIds);
        const sentSet = new Set((sentRows ?? []).map((r: any) => r.step_id));

        const matched = group.find((s: any) =>
          !sentSet.has(s.id) &&
          s.keyword_triggers.some((kw: string) =>
            clientHaystack.includes(kw.toLowerCase())
          )
        );

        if (!matched) {
          await sb.from("vk_chat_state").update({ next_run_at: null }).eq("id", state.id);
          break;
        }

        const matchedIdx = groupStart + group.indexOf(matched);
        if (matchedIdx !== state.current_step) {
          await sb.from("vk_chat_state").update({ current_step: matchedIdx }).eq("id", state.id);
          state = { ...state, current_step: matchedIdx };
        }
      }

      const activeStep = steps[state.current_step];

      const { count: alreadySent } = await sb
        .from("vk_message_log")
        .select("id", { count: "exact", head: true })
        .eq("peer_id", state.peer_id)
        .eq("step_id", activeStep.id)
        .eq("status", "sent");
      if ((alreadySent ?? 0) > 0) {
        const nextIdx = state.current_step + 1;
        const nextStep = steps[nextIdx];
        const patch: Record<string, unknown> = { current_step: nextIdx };
        if (!nextStep) {
          patch.chain_completed_at = new Date().toISOString();
          patch.next_run_at = null;
          await sb.from("vk_chat_state").update(patch).eq("id", state.id);
          break;
        }
        if (nextStep.delay_minutes === 0) {
          await sb.from("vk_chat_state").update({ current_step: nextIdx }).eq("id", state.id);
          state = { ...state, current_step: nextIdx };
          continue;
        }
        patch.next_run_at = new Date(
          Date.now() + nextStep.delay_minutes * 60_000 + jitterMs(),
        ).toISOString();
        await sb.from("vk_chat_state").update(patch).eq("id", state.id);
        break;
      }

      const text = pickVariant(activeStep.text);
      const res = await sendVkMessage(Number(state.peer_id), text);
      const status = res.ok ? "sent" : "error";
      await sb.from("vk_message_log").insert({
        peer_id: state.peer_id,
        chain_id: state.chain_id,
        step_id: activeStep.id,
        step_index: state.current_step,
        text,
        status,
        error: res.ok ? null : `${res.status}: ${res.body}`,
      });

      if (!res.ok) {
        await sb.from("vk_chat_state").update({
          next_run_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        }).eq("id", state.id);
        results.push({ peer: state.peer_id, status });
        break;
      }

      results.push({ peer: state.peer_id, status });

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
        await sb.from("vk_chat_state").update(patch).eq("id", state.id);
        break;
      }

      if (nextStep.delay_minutes === 0) {
        patch.next_run_at = new Date(nowMs).toISOString();
        await sb.from("vk_chat_state").update(patch).eq("id", state.id);
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
      await sb.from("vk_chat_state").update(patch).eq("id", state.id);
      break;
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
