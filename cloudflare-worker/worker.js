/**
 * Cloudflare Worker — прокси Supabase для embed-виджета elkihome24.ru
 *
 * Зачем: домен *.supabase.co заблокирован Роскомнадзором, поэтому из РФ
 * без VPN календарь на Тильде висит на запросах данных. Worker отдаёт
 * те же ответы со своего домена (workers.dev или своего поддомена),
 * который не заблокирован.
 *
 * Поддерживает:
 *   - REST     (/rest/v1/*)       — чтение броней, цен, домов, запись визитов
 *   - Auth     (/auth/v1/*)       — на случай будущей админ-авторизации
 *   - Realtime (/realtime/v1/*)
 *   - Storage  (/storage/v1/*)
 *
 * Деплой см. README.md рядом.
 */

const TARGET = "https://hpfurpylorcuvcoevpsl.supabase.co";

/**
 * Базовые CORS-заголовки. Allow-Headers формируется динамически из
 * Access-Control-Request-Headers, чтобы покрыть всё, что присылает
 * supabase-js (apikey, authorization, accept-profile, content-profile,
 * x-client-info, x-supabase-api-version, prefer, range и т.п.) —
 * включая будущие заголовки без правок воркера.
 */
function corsHeaders(request) {
  const reqHeaders =
    request.headers.get("Access-Control-Request-Headers") ||
    "authorization, apikey, content-type, accept-profile, content-profile, x-client-info, x-supabase-api-version, prefer, range";
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Expose-Headers": "content-range, content-length, range",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin, Access-Control-Request-Headers",
  };
}

export default {
  async fetch(request) {
    const cors = corsHeaders(request);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
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
        { status: 502, headers: { ...cors, "content-type": "application/json" } }
      );
    }

    // Возвращаем ответ как есть + добавляем CORS-заголовки.
    // Удаляем Set-Cookie с Domain=supabase.co — он бесполезен на чужом домене
    // и иногда триггерит предупреждения в браузере.
    const respHeaders = new Headers(response.headers);
    respHeaders.delete("set-cookie");
    for (const [k, v] of Object.entries(cors)) respHeaders.set(k, v);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
  },
};
