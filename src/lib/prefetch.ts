import { supabase } from "@/integrations/supabase/client";
import { writeOccupancy } from "./occupancyCache";
import type { Booking } from "./types";

// Fire occupancy fetch immediately on module import — before React mounts.
// This shaves 100-200ms off perceived load time for guest view.
export const occupancyPromise: Promise<Booking[]> = (async () => {
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
