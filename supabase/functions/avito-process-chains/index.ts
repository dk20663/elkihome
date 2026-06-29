// Cron-driven processor for Avito auto-reply chains.
//
// Модель (новая):
// 1. Каждый шаг цепочки может быть отправлен НЕ БОЛЕЕ одного раза за чат
//    (идемпотентность через avito_message_log).
// 2. Keyword-шаги (с keyword_triggers) срабатывают независимо от порядка:
//    если в одном из последних N клиентских сообщений есть совпадение,
//    и шаг ещё не отправлялся — отправляем.
// 3. Sequential-шаги (без keyword_triggers) идут по порядку через current_step
//    с учётом delay_minutes.
// 4. Ответ клиента НЕ останавливает цепочку. Поле client_replied_at больше
//    не используется как блокирующий фильтр.
import {
  admin,
  corsHeaders,
  getSelfUserId,
  sendChatMessage,
} from "../_shared/avito.ts";

const KEYWORD_LOOKBACK = 3;
const INTER_CHAT_DELAY_MS = 1100;
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
    .is("chain_completed_at", null)
    .not("chain_id", "is", null)
    .limit(20);

  const results: any[] = [];

  let chatIndex = 0;
  for (const initialState of due ?? []) {
    if (chatIndex > 0) {
      await new Promise((r) => setTimeout(r, INTER_CHAT_DELAY_MS));
    }
    chatIndex++;
    let state = initialState;

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

    // Какие шаги уже отправлены В ТЕКУЩЕЙ СЕССИИ (после session_started_at).
    // Старый лог не удаляется, но и не учитывается при сбросе сессии.
    const sessionStart = state.session_started_at ?? state.chain_started_at ?? state.created_at;
    let sentQuery = sb
      .from("avito_message_log")
      .select("step_id")
      .eq("chat_id", state.chat_id)
      .eq("status", "sent");
    if (sessionStart) sentQuery = sentQuery.gte("sent_at", sessionStart);
    const { data: sentRows } = await sentQuery;
    const sentSet = new Set(
      (sentRows ?? []).map((r: any) => r.step_id).filter(Boolean),
    );

    // Последние N клиентских сообщений ТЕКУЩЕЙ сессии.
    let inQuery = sb
      .from("avito_message_log")
      .select("text")
      .eq("chat_id", state.chat_id)
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
      const res = await sendChatMessage(selfId, state.chat_id, text);
      const status = res.ok ? "sent" : "error";
      await sb.from("avito_message_log").insert({
        chat_id: state.chat_id,
        item_id: state.item_id,
        chain_id: state.chain_id,
        step_id: step.id,
        step_index: step.order_index,
        text,
        status,
        error: res.ok ? null : `${res.status}: ${res.body}`,
      });
      if (res.ok) {
        sentSet.add(step.id);
        await sb.from("avito_chat_state").update({
          last_auto_sent_at: new Date().toISOString(),
        }).eq("id", state.id);
      }
      results.push({ chat: state.chat_id, step: step.order_index, status });
      return res.ok;
    };

    // --- Phase A: keyword-шаги (любой порядок, по совпадению).
    // Перед ними — приветствие (если есть и ещё не отправлено в этой сессии).
    if (clientHaystack) {
      const matchedKeywordSteps = steps.filter((step: any) =>
        step.keyword_triggers && step.keyword_triggers.length > 0 &&
        !sentSet.has(step.id) &&
        step.keyword_triggers.some((kw: string) =>
          clientHaystack.includes(String(kw).toLowerCase())
        )
      );
      if (matchedKeywordSteps.length > 0) {
        const greeting = steps.find((s: any) => s.is_greeting && !sentSet.has(s.id));
        const toSend = greeting ? [greeting, ...matchedKeywordSteps] : matchedKeywordSteps;
        for (const step of toSend) {
          const ok = await sendStep(step);
          if (!ok) {
            await sb.from("avito_chat_state").update({
              next_run_at: new Date(Date.now() + 10 * 60_000).toISOString(),
            }).eq("id", state.id);
            break;
          }
          await new Promise((r) => setTimeout(r, INTER_MSG_DELAY_MS));
        }
      }
    }

    // --- Phase B: sequential шаги по current_step (только non-keyword).
    let cursor = state.current_step ?? 0;
    let nextRunAt: string | null = null;
    let completed = false;

    while (true) {
      const step = steps[cursor];
      if (!step) {
        completed = true;
        break;
      }
      // Пропускаем уже отправленные (включая те, что ушли в Phase A).
      if (sentSet.has(step.id)) {
        cursor++;
        continue;
      }
      // Keyword-шаги и приветствие обрабатываются Phase A — не блокируем sequence.
      if (
        step.is_greeting ||
        (step.keyword_triggers && step.keyword_triggers.length > 0)
      ) {
        cursor++;
        continue;
      }
      // Sequential шаг: проверяем время. Первый sequential шаг отправляем сразу
      // (ему уже было выставлено next_run_at при создании chat_state).
      const ok = await sendStep(step);
      if (!ok) {
        await sb.from("avito_chat_state").update({
          current_step: cursor,
          next_run_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        }).eq("id", state.id);
        nextRunAt = "_handled_";
        break;
      }
      cursor++;
      // Если следующий шаг — sequential с задержкой, планируем next_run_at.
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
        // delay 0 → шлём в этом же цикле, после небольшой паузы.
        await new Promise((r) => setTimeout(r, INTER_MSG_DELAY_MS));
        continue;
      }
      // Дальше только keyword-шаги или конец цепочки — выходим.
      break;
    }

    if (nextRunAt === "_handled_") {
      continue; // ошибка отправки уже зафиксирована
    }

    // Все ли шаги цепочки уже отправлены?
    const allSent = steps.every((s: any) => sentSet.has(s.id));
    const patch: Record<string, unknown> = { current_step: cursor };
    if (completed || allSent) {
      patch.chain_completed_at = new Date().toISOString();
      patch.next_run_at = null;
    } else {
      // Если есть запланированный sequential — ждём его, иначе спим до
      // следующего клиентского сообщения (webhook поднимет next_run_at).
      patch.next_run_at = nextRunAt;
    }
    await sb.from("avito_chat_state").update(patch).eq("id", state.id);
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
