import { useState, useEffect } from "react";
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

const REPORT_FIELDS: { key: keyof ReportSettingsState; label: string; hint?: string }[] = [
  { key: "salary_green", label: "З/П за бронь, GREEN (₽)" },
  { key: "salary_black", label: "З/П за бронь, BLACK (₽)" },
  { key: "salary_sauna_bonus", label: "Доплата за баню (₽)" },
  { key: "salary_pool_bonus", label: "Доплата за купель (₽)" },
  { key: "laundry_per_guest", label: "Прачечная за гостя (₽)" },
  { key: "electricity_green", label: "Электричество GREEN / мес (₽)" },
  { key: "electricity_black", label: "Электричество BLACK / мес (₽)" },
  { key: "firewood_per_pool", label: "Дрова за 1 купель (₽)" },
  { key: "water_delivery_price", label: "Доставка воды, 1 привоз (₽)" },
  { key: "pools_per_delivery", label: "Купелей на 1 привоз (шт)" },
];

type ReportSettingsState = {
  salary_green: number;
  salary_black: number;
  salary_sauna_bonus: number;
  salary_pool_bonus: number;
  laundry_per_guest: number;
  electricity_green: number;
  electricity_black: number;
  water_delivery_price: number;
  pools_per_delivery: number;
  firewood_per_pool: number;
};

const DEFAULT_REPORT_SETTINGS: ReportSettingsState = {
  salary_green: 2250,
  salary_black: 2650,
  salary_sauna_bonus: 250,
  salary_pool_bonus: 500,
  laundry_per_guest: 500,
  electricity_green: 5000,
  electricity_black: 20000,
  water_delivery_price: 5500,
  pools_per_delivery: 4,
  firewood_per_pool: 1500,
};

export default function PriceSettings({ houses, onClose }: Props) {
  const queryClient = useQueryClient();
  const [prices, setPrices] = useState(
    houses.map((h) => ({
      id: h.id,
      name: h.name,
      weekday: h.base_price_weekday,
      weekend: h.base_price_weekend,
      sauna_price: h.sauna_price ?? 5000,
      plunge_pool_price: h.plunge_pool_price ?? 5000,
      guest_comment: h.guest_comment ?? "",
      sutochno_ical_url: h.sutochno_ical_url ?? "",
      cian_ical_url: h.cian_ical_url ?? "",
    }))
  );
  const [reportSettings, setReportSettings] = useState<ReportSettingsState>(DEFAULT_REPORT_SETTINGS);
  const [reportLoading, setReportLoading] = useState(true);
  const [savingReport, setSavingReport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("report_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (data) {
        setReportSettings({
          salary_green: Number(data.salary_green),
          salary_black: Number(data.salary_black),
          salary_sauna_bonus: Number(data.salary_sauna_bonus),
          salary_pool_bonus: Number(data.salary_pool_bonus),
          laundry_per_guest: Number(data.laundry_per_guest),
          electricity_green: Number(data.electricity_green),
          electricity_black: Number(data.electricity_black),
          water_delivery_price: Number(data.water_delivery_price),
          pools_per_delivery: Number(data.pools_per_delivery),
          firewood_per_pool: Number(data.firewood_per_pool),
        });
      }
      setReportLoading(false);
    })();
  }, []);

  const saveReportSettings = async () => {
    setSavingReport(true);
    try {
      const { error } = await (supabase as any)
        .from("report_settings")
        .upsert({ id: true, ...reportSettings });
      if (error) throw error;
      toast.success("Настройки отчёта сохранены");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingReport(false);
    }
  };

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
    field: "weekday" | "weekend" | "sauna_price" | "plunge_pool_price" | "guest_comment" | "sutochno_ical_url" | "cian_ical_url",
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
            sauna_price: p.sauna_price,
            plunge_pool_price: p.plunge_pool_price,
            guest_comment: p.guest_comment,
            sutochno_ical_url: p.sutochno_ical_url.trim(),
            cian_ical_url: p.cian_ical_url.trim(),
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Баня, ₽</Label>
                <Input
                  type="number"
                  value={p.sauna_price}
                  onChange={(e) => updateField(p.id, "sauna_price", Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Банный чан (купель), ₽</Label>
                <Input
                  type="number"
                  value={p.plunge_pool_price}
                  onChange={(e) => updateField(p.id, "plunge_pool_price", Number(e.target.value))}
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

      <div className="mt-6 rounded-2xl bg-card p-4 border border-border/50 space-y-3">
        <div>
          <h2 className="font-semibold text-sm">Импорт из Суточно.ру</h2>
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
            Ссылки iCal со страницы объекта на Суточно.ру. Брони с этих ссылок
            автоматически загружаются каждые 30 минут. Оставьте поле пустым,
            чтобы отключить импорт по дому.
          </p>
        </div>
        {prices.map((p) => (
          <div key={`sut-${p.id}`} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full ${
                  p.name === "GREEN" ? "bg-house-green" : "bg-house-black"
                }`}
              />
              <span className="text-xs font-medium">Дом {p.name}</span>
            </div>
            <Input
              value={p.sutochno_ical_url}
              onChange={(e) =>
                updateField(p.id, "sutochno_ical_url", e.target.value)
              }
              placeholder="https://sutochno.ru/calendar/ical/...ics"
              className="text-[11px] font-mono h-9"
            />
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground">
          Не забудьте нажать «Сохранить» вверху.
        </p>
      </div>

      <div className="mt-6 rounded-2xl bg-card p-4 border border-border/50 space-y-3">
        <div>
          <h2 className="font-semibold text-sm">Импорт из Циан</h2>
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
            Ссылки iCal со страницы объявления на Циан. Брони с этих ссылок
            автоматически загружаются каждые 30 минут. Оставьте поле пустым,
            чтобы отключить импорт по дому.
          </p>
        </div>
        {prices.map((p) => (
          <div key={`cian-${p.id}`} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full ${
                  p.name === "GREEN" ? "bg-house-green" : "bg-house-black"
                }`}
              />
              <span className="text-xs font-medium">Дом {p.name}</span>
            </div>
            <Input
              value={p.cian_ical_url}
              onChange={(e) =>
                updateField(p.id, "cian_ical_url", e.target.value)
              }
              placeholder="https://www.cian.ru/calendar/ical/...ics"
              className="text-[11px] font-mono h-9"
            />
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground">
          Не забудьте нажать «Сохранить» вверху.
        </p>
      </div>
    </div>
  );
}
