import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { House } from "@/lib/types";
import { readCache, writeCache } from "@/lib/persistCache";

const CACHE_KEY = "houses";

export function useHouses() {
  return useQuery({
    queryKey: ["houses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("houses")
        .select("*")
        .order("name");
      if (error) throw error;
      const houses = data as House[];
      writeCache(CACHE_KEY, houses);
      return houses;
    },
    initialData: () => readCache<House[]>(CACHE_KEY) ?? undefined,
    staleTime: 60_000,
  });
}
