import { useState, useMemo } from "react";
import { format, eachDayOfInterval, getDay } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { House, HousePricing } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Props {
  houses: House[];
  dateRange: { start: Date; end: Date | null };
  onClose: () => void;
}

export default function DatePriceEditor({ houses, dateRange, onClose }: Props) {
  const queryClient = useQueryClient();
  const dates = useMemo(() => {
    const end = dateRange.end || dateRange.start;
    return eachDayOfInterval({ start: dateRange.start, end });
  }, [dateRange]);

  const dateStrings = useMemo(() => dates.map((d) => format(d, "yyyy-MM-dd")), [dates]);

  const { data: existingPricing = [] } = useQuery({
    queryKey: ["house_pricing", dateStrings],
    queryFn: async () => {
      const { data } = await supabase
        .from("house_pricing")
        .select("*")
        .in("date", dateStrings);
      return (data || []) as HousePricing[];
    },
  });

  const [prices, setPrices] = useState<Record<string, Record<string, number>>>({});
  const [saving, setSaving] = useState(false);

  const getPrice = (houseId: string, dateStr: string, house: House) => {
    if (prices[houseId]?.[dateStr] !== undefined) return prices[houseId][dateStr];
    const existing = existingPricing.find((p) => p.house_id === houseId && p.date === dateStr);
    if (existing) return existing.price;
    const d = new Date(dateStr);
    const day = getDay(d);
    const isWeekday = day >= 1 && day <= 4;
    return isWeekday ? house.base_price_weekday : house.base_price_weekend;
  };

  const setPrice = (houseId: string, dateStr: string, value: number) => {
    setPrices((prev) => ({
      ...prev,
      [houseId]: { ...(prev[houseId] || {}), [dateStr]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const houseId of Object.keys(prices)) {
        for (const [dateStr, price] of Object.entries(prices[houseId])) {
          const existing = existingPricing.find((p) => p.house_id === houseId && p.date === dateStr);
          if (existing) {
            await supabase.from("house_pricing").update({ price }).eq("id", existing.id);
          } else {
            await supabase.from("house_pricing").insert({ house_id: houseId, date: dateStr, price });
          }
        }
      }
      toast.success("Цены обновлены");
      queryClient.invalidateQueries({ queryKey: ["house_pricing"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const label = dateRange.end
    ? `${format(dateRange.start, "d MMM", { locale: ru })} — ${format(dateRange.end, "d MMM", { locale: ru })}`
    : format(dateRange.start, "d MMMM yyyy", { locale: ru });

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto flex flex-col p-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Редактирование цен</h1>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        {dates.map((date) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const dayLabel = format(date, "EEEEEE, d MMM", { locale: ru });
          return (
            <div key={dateStr} className="rounded-2xl bg-card p-3 border border-border/50 space-y-2">
              <p className="text-sm font-semibold capitalize">{dayLabel}</p>
              <div className="grid grid-cols-2 gap-2">
                {houses.map((house) => (
                  <div key={house.id}>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className={`h-2 w-2 rounded-full ${house.name === "GREEN" ? "bg-house-green" : "bg-house-black"}`} />
                      {house.name}
                    </Label>
                    <Input
                      type="number"
                      value={getPrice(house.id, dateStr, house)}
                      onChange={(e) => setPrice(house.id, dateStr, Number(e.target.value))}
                      className="mt-1 h-9"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Button className="mt-4 w-full" onClick={handleSave} disabled={saving}>
        {saving ? "Сохранение..." : "Сохранить"}
      </Button>
    </div>
  );
}
