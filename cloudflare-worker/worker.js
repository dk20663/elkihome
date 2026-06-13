/**
 * Cloudflare Worker — прокси Supabase для embed-виджета elkihome24.ru
 *
 * Зачем: домен *.supabase.co заблокирован Роскомнадзором, поэтому из РФ
 * без VPN календарь на Тильде висит на запросах данных. Worker отдаёт
 * те же ответы со своего домена (workers.dev или своего поддомена),
 * который не заблокирован.
 *
 * Поддерживает:
 *   - REST    (/rest/v1/*)         — чтение броней, цен, домов, запись визитов
 *   - Auth    (/auth/v1/*)         — на случай будущей админ-авторизации
 *   - Realtime (/realtime/v1/*)    — WebSocket, проксируется как есть
 *   - Storage (/storage/v1/*)
 *
 * Деплой см. README.md рядом.
 */

const TARGET = "https://hpfurpylorcuvcoevpsl.supabase.co";

// CORS — виджет грузится с другого домена (cdn.jsdelivr / github.io / tilda)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, prefer, range, x-supabase-api-version",
  "Access-Control-Expose-Headers": "content-range, content-length, range",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const targetUrl = TARGET + url.pathname + url.search;

    // Копируем заголовки, удаляя host/cf-* — иначе апстрим может ругаться
    const headers = new Headers(request.headers);
    headers.delete("host");
    for (const k of [...headers.keys()]) {
      if (k.toLowerCase().startsWith("cf-")) headers.delete(k);
    }

    const init = {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    };

    let response;
    try {
      response = await fetch(targetUrl, init);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "upstream_unreachable", message: String(err) }),
        { status: 502, headers: { ...CORS, "content-type": "application/json" } }
      );
    }

    // Возвращаем ответ как есть + добавляем CORS-заголовки
    const respHeaders = new Headers(response.headers);
    for (const [k, v] of Object.entries(CORS)) respHeaders.set(k, v);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
  },
};
