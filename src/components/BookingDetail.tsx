import { format, parseISO, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { Booking, House } from "@/lib/types";
import { Edit, Ban, Phone, User, Calendar, MessageSquare, Users, Globe } from "lucide-react";

interface Props {
  booking: Booking | null;
  house: House | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
}

export default function BookingDetail({ booking, house, open, onClose, onEdit, onCancel }: Props) {
  if (!booking || !house) return null;

  const nights = differenceInDays(parseISO(booking.check_out), parseISO(booking.check_in));
  const services = [
    booking.sauna && "Баня",
    booking.plunge_pool && "Купель",
    booking.bath_brooms && "Веники в баню",
    booking.fir_infusion && "Пихтовая запарка",
    booking.citrus_infusion && "Цитрусовая запарка",
  ].filter(Boolean);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${
                house.name === "GREEN" ? "bg-house-green" : "bg-house-black"
              }`}
            />
            Дом {house.name}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-2">
          {/* Services right under house name, same font size */}
          {services.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {services.map((s) => (
                <span key={s as string} className="text-base font-semibold">
                  {s}
                  {services.indexOf(s as string) < services.length - 1 ? " ·" : ""}
                </span>
              ))}
            </div>
          )}

          {booking.cancelled && (
            <Badge variant="destructive" className="text-xs">
              ОТМЕНЕНО
            </Badge>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              {format(parseISO(booking.check_in), "d MMM", { locale: ru })} —{" "}
              {format(parseISO(booking.check_out), "d MMM yyyy", { locale: ru })}
            </span>
            <span className="text-muted-foreground">({nights} ночей)</span>
          </div>

          <div className="text-2xl font-bold text-price">
            {booking.total_price.toLocaleString("ru-RU")} ₽
          </div>

          {booking.guest_count > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              Гостей: {booking.guest_count}
            </div>
          )}

          {booking.source && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-muted-foreground" />
              {booking.source}
            </div>
          )}

          {booking.guest_name && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              {booking.guest_name}
            </div>
          )}

          {booking.guest_phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${booking.guest_phone}`} className="text-primary underline">
                {booking.guest_phone}
              </a>
            </div>
          )}

          {booking.comment && (
            <div className="flex items-start gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span className="text-muted-foreground">{booking.comment}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onEdit}>
              <Edit className="mr-1 h-4 w-4" /> Редактировать
            </Button>
            {!booking.cancelled && (
              <Button variant="destructive" className="flex-1" onClick={onCancel}>
                <Ban className="mr-1 h-4 w-4" /> Отмена заезда
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
