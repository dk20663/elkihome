// Cron-driven processor for VK auto-reply chains.
// Зеркалит avito-process-chains. Модель:
// 1. Каждый шаг — максимум 1 раз за чат (идемпотентность через vk_message_log).
// 2. Keyword-шаги срабатывают независимо при совпадении в последних N
//    клиентских сообщениях.
// 3. Sequential-шаги (без keyword) идут по порядку через current_step + delay.
// 4. Ответ клиента НЕ останавливает цепочку.
import { admin, corsHeaders, sendVkMessage } from "../_shared/vk.ts";

const KEYWORD_LOOKBACK = 3;
const INTER_PEER_DELAY_MS = 250;
const INTER_MSG_DELAY_MS = 800;

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
    .is("chain_completed_at", null)
    .not("chain_id", "is", null)
    .limit(20);

  const results: any[] = [];

  let peerIndex = 0;
  for (const initialState of due ?? []) {
    if (peerIndex > 0) {
      await new Promise((r) => setTimeout(r, INTER_PEER_DELAY_MS));
    }
    peerIndex++;
    const state = initialState;

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

    // Шаги, отправленные В ТЕКУЩЕЙ СЕССИИ (после session_started_at).
    const sessionStart = state.session_started_at ?? state.chain_started_at ?? state.created_at;
    let sentQuery = sb
      .from("vk_message_log")
      .select("step_id")
      .eq("peer_id", state.peer_id)
      .eq("status", "sent");
    if (sessionStart) sentQuery = sentQuery.gte("sent_at", sessionStart);
    const { data: sentRows } = await sentQuery;
    const sentSet = new Set(
      (sentRows ?? []).map((r: any) => r.step_id).filter(Boolean),
    );

    let inQuery = sb
      .from("vk_message_log")
      .select("text")
      .eq("peer_id", state.peer_id)
      .eq("status", "skipped");
    if (sessionStart) inQuery = inQuery.gte("sent_at", sessionStart);
    const { data: recentIn } = await inQuery
      .order("sent_at", { ascending: false })
      .limit(KEYWORD_LOOKBACK);
    const clientHaystack = (recentIn ?? [])
      .map((m) => (m.text ?? "").toLowerCase())
      .join("\n");

    const sendStep = async (step: any) => {
      const text = pickVariant(step.text);
      const res = await sendVkMessage(Number(state.peer_id), text);
      const status = res.ok ? "sent" : "error";
      await sb.from("vk_message_log").insert({
        peer_id: state.peer_id,
        chain_id: state.chain_id,
        step_id: step.id,
        step_index: step.order_index,
        text,
        status,
        error: res.ok ? null : `${res.status}: ${res.body}`,
      });
      if (res.ok) {
        sentSet.add(step.id);
        await sb.from("vk_chat_state").update({
          last_auto_sent_at: new Date().toISOString(),
        }).eq("id", state.id);
      }
      results.push({ peer: state.peer_id, step: step.order_index, status });
      return res.ok;
    };

    // Phase A0: приветствие — один раз за сессию при первом сообщении клиента,
    // даже если нет keyword-совпадений и sequential-шагов в цепочке.
    const greetingStep = steps.find(
      (s: any) => s.is_greeting && !sentSet.has(s.id),
    );
    if (greetingStep && clientHaystack) {
      const ok = await sendStep(greetingStep);
      if (!ok) {
        await sb.from("vk_chat_state").update({
          next_run_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        }).eq("id", state.id);
      } else {
        await new Promise((r) => setTimeout(r, INTER_MSG_DELAY_MS));
      }
    }

    // Phase A: keyword steps
    if (clientHaystack) {
      const matchedKeywordSteps = steps.filter((step: any) =>
        step.keyword_triggers && step.keyword_triggers.length > 0 &&
        !sentSet.has(step.id) &&
        step.keyword_triggers.some((kw: string) =>
          clientHaystack.includes(String(kw).toLowerCase())
        )
      );
      for (const step of matchedKeywordSteps) {
        const ok = await sendStep(step);
        if (!ok) {
          await sb.from("vk_chat_state").update({
            next_run_at: new Date(Date.now() + 10 * 60_000).toISOString(),
          }).eq("id", state.id);
          break;
        }
        await new Promise((r) => setTimeout(r, INTER_MSG_DELAY_MS));
      }
    }

    // Phase B: sequential steps
    let cursor = state.current_step ?? 0;
    let nextRunAt: string | null = null;
    let completed = false;
    let errored = false;

    while (true) {
      const step = steps[cursor];
      if (!step) {
        completed = true;
        break;
      }
      if (sentSet.has(step.id)) {
        cursor++;
        continue;
      }
      if (
        step.is_greeting ||
        (step.keyword_triggers && step.keyword_triggers.length > 0)
      ) {
        cursor++;
        continue;
      }
      const ok = await sendStep(step);
      if (!ok) {
        await sb.from("vk_chat_state").update({
          current_step: cursor,
          next_run_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        }).eq("id", state.id);
        errored = true;
        break;
      }
      cursor++;
      const nextStep = steps[cursor];
      if (
        nextStep &&
        !nextStep.is_greeting &&
        (!nextStep.keyword_triggers || nextStep.keyword_triggers.length === 0)
      ) {
        if ((nextStep.delay_minutes ?? 0) > 0) {
          nextRunAt = new Date(
            Date.now() + nextStep.delay_minutes * 60_000 + jitterMs(),
          ).toISOString();
          break;
        }
        await new Promise((r) => setTimeout(r, INTER_MSG_DELAY_MS));
        continue;
      }
      break;
    }

    if (errored) continue;

    const allSent = steps.every((s: any) => sentSet.has(s.id));
    const patch: Record<string, unknown> = { current_step: cursor };
    if (completed || allSent) {
      patch.chain_completed_at = new Date().toISOString();
      patch.next_run_at = null;
    } else {
      patch.next_run_at = nextRunAt;
    }
    await sb.from("vk_chat_state").update(patch).eq("id", state.id);
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
