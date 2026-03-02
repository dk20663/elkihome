import { format, getDay, parseISO, isSameDay, isAfter, isBefore } from "date-fns";
import { ru } from "date-fns/locale";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { House, HouseFilter, Booking } from "@/lib/types";

interface Props {
  date: Date | null;
  houses: House[];
  filter: HouseFilter;
  open: boolean;
  onClose: () => void;
  bookings?: Booking[];
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

const TELEGRAM_URL = "https://t.me/elki_home24";

export default function GuestPriceDetail({ date, houses, filter, open, onClose, bookings = [] }: Props) {
  if (!date) return null;

  const greenHouse = houses.find((h) => h.name === "GREEN");
  const blackHouse = houses.find((h) => h.name === "BLACK");
  const isWeekday = isWeekdayCustom(date);
  const dayType = isWeekday ? "будни" : "выходные";

  const housesToShow =
    filter === "green" ? [greenHouse].filter(Boolean) :
    filter === "black" ? [blackHouse].filter(Boolean) :
    [greenHouse, blackHouse].filter(Boolean);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>
            {format(date, "d MMMM yyyy", { locale: ru })}
          </SheetTitle>
          <p className="text-xs text-muted-foreground capitalize">{dayType}</p>
        </SheetHeader>
        <div className="space-y-5 pt-4">
          {housesToShow.map((house) => {
            if (!house) return null;
            const housePrice = isWeekday ? house.base_price_weekday : house.base_price_weekend;
            const plungePrice = house.name === "GREEN" ? 5500 : 5000;
            const isBooked = isHouseBookedOnDate(date, house.id, bookings);

            return (
              <div key={house.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        house.name === "GREEN" ? "bg-house-green" : "bg-house-black"
                      }`}
                    />
                    <span className="font-semibold">Дом {house.name}</span>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => window.open(TELEGRAM_URL, "_blank")}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Забронировать
                  </Button>
                </div>

                {isBooked && (
                  <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                    На эту дату дом уже занят. Мы можем добавить вас в лист ожидания, и, если он освободится, сразу сообщим. Свяжитесь с нами для создания заявки
                  </div>
                )}

                <div className="rounded-xl bg-secondary p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span>Стоимость дома</span>
                    <span className="font-semibold">{housePrice.toLocaleString("ru-RU")} ₽</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Баня</span>
                    <span className="font-semibold">5 000 ₽</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Банный чан</span>
                    <span className="font-semibold">{plungePrice.toLocaleString("ru-RU")} ₽</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Пихтовая запарка в чан</span>
                    <span className="font-semibold">500 ₽</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Веники в баню</span>
                    <span className="font-semibold">от 400 ₽</span>
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
