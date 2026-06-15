import type { Booking, House, HousePricing } from "./types";
import { normalizeBooking } from "./bookingNormalize";

export interface Snapshot {
  version: number;
  generated_at: string;
  cutoff: string;
  houses: House[];
  bookings: Booking[];
  pricing: HousePricing[];
}

const SNAPSHOT_CACHE_KEY = "elkihome_snapshot_v1";
const FRESH_MS = 5 * 60 * 1000;
const STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней — лучше старые данные, чем пустой экран

interface CacheEntry {
  ts: number;
  data: Snapshot;
}

export function readCachedSnapshot(): { data: Snapshot; isFresh: boolean } | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed?.data?.houses) return null;
    const age = Date.now() - parsed.ts;
    if (age > STALE_MS) return null;
    return { data: parsed.data, isFresh: age <= FRESH_MS };
  } catch {
    return null;
  }
}

function writeCachedSnapshot(data: Snapshot) {
  try {
    localStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    /* ignore quota */
  }
}

/**
 * Загружает статический снапшот, опубликованный GitHub Action.
 * Файл лежит рядом с embed.html, поэтому подгружается с того же CDN
 * (jsDelivr) — без обращений к Supabase / Worker из браузера.
 *
 * Cache-busting: добавляем дату с округлением до минуты, чтобы CDN
 * мог кэшировать, но новые данные подхватывались быстро.
 */
async function fetchOnce(): Promise<Snapshot | null> {
  const bust = Math.floor(Date.now() / 60000); // меняется раз в минуту
  const candidates = [
    `./data/snapshot.json?v=${bust}`,
    `data/snapshot.json?v=${bust}`,
  ];
  for (const url of candidates) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal, cache: "default" });
      clearTimeout(t);
      if (!res.ok) continue;
      // Защита от SPA-фолбэка: на lovable.app несуществующий путь отдаёт
      // index.html со статусом 200. Принимаем ответ только если это JSON.
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("json") && !ct.includes("text/plain")) continue;
      const text = await res.text();
      if (!text.trim().startsWith("{")) continue;
      const json = JSON.parse(text) as Snapshot;
      if (!json?.houses || !Array.isArray(json.houses)) continue;
      return {
        ...json,
        bookings: (json.bookings || []).map(normalizeBooking),
      };
    } catch {
      /* try next */
    }
  }
  return null;
}

async function fetchFromSupabase(): Promise<Snapshot | null> {
  // Фолбэк для основного Lovable-домена, где нет статического snapshot.json.
  // Embed-виджет сюда не попадает — у него снапшот лежит рядом с HTML.
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const [housesRes, bookingsRes, pricingRes] = await Promise.all([
      supabase.from("houses").select("*").order("name", { ascending: true }),
      supabase
        .from("public_bookings_view")
        .select("id,house_id,house_name,check_in,check_out,cancelled")
        .eq("cancelled", false)
        .gte("check_out", cutoffStr),
      supabase.from("house_pricing").select("*").gte("date", cutoffStr),
    ]);

    if (housesRes.error || bookingsRes.error) return null;

    return {
      version: 1,
      generated_at: new Date().toISOString(),
      cutoff: cutoffStr,
      houses: (housesRes.data ?? []) as House[],
      bookings: ((bookingsRes.data ?? []) as any[]).map(normalizeBooking),
      pricing: (pricingRes.data ?? []) as HousePricing[],
    };
  } catch {
    return null;
  }
}

let _promise: Promise<Snapshot | null> | null = null;

export function loadSnapshot(): Promise<Snapshot | null> {
  if (_promise) return _promise;
  _promise = (async () => {
    // 1) Сначала пробуем статический снапшот (embed на jsDelivr / Tilda).
    for (let attempt = 1; attempt <= 2; attempt++) {
      const fresh = await fetchOnce();
      if (fresh) {
        writeCachedSnapshot(fresh);
        return fresh;
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 300));
    }
    // 2) Фолбэк: читаем напрямую из Supabase (основной Lovable-домен,
    //    где snapshot.json физически отсутствует).
    const live = await fetchFromSupabase();
    if (live) {
      writeCachedSnapshot(live);
      return live;
    }
    return null;
  })();
  return _promise;
}
