import type { Booking } from "./types";

/**
 * Single source of truth for converting raw DB rows into a Booking.
 * Used for both phases (public_bookings_view and full bookings) and
 * by the guest prefetch — guarantees consistent occupancy fields.
 */
export function normalizeBooking(raw: any): Booking {
  return {
    id: raw.id,
    house_id: raw.house_id,
    check_in: raw.check_in,
    check_out: raw.check_out,
    cancelled: raw.cancelled ?? false,
    synced_from: raw.synced_from ?? null,
    // Fields below are placeholders for Phase 1 / public view.
    // Phase 2 fills them with real values (same id → seamless replace).
    guest_name: raw.guest_name ?? "",
    guest_phone: raw.guest_phone ?? "",
    comment: raw.comment ?? "",
    source: raw.source ?? "",
    guest_count: raw.guest_count ?? 0,
    sauna: raw.sauna ?? false,
    plunge_pool: raw.plunge_pool ?? false,
    bath_brooms: raw.bath_brooms ?? false,
    fir_infusion: raw.fir_infusion ?? false,
    citrus_infusion: raw.citrus_infusion ?? false,
    total_price: raw.total_price ?? 0,
    manual_override: (raw as any).manual_override ?? false,
    external_uid: raw.external_uid ?? null,
    created_by: raw.created_by ?? null,
    created_at: raw.created_at ?? "",
    updated_at: raw.updated_at ?? "",
    houses: raw.houses ?? undefined,
  } as Booking;
}
