import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Booking, BookingFormData } from "@/lib/types";
import { useEffect } from "react";

export function useBookings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, houses(*)")
        .order("check_in");
      if (error) throw error;
      return data as Booking[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("bookings-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["bookings"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BookingFormData) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("bookings").insert({
        ...data,
        created_by: user.user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: BookingFormData & { id: string }) => {
      const { error } = await supabase
        .from("bookings")
        .update(data)
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
      const { error } = await supabase.from("bookings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });
}
