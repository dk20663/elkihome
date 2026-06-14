import { supabase } from "@/integrations/supabase/client";
import { writeOccupancy } from "./occupancyCache";
import { normalizeBooking } from "./bookingNormalize";
import type { Booking } from "./types";

// Lazy occupancy prefetch — triggered explicitly by GuestView, NOT on app boot.
let _occupancyPromise: Promise<Booking[]> | null = null;

/** Минимальный набор колонок для расчёта занятости. */
const OCCUPANCY_COLUMNS = "id,house_id,house_name,check_in,check_out,cancelled";

const REQUEST_TIMEOUT_MS = 6000;
const MAX_ATTEMPTS = 3;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

async function fetchOnce(): Promise<Booking[] | null> {
  // Только будущие/текущие брони — отсекаем историю.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  try {
    const { data, error } = await withTimeout(
      supabase
        .from("public_bookings_view")
        .select(OCCUPANCY_COLUMNS)
        .eq("cancelled", false)
        .gte("check_out", cutoffStr) as unknown as Promise<{ data: any[] | null; error: any }>,
      REQUEST_TIMEOUT_MS,
    );
    if (error || !data) return null;
    return data.map(normalizeBooking);
  } catch {
    return null;
  }
}

export function startOccupancyPrefetch(): Promise<Booking[]> {
  if (_occupancyPromise) return _occupancyPromise;
  _occupancyPromise = (async () => {
    // Несколько попыток с экспоненциальным бэкоффом — важно для нестабильных
    // соединений из РФ (Cloudflare workers.dev и Supabase часто отвечают
    // первым TLS-handshake'ом, но «висят» при передаче тела).
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const result = await fetchOnce();
      if (result && result.length) {
        writeOccupancy(result);
        return result;
      }
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
    return [];
  })();
  return _occupancyPromise;
}

/** Reset so the next call refetches fresh data */
export function resetOccupancyPrefetch() {
  _occupancyPromise = null;
}
