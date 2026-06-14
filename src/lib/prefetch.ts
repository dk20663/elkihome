import { supabase } from "@/integrations/supabase/client";
import { writeOccupancy } from "./occupancyCache";
import { normalizeBooking } from "./bookingNormalize";
import type { Booking } from "./types";

// Lazy occupancy prefetch — triggered explicitly by GuestView, NOT on app boot.
let _occupancyPromise: Promise<Booking[]> | null = null;

/** Minimal column set needed to render occupancy. */
const OCCUPANCY_COLUMNS =
  "id,house_id,house_name,check_in,check_out,cancelled";

export function startOccupancyPrefetch(): Promise<Booking[]> {
  if (_occupancyPromise) return _occupancyPromise;
  _occupancyPromise = (async () => {
    try {
      // Only fetch future / current bookings — drop historical data.
      // Use a small back-window (yesterday) to be safe against TZ edge cases.
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 1);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("public_bookings_view")
        .select(OCCUPANCY_COLUMNS)
        .eq("cancelled", false)
        .gte("check_out", cutoffStr);

      if (error || !data) return [];
      return data.map(normalizeBooking);
    } catch {
      return [];
    }
  })();
  // Write cache after resolve (fire-and-forget so callers aren't blocked).
  _occupancyPromise.then((b) => {
    if (b.length) writeOccupancy(b);
  });
  return _occupancyPromise;
}

/** Reset so the next call refetches fresh data */
export function resetOccupancyPrefetch() {
  _occupancyPromise = null;
}
