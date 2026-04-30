import { supabase } from "@/integrations/supabase/client";
import { writeOccupancy } from "./occupancyCache";
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
      if (error || !data) return [];
      const bookings = data.map((b: any) => ({
        ...b,
        guest_name: "",
        guest_phone: "",
        comment: "",
        source: "",
        guest_count: 0,
        sauna: false,
        plunge_pool: false,
        bath_brooms: false,
        fir_infusion: false,
        citrus_infusion: false,
        created_by: null,
        created_at: "",
        updated_at: "",
      })) as Booking[];
      writeOccupancy(bookings);
      return bookings;
    } catch {
      return [];
    }
  })();
  return _occupancyPromise;
}

/** Reset so the next call refetches fresh data */
export function resetOccupancyPrefetch() {
  _occupancyPromise = null;
}
