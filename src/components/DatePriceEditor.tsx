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

  // One price per house for the whole period
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const getDefaultPrice = (house: House) => {
    // Show existing custom price if all dates have the same one, otherwise show base price
    const housePrices = existingPricing.filter((p) => p.house_id === house.id);
    if (housePrices.length === dateStrings.length && housePrices.length > 0) {
      const allSame = housePrices.every((p) => p.price === housePrices[0].price);
      if (allSame) return housePrices[0].price;
    }
    // Use first date to determine weekday/weekend
    const d = dates[0];
    const day = getDay(d);
    const isWeekday = day >= 1 && day <= 4;
    return isWeekday ? house.base_price_weekday : house.base_price_weekend;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const house of houses) {
        const priceStr = prices[house.id];
        if (priceStr === undefined || priceStr === "") continue;
        const price = Number(priceStr);
        if (isNaN(price)) continue;

        for (const dateStr of dateStrings) {
          const existing = existingPricing.find((p) => p.house_id === house.id && p.date === dateStr);
          if (existing) {
            await supabase.from("house_pricing").update({ price }).eq("id", existing.id);
          } else {
            await supabase.from("house_pricing").insert({ house_id: house.id, date: dateStr, price });
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

  const periodInfo = dates.length > 1 ? `${dates.length} дн.` : null;

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto flex flex-col p-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Редактирование цен</h1>
          <p className="text-xs text-muted-foreground">{label}{periodInfo && ` · ${periodInfo}`}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-4 border border-border/50 space-y-4">
        <p className="text-sm text-muted-foreground">
          {dates.length > 1
            ? "Установите цену для всего периода. Она применится к каждому дню."
            : "Установите цену на эту дату."}
        </p>
        <div className="space-y-3">
          {houses.map((house) => (
            <div key={house.id}>
              <Label className="text-sm font-medium flex items-center gap-2 mb-1">
                <span className={`h-2.5 w-2.5 rounded-full ${house.name === "GREEN" ? "bg-house-green" : "bg-house-black"}`} />
                Дом {house.name}
              </Label>
              <Input
                type="number"
                placeholder={String(getDefaultPrice(house))}
                value={prices[house.id] ?? ""}
                onChange={(e) => setPrices((prev) => ({ ...prev, [house.id]: e.target.value }))}
                className="h-10"
              />
            </div>
          ))}
        </div>
      </div>

      <Button className="mt-4 w-full" onClick={handleSave} disabled={saving}>
        {saving ? "Сохранение..." : "Сохранить"}
      </Button>
    </div>
  );
}
