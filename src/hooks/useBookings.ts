import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Booking, BookingFormData } from "@/lib/types";
import { useEffect, useState } from "react";

export function useBookings() {
  const queryClient = useQueryClient();
  const [authReady, setAuthReady] = useState(false);

  // Listen for auth state changes to know when session is available
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          setAuthReady(true);
          queryClient.invalidateQueries({ queryKey: ["bookings"] });
        } else {
          setAuthReady(false);
        }
      }
    );

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const query = useQuery({
    queryKey: ["bookings", authReady],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data, error } = await supabase
        .from("bookings")
        .select("*, houses(*)")
        .order("check_in");
      if (error) throw error;
      return data as Booking[];
    },
    enabled: authReady,
    refetchOnMount: true,
    staleTime: 0,
  });

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
      const payload = {
        ...data,
        created_by: user.user?.id || null,
      };
      // Retry up to 3 times on transient failures
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await supabase.from("bookings").insert(payload);
        if (!error) return;
        lastError = new Error(error.message);
        if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
      throw lastError;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
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
      const { error } = await supabase
        .from("bookings")
        .update({ cancelled: true })
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
        .update({ cancelled: false })
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
