import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Copy, Check } from "lucide-react";
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
      guest_comment: h.guest_comment ?? "",
      sutochno_ical_url: h.sutochno_ical_url ?? "",
    }))
  );
  const [saving, setSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "";
  const icalUrl = (house: string) =>
    `${supabaseUrl}/functions/v1/export-ical?house=${house}`;

  const copyUrl = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      toast.success("Ссылка скопирована");
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const updateField = (
    id: string,
    field: "weekday" | "weekend" | "guest_comment" | "sutochno_ical_url",
    value: number | string
  ) => {
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
            guest_comment: p.guest_comment,
            sutochno_ical_url: p.sutochno_ical_url.trim(),
          })
          .eq("id", p.id);
        if (error) throw error;
      }
      toast.success("Сохранено");
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
                  onChange={(e) => updateField(p.id, "weekday", Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Выходные (Пт-Вс), ₽</Label>
                <Input
                  type="number"
                  value={p.weekend}
                  onChange={(e) => updateField(p.id, "weekend", Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Комментарий для гостя (виден при просмотре даты)
              </Label>
              <Textarea
                value={p.guest_comment}
                onChange={(e) => updateField(p.id, "guest_comment", e.target.value)}
                placeholder="Например: В стоимость включён бассейн"
                className="mt-1 min-h-[60px]"
                maxLength={300}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Оставьте пустым, чтобы скрыть комментарий
              </p>
            </div>
          </div>
        ))}
      </div>

      <Button className="mt-6 w-full" onClick={handleSave} disabled={saving}>
        {saving ? "Сохранение..." : "Сохранить"}
      </Button>

      <div className="mt-8 rounded-2xl bg-card p-4 border border-border/50 space-y-3">
        <div>
          <h2 className="font-semibold text-sm">Синхронизация календарей (iCal)</h2>
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
            Ваш календарь — единый источник данных. Вставьте эти ссылки в импорт календаря
            на Авито, Циан и Суточно.ру — все ручные блокировки и брони появятся на всех
            площадках автоматически (обновление 10–60 мин).
          </p>
        </div>

        {[
          { house: "green", label: "Дом GREEN", dot: "bg-house-green" },
          { house: "black", label: "Дом BLACK", dot: "bg-house-black" },
        ].map(({ house, label, dot }) => {
          const url = icalUrl(house);
          const isCopied = copiedKey === house;
          return (
            <div key={house} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${dot}`} />
                <span className="text-xs font-medium">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="text-[11px] font-mono h-9"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 shrink-0"
                  onClick={() => copyUrl(house, url)}
                  aria-label="Скопировать ссылку"
                >
                  {isCopied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          );
        })}

        <div className="text-[11px] text-muted-foreground leading-snug pt-1 border-t border-border/40">
          <p className="font-medium text-foreground/80 mb-1">Куда вставлять:</p>
          <ul className="space-y-0.5 list-disc pl-4">
            <li>Авито — Личный кабинет → Календарь → Синхронизация → Импорт iCal</li>
            <li>Циан — Объявление → Календарь → Синхронизация календарей → Добавить ссылку</li>
            <li>Суточно.ру — Объект → Календарь → iCal-синхронизация → Импорт</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
