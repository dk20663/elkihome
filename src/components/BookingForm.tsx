import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { House, BookingFormData, Booking, HouseFilter } from "@/lib/types";
import { toast } from "sonner";
import { Save, X } from "lucide-react";

const SOURCES = ["ВК", "Инстаграм", "Звонок", "Авито", "Суточно", "Циан", "Телеграм", "Max", "Другое"];
const GUEST_COUNTS = [1, 2, 3, 4, 5, 6];

interface Props {
  open: boolean;
  onClose: () => void;
  houses: House[];
  onSubmit: (data: BookingFormData) => void;
  initialData?: Booking | null;
  defaultDates?: { start: Date | null; end: Date | null };
  loading?: boolean;
  currentFilter?: HouseFilter;
  presetHouseId?: string | null;
}

export default function BookingForm({
  open,
  onClose,
  houses,
  onSubmit,
  initialData,
  defaultDates,
  loading,
  currentFilter,
  presetHouseId,
}: Props) {
  const [houseId, setHouseId] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [comment, setComment] = useState("");
  const [source, setSource] = useState("");
  const [guestCount, setGuestCount] = useState("1");
  const [sauna, setSauna] = useState(false);
  const [plungePool, setPlungePool] = useState(false);
  const [bathBrooms, setBathBrooms] = useState(false);
  const [firInfusion, setFirInfusion] = useState(false);
  const [citrusInfusion, setCitrusInfusion] = useState(false);

  useEffect(() => {
    if (initialData) {
      setHouseId(initialData.house_id);
      setCheckIn(initialData.check_in);
      setCheckOut(initialData.check_out);
      setTotalPrice(String(initialData.total_price));
      setGuestName(initialData.guest_name);
      setGuestPhone(initialData.guest_phone);
      setComment(initialData.comment || "");
      setSource(initialData.source || "");
      setGuestCount(String(initialData.guest_count || 1));
      setSauna(initialData.sauna);
      setPlungePool(initialData.plunge_pool);
      setBathBrooms(initialData.bath_brooms);
      setFirInfusion(initialData.fir_infusion);
      setCitrusInfusion(initialData.citrus_infusion);
    } else {
      // Default house based on presetHouseId or current filter
      const defaultHouse = presetHouseId
        ? houses.find(h => h.id === presetHouseId)
        : currentFilter === "green"
        ? houses.find(h => h.name === "GREEN")
        : currentFilter === "black"
        ? houses.find(h => h.name === "BLACK")
        : houses[0];
      setHouseId(defaultHouse?.id || houses[0]?.id || "");
      setCheckIn(defaultDates?.start ? format(defaultDates.start, "yyyy-MM-dd") : "");
      setCheckOut(defaultDates?.end ? format(defaultDates.end, "yyyy-MM-dd") : "");
      setTotalPrice("");
      setGuestName("");
      setGuestPhone("");
      setComment("");
      setSource("");
      setGuestCount("1");
      setSauna(false);
      setPlungePool(false);
      setBathBrooms(false);
      setFirInfusion(false);
      setCitrusInfusion(false);
    }
  }, [initialData, defaultDates, houses, open, currentFilter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!houseId || !checkIn || !checkOut) {
      toast.error("Заполните обязательные поля");
      return;
    }
    if (checkOut <= checkIn) {
      toast.error("Дата выезда должна быть после даты заезда");
      return;
    }
    onSubmit({
      house_id: houseId,
      check_in: checkIn,
      check_out: checkOut,
      total_price: Number(totalPrice) || 0,
      guest_name: guestName,
      guest_phone: guestPhone,
      comment,
      source,
      guest_count: Number(guestCount),
      sauna,
      plunge_pool: plungePool,
      bath_brooms: bathBrooms,
      fir_infusion: firInfusion,
      citrus_infusion: citrusInfusion,
    });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>
            {initialData ? "Редактировать бронь" : "Новая бронь"}
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <Label className="text-xs font-medium">Дом *</Label>
            <Select value={houseId} onValueChange={setHouseId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Выберите дом" />
              </SelectTrigger>
              <SelectContent>
                {houses.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          h.name === "GREEN" ? "bg-house-green" : "bg-house-black"
                        }`}
                      />
                      {h.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Заезд *</Label>
              <Input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Выезд *</Label>
              <Input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="mt-1"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Стоимость, ₽</Label>
              <Input
                type="number"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Гостей</Label>
              <Select value={guestCount} onValueChange={setGuestCount}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GUEST_COUNTS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium">Источник</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Выберите источник" />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium">Имя гостя</Label>
            <Input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Иванов Иван"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Телефон</Label>
            <Input
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="+7..."
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Комментарий</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-1 min-h-[60px]"
              placeholder="Заметки..."
            />
          </div>

          <div>
            <Label className="text-xs font-medium mb-2 block">Доп. услуги</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "sauna", label: "Баня", checked: sauna, set: setSauna },
                { id: "plunge", label: "Купель", checked: plungePool, set: setPlungePool },
                { id: "fir", label: "Пихтовая запарка", checked: firInfusion, set: setFirInfusion },
                { id: "citrus", label: "Цитрусовая запарка", checked: citrusInfusion, set: setCitrusInfusion },
              ].map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-xs cursor-pointer hover:bg-secondary transition-colors"
                >
                  <Checkbox
                    checked={s.checked}
                    onCheckedChange={(v) => s.set(!!v)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              <X className="mr-1 h-4 w-4" /> Отмена
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              <Save className="mr-1 h-4 w-4" />
              {loading ? "..." : "Сохранить"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
