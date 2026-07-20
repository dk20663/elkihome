import { format, getDay, parseISO, isSameDay, isAfter, isBefore } from "date-fns";
import { ru } from "date-fns/locale";
import { MessageCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CONTACT_CHANNELS } from "@/lib/contactChannels";
import type { House, HouseFilter, Booking, HousePricing } from "@/lib/types";

interface Props {
  date: Date | null;
  houses: House[];
  filter: HouseFilter;
  open: boolean;
  onClose: () => void;
  bookings?: Booking[];
  pricing?: HousePricing[];
}

function isWeekdayCustom(date: Date): boolean {
  const day = getDay(date);
  return day >= 1 && day <= 4;
}

function isHouseBookedOnDate(date: Date, houseId: string, bookings: Booking[]): boolean {
  return bookings.some((b) => {
    if (b.cancelled || b.house_id !== houseId) return false;
    const checkIn = parseISO(b.check_in);
    const checkOut = parseISO(b.check_out);
    return (isAfter(date, checkIn) || isSameDay(date, checkIn)) && isBefore(date, checkOut);
  });
}

/** Get today's date in MSK+4 (UTC+7) timezone */
function getTodayMSKPlus4(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const mskPlus4 = new Date(utc + 7 * 3600000);
  return new Date(mskPlus4.getFullYear(), mskPlus4.getMonth(), mskPlus4.getDate());
}

function isTodayMSKPlus4(date: Date): boolean {
  const today = getTodayMSKPlus4();
  return isSameDay(date, today);
}


const HOUSE_DISCOUNT = 2000;
const SAUNA_DISCOUNT = 2000;

export default function GuestPriceDetail({ date, houses, filter, open, onClose, bookings = [], pricing = [] }: Props) {
  if (!date) return null;

  const greenHouse = houses.find((h) => h.name === "GREEN");
  const blackHouse = houses.find((h) => h.name === "BLACK");
  const isWeekday = isWeekdayCustom(date);
  const dayType = isWeekday ? "будни" : "выходные";
  const dateStr = format(date, "yyyy-MM-dd");
  const isToday = isTodayMSKPlus4(date);

  const housesToShow =
    filter === "green" ? [greenHouse].filter(Boolean) :
    filter === "black" ? [blackHouse].filter(Boolean) :
    [greenHouse, blackHouse].filter(Boolean);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[85dvh] flex flex-col p-0"
      >
        <div className="p-6 pb-0 flex-shrink-0">
          <SheetHeader>
            <SheetTitle>
              {format(date, "d MMMM yyyy", { locale: ru })}
            </SheetTitle>
            <p className="text-xs text-muted-foreground capitalize">{dayType}</p>
          </SheetHeader>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-8 pt-4 space-y-5">
          {housesToShow.map((house) => {
            if (!house) return null;
            const customPrice = pricing.find((p) => p.house_id === house.id && p.date === dateStr);
            const housePrice = customPrice ? customPrice.price : (isWeekday ? house.base_price_weekday : house.base_price_weekend);
            const saunaPrice = house.sauna_price ?? 5000;
            const saunaDiscounted = Math.max(0, saunaPrice - SAUNA_DISCOUNT);
            const plungePrice = house.plunge_pool_price ?? (house.name === "GREEN" ? 5500 : 5000);
            const isBooked = isHouseBookedOnDate(date, house.id, bookings);

            // Today discount: only if today AND house is free
            const hasTodayDiscount = isToday && !isBooked;
            const discountedHousePrice = Math.max(0, housePrice - HOUSE_DISCOUNT);

            const actionLabel = isBooked ? "Связаться" : "Забронировать";
            const guestComment = (house.guest_comment ?? "").trim();
            return (
              <div key={house.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        house.name === "GREEN" ? "bg-house-green" : "bg-house-black"
                      }`}
                    />
                    <span className="font-semibold">Дом {house.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className="text-xs font-semibold text-foreground/80">
                      {actionLabel}:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {CONTACT_CHANNELS.map((c) => (
                        <Button
                          key={c.id}
                          size="sm"
                          variant={c.id === "telegram" ? "default" : "secondary"}
                          className="h-7 text-xs gap-1"
                          onClick={() => window.open(c.url, "_blank", "noopener,noreferrer")}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {c.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {guestComment && (
                  <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 shadow-sm flex items-start gap-3">
                    <Info className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium text-emerald-900 leading-relaxed">
                      {guestComment}
                    </span>
                  </div>
                )}

                {isBooked && (
                  <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                    На эту дату дом уже занят. Мы можем добавить вас в лист ожидания, и, если он освободится, сразу сообщим. Свяжитесь с нами для создания заявки
                  </div>
                )}

                <div className="rounded-xl bg-secondary p-3 space-y-1.5 text-sm">
                  {/* House price */}
                  <div>
                    <div className="flex justify-between items-center">
                      <span>Стоимость дома</span>
                      {hasTodayDiscount ? (
                        <span className="flex items-center gap-2">
                          <span className="line-through text-muted-foreground">{housePrice.toLocaleString("ru-RU")} ₽</span>
                        </span>
                      ) : (
                        <span className="font-semibold">{housePrice.toLocaleString("ru-RU")} ₽</span>
                      )}
                    </div>
                    {hasTodayDiscount && (
                      <p className="text-xs font-semibold text-emerald-600 mt-0.5">
                        Сегодня цена снижена — {discountedHousePrice.toLocaleString("ru-RU")} ₽
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">цена указана на 2 гостя</p>
                  </div>

                  {/* Sauna */}
                  <div>
                    <div className="flex justify-between items-center">
                      <span>Баня</span>
                      {hasTodayDiscount ? (
                        <span className="flex items-center gap-2">
                          <span className="line-through text-muted-foreground">5 000 ₽</span>
                          <span className="font-semibold text-emerald-600">{SAUNA_DISCOUNTED.toLocaleString("ru-RU")} ₽</span>
                        </span>
                      ) : (
                        <span className="font-semibold">5 000 ₽</span>
                      )}
                    </div>
                  </div>

                  {/* Plunge pool */}
                  <div>
                    <div className="flex justify-between items-center">
                      <span>Банный чан</span>
                      <span className="font-semibold">{plungePrice.toLocaleString("ru-RU")} ₽</span>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <span>Пихтовая запарка в чан</span>
                    <span className="font-semibold">500 ₽</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}