import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateOccupancy } from "@/lib/occupancyCache";
import { resetOccupancyPrefetch } from "@/lib/prefetch";
import { normalizeBooking } from "@/lib/bookingNormalize";
import type { Booking, BookingFormData } from "@/lib/types";
import { useEffect, useState } from "react";

/**
 * Two-phase loading:
 *  Phase 1 — public_bookings_view (no auth wait) → instant occupancy colors.
 *  Phase 2 — bookings (after auth)               → full data (PII, prices, services).
 *
 * Both phases produce Booking[] via the same normalizeBooking, so swapping
 * Phase 1 → Phase 2 is visually seamless (same ids, same occupancy fields).
 */
export function useBookings() {
  const queryClient = useQueryClient();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setAuthReady(true);
          queryClient.invalidateQueries({ queryKey: ["bookings", "full"] });
        } else {
          setAuthReady(false);
        }
      }
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  // Phase 1 — fires immediately, no auth required, very small payload
  const phase1 = useQuery({
    queryKey: ["bookings", "occupancy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_bookings_view")
        .select("*");
      if (error) throw error;
      return (data ?? []).map(normalizeBooking);
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  // Phase 2 — full data, gated on auth
  const phase2 = useQuery({
    queryKey: ["bookings", "full", authReady],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [] as Booking[];
      const { data, error } = await supabase
        .from("bookings")
        .select("*, houses(*)")
        .order("check_in");
      if (error) throw error;
      return (data ?? []).map(normalizeBooking);
    },
    enabled: authReady,
    staleTime: 0,
    refetchOnMount: true,
  });

  // Realtime: invalidate both phases + guest cache
  useEffect(() => {
    const channel = supabase
      .channel("bookings-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          invalidateOccupancy();
          resetOccupancyPrefetch();
          queryClient.invalidateQueries({ queryKey: ["bookings", "occupancy"] });
          queryClient.invalidateQueries({ queryKey: ["bookings", "full"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Phase 2 wins when present; otherwise Phase 1 paints the colors.
  const data: Booking[] = phase2.data ?? phase1.data ?? [];
  const hasPhase2 = phase2.data !== undefined;
  const isLoading = !phase1.data && !phase2.data && (phase1.isLoading || phase2.isLoading);
  const isRefreshing = !!phase1.data && !hasPhase2 && authReady;

  return {
    data,
    isLoading,
    isRefreshing,
    hasFullData: hasPhase2,
    error: phase2.error ?? phase1.error,
  };
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BookingFormData) => {
      const { data: user } = await supabase.auth.getUser();
      const payload = { ...data, created_by: user.user?.id || null };
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await supabase.from("bookings").insert(payload);
        if (!error) return;
        lastError = new Error(error.message);
        if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
      throw lastError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: BookingFormData & { id: string }) => {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await supabase
          .from("bookings")
          .update(data)
          .eq("id", id);
        if (!error) return;
        lastError = new Error(error.message);
        if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
      throw lastError;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: booking } = await supabase
        .from("bookings")
        .select("synced_from")
        .eq("id", id)
        .single();
      const updateData: any = { cancelled: true };
      if (booking?.synced_from === "avito") {
        updateData.manual_override = true;
      }
      const { error } = await supabase
        .from("bookings")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useRestoreBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bookings")
        .update({ cancelled: false, manual_override: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useDeleteBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bookings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });
}
