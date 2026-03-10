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
import { Edit, Ban, Phone, User, Calendar, MessageSquare, Users, Globe, RotateCcw, Plus, DollarSign } from "lucide-react";
import type { HouseFilter } from "@/lib/types";

interface Props {
  booking: Booking | null;
  house: House | null;
  open: boolean;
  onClose: () => void;
  onEdit: (b?: Booking) => void;
  onCancel: (b?: Booking) => void;
  cancelledBookings?: Booking[];
  houses?: House[];
  onShowCancelled?: () => void;
  allActiveBookings?: Booking[];
  onSelectBooking?: (b: Booking) => void;
  onAddBookingForHouse?: (houseId: string) => void;
  onEditPriceForHouse?: (houseId: string) => void;
  currentFilter?: HouseFilter;
}

function BookingCard({ booking, house, onEdit, onCancel }: { booking: Booking; house: House; onEdit: () => void; onCancel: () => void }) {
  const nights = differenceInDays(parseISO(booking.check_out), parseISO(booking.check_in));
  const services = [
    booking.sauna && "Баня",
    booking.plunge_pool && "Купель",
    booking.fir_infusion && "Пихтовая запарка",
    booking.citrus_infusion && "Цитрусовая запарка",
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-full ${house.name === "GREEN" ? "bg-house-green" : "bg-house-black"}`} />
        <span className="font-semibold">Дом {house.name}</span>
        {booking.cancelled && <Badge variant="destructive" className="text-xs">ОТМЕНЕНО</Badge>}
      </div>

      {services.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {services.map((s, i) => (
            <span key={s as string} className="text-base font-semibold">
              {s}{i < services.length - 1 ? " ·" : ""}
            </span>
          ))}
        </div>
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

      <div className="flex gap-2">
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
  );
}

export default function BookingDetail({
  booking, house, open, onClose, onEdit, onCancel,
  cancelledBookings = [], houses = [], onShowCancelled,
  allActiveBookings = [], onSelectBooking,
  onAddBookingForHouse, onEditPriceForHouse,
  currentFilter,
}: Props) {
  if (!booking || !house) return null;

  const multipleBookings = allActiveBookings.length > 1;

  // Find which houses are NOT booked on this date, respecting filter
  const bookedHouseIds = new Set(allActiveBookings.map((b) => b.house_id));
  const isFiltered = currentFilter === "green" || currentFilter === "black";
  const freeHouses = isFiltered ? [] : houses.filter((h) => !bookedHouseIds.has(h.id));

  // For price editing, only show houses matching the current filter
  const visibleBookedHouseIds = isFiltered
    ? new Set(allActiveBookings.filter((b) => b.house_id === house.id).map((b) => b.house_id))
    : bookedHouseIds;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{multipleBookings ? "Бронирования на дату" : `Дом ${house.name}`}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-2">
          {multipleBookings ? (
            allActiveBookings.map((b) => {
              const bHouse = houses.find((h) => h.id === b.house_id);
              if (!bHouse) return null;
              return (
                <div key={b.id} className="rounded-xl border border-border p-3">
                  <BookingCard
                    booking={b}
                    house={bHouse}
                    onEdit={() => { onSelectBooking?.(b); onEdit(); }}
                    onCancel={() => { onSelectBooking?.(b); onCancel(); }}
                  />
                </div>
              );
            })
          ) : (
            <BookingCard booking={booking} house={house} onEdit={onEdit} onCancel={onCancel} />
          )}

          {/* Actions for free houses */}
          {freeHouses.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground font-medium">Свободные дома:</p>
              {freeHouses.map((fh) => (
                <div key={fh.id} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${fh.name === "GREEN" ? "bg-house-green" : "bg-house-black"}`} />
                  <span className="text-sm font-medium flex-1">Дом {fh.name}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { onClose(); onAddBookingForHouse?.(fh.id); }}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Бронь
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { onClose(); onEditPriceForHouse?.(fh.id); }}
                  >
                    <DollarSign className="mr-1 h-3.5 w-3.5" /> Цена
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Actions for booked houses - edit price */}
          {visibleBookedHouseIds.size > 0 && onEditPriceForHouse && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground font-medium">Изменить цену:</p>
              {Array.from(visibleBookedHouseIds).map((hId) => {
                const bh = houses.find((h) => h.id === hId);
                if (!bh) return null;
                return (
                  <Button
                    key={hId}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => { onClose(); onEditPriceForHouse(hId); }}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full mr-2 ${bh.name === "GREEN" ? "bg-house-green" : "bg-house-black"}`} />
                    <DollarSign className="mr-1 h-3.5 w-3.5" /> Цена дома {bh.name}
                  </Button>
                );
              })}
            </div>
          )}

          {cancelledBookings.length > 0 && onShowCancelled && (
            <Button
              variant="outline"
              className="w-full border-destructive/30 text-destructive hover:bg-destructive/5"
              onClick={onShowCancelled}
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              Отменённые заезды ({cancelledBookings.length})
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
