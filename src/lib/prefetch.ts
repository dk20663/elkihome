import { supabase } from "@/integrations/supabase/client";
import { writeOccupancy } from "./occupancyCache";
import { normalizeBooking } from "./bookingNormalize";
import type { Booking } from "./types";

// Lazy occupancy prefetch — triggered explicitly by GuestView, NOT on app boot.
// Admin sessions never call this, so no extra network or cache writes happen.
let _occupancyPromise: Promise<Booking[]> | null = null;

export function startOccupancyPrefetch(): Promise<Booking[]> {
  if (_occupancyPromise) return _occupancyPromise;
  _occupancyPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("public_bookings_view")
        .select("*");
      // eslint-disable-next-line no-console
      console.log("[ElkiHome] public_bookings_view →", {
        error,
        count: data?.length ?? 0,
        first5: (data ?? []).slice(0, 5),
      });
      if (error || !data) return [];
      const bookings = data.map(normalizeBooking);
      // eslint-disable-next-line no-console
      console.log("[ElkiHome] normalized bookings →", {
        count: bookings.length,
        first: bookings[0],
      });
      writeOccupancy(bookings);
      return bookings;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[ElkiHome] prefetch failed:", e);
      return [];
    }
  })();
  return _occupancyPromise;
}

/** Reset so the next call refetches fresh data */
export function resetOccupancyPrefetch() {
  _occupancyPromise = null;
}
