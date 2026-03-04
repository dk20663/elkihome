import { format, parseISO, differenceInDays, isSameDay, isAfter, isBefore } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Booking, House } from "@/lib/types";
import { RotateCcw, Calendar, User, Phone, MessageSquare, Users, Globe, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  bookings: Booking[];
  houses: House[];
  open: boolean;
  onClose: () => void;
  onAddBooking?: () => void;
  allBookings?: Booking[];
  onRestore?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function CancelledBookingsSheet({ bookings, houses, open, onClose, onAddBooking, allBookings = [], onRestore, onDelete }: Props) {
  if (bookings.length === 0) return null;

  const handleRestore = (booking: Booking) => {
    // Check if the date range is already occupied by an active booking for the same house
    const conflicting = allBookings.some((b) => {
      if (b.cancelled || b.id === booking.id || b.house_id !== booking.house_id) return false;
      const bIn = parseISO(b.check_in);
      const bOut = parseISO(b.check_out);
      const rIn = parseISO(booking.check_in);
      const rOut = parseISO(booking.check_out);
      // Overlap check
      return isBefore(rIn, bOut) && isAfter(rOut, bIn);
    });

    if (conflicting) {
      toast.error("Восстановить бронирование не получится, т.к. дата уже занята");
      return;
    }

    onRestore?.(booking.id);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-destructive" />
            Отменённые заезды ({bookings.length})
          </SheetTitle>
        </SheetHeader>

        {onAddBooking && (
          <div className="py-3">
            <Button className="w-full" onClick={() => { onClose(); onAddBooking(); }}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить бронирование на эту дату
            </Button>
          </div>
        )}

        <div className="space-y-3 pb-4">
          {bookings.map((booking) => {
            const house = houses.find((h) => h.id === booking.house_id);
            const nights = differenceInDays(
              parseISO(booking.check_out),
              parseISO(booking.check_in)
            );
            const services = [
              booking.sauna && "Баня",
              booking.plunge_pool && "Купель",
              booking.fir_infusion && "Пихтовая запарка",
              booking.citrus_infusion && "Цитрусовая запарка",
            ].filter(Boolean);

            return (
              <div
                key={booking.id}
                className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        house?.name === "GREEN" ? "bg-house-green" : "bg-house-black"
                      }`}
                    />
                    <span className="text-sm font-semibold">
                      {house?.name || "—"}
                    </span>
                  </div>
                  <Badge variant="destructive" className="text-[10px]">
                    ОТМЕНЕНО
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {format(parseISO(booking.check_in), "d MMM", { locale: ru })} —{" "}
                    {format(parseISO(booking.check_out), "d MMM", { locale: ru })}
                    {" "}({nights} ночей)
                  </span>
                </div>

                {booking.total_price > 0 && (
                  <div className="text-sm font-bold text-price">
                    {booking.total_price.toLocaleString("ru-RU")} ₽
                  </div>
                )}

                {booking.guest_name && (
                  <div className="flex items-center gap-2 text-xs">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {booking.guest_name}
                  </div>
                )}

                {booking.guest_phone && (
                  <div className="flex items-center gap-2 text-xs">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <a href={`tel:${booking.guest_phone}`} className="text-primary underline">
                      {booking.guest_phone}
                    </a>
                  </div>
                )}

                {booking.guest_count > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    Гостей: {booking.guest_count}
                  </div>
                )}

                {booking.source && (
                  <div className="flex items-center gap-2 text-xs">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    {booking.source}
                  </div>
                )}

                {booking.comment && (
                  <div className="flex items-start gap-2 text-xs">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                    <span className="text-muted-foreground">{booking.comment}</span>
                  </div>
                )}

                {services.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {services.join(" · ")}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  {onRestore && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-primary/30 text-primary hover:bg-primary/5"
                      onClick={() => handleRestore(booking)}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                      Восстановить
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => onDelete(booking.id)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Удалить
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
