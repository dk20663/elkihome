import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import type { House } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  houses: House[];
  onClose: () => void;
}

export default function PriceSettings({ houses, onClose }: Props) {
  const queryClient = useQueryClient();
  const [prices, setPrices] = useState(
    houses.map((h) => ({
      id: h.id,
      name: h.name,
      weekday: h.base_price_weekday,
      weekend: h.base_price_weekend,
    }))
  );
  const [saving, setSaving] = useState(false);

  const updatePrice = (id: string, field: "weekday" | "weekend", value: number) => {
    setPrices((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const p of prices) {
        const { error } = await supabase
          .from("houses")
          .update({
            base_price_weekday: p.weekday,
            base_price_weekend: p.weekend,
          })
          .eq("id", p.id);
        if (error) throw error;
      }
      toast.success("Цены обновлены");
      await queryClient.invalidateQueries({ queryKey: ["houses"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto flex flex-col p-4">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">Настройки цен</h1>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Будни: Пн — Чт · Выходные: Пт — Вс
      </p>

      <div className="space-y-6">
        {prices.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl bg-card p-4 border border-border/50 space-y-3"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full ${
                  p.name === "GREEN" ? "bg-house-green" : "bg-house-black"
                }`}
              />
              <span className="font-semibold text-sm">Дом {p.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Будни (Пн-Чт), ₽</Label>
                <Input
                  type="number"
                  value={p.weekday}
                  onChange={(e) => updatePrice(p.id, "weekday", Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Выходные (Пт-Вс), ₽</Label>
                <Input
                  type="number"
                  value={p.weekend}
                  onChange={(e) => updatePrice(p.id, "weekend", Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button className="mt-6 w-full" onClick={handleSave} disabled={saving}>
        {saving ? "Сохранение..." : "Сохранить"}
      </Button>
    </div>
  );
}
