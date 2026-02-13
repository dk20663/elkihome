import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isWeekend,
  isBefore,
  isAfter,
  isSameDay,
  parseISO,
  getDay,
} from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Booking, House, HouseFilter } from "@/lib/types";

interface Props {
  month: Date;
  bookings: Booking[];
  houses: House[];
  filter: HouseFilter;
  onDateClick: (date: Date) => void;
  selectedRange: { start: Date | null; end: Date | null };
  isPublicView?: boolean;
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function getBookingsForDate(date: Date, bookings: Booking[]) {
  return bookings.filter((b) => {
    const checkIn = parseISO(b.check_in);
    const checkOut = parseISO(b.check_out);
    return (
      (isAfter(date, checkIn) || isSameDay(date, checkIn)) &&
      isBefore(date, checkOut)
    );
  });
}

// Weekdays: Mon-Thu, Weekends: Fri-Sun
function isWeekdayCustom(date: Date): boolean {
  const day = getDay(date);
  return day >= 1 && day <= 4; // Mon=1, Thu=4
}

function getPriceForDate(date: Date, houses: House[], filter: HouseFilter): number | null {
  if (filter === "all") return null; // No price in "all" view
  const house = filter === "green"
    ? houses.find(h => h.name === "GREEN")
    : houses.find(h => h.name === "BLACK");
  if (!house) return null;
  return isWeekdayCustom(date) ? house.base_price_weekday : house.base_price_weekend;
}

export default function CalendarGrid({
  month,
  bookings,
  houses,
  filter,
  onDateClick,
  selectedRange,
  isPublicView = false,
}: Props) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const greenHouse = houses.find((h) => h.name === "GREEN");
  const blackHouse = houses.find((h) => h.name === "BLACK");

  const filteredBookings = useMemo(() => {
    if (filter === "all") return bookings;
    const house = filter === "green" ? greenHouse : blackHouse;
    if (!house) return bookings;
    return bookings.filter((b) => b.house_id === house.id);
  }, [bookings, filter, greenHouse, blackHouse]);

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-medium text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          const dayBookings = getBookingsForDate(day, filteredBookings);
          const allDayBookings = getBookingsForDate(day, bookings);

          // Check for active (non-cancelled) bookings
          const greenBooked = allDayBookings.some(
            (b) => greenHouse && b.house_id === greenHouse.id && !b.cancelled
          );
          const blackBooked = allDayBookings.some(
            (b) => blackHouse && b.house_id === blackHouse.id && !b.cancelled
          );

          // Check for cancelled bookings
          const hasCancelled = dayBookings.some((b) => b.cancelled);

          const isInRange =
            selectedRange.start &&
            selectedRange.end &&
            !isBefore(day, selectedRange.start) &&
            !isAfter(day, selectedRange.end);

          const isRangeStart = selectedRange.start && isSameDay(day, selectedRange.start);
          const isRangeEnd = selectedRange.end && isSameDay(day, selectedRange.end);

          const price = getPriceForDate(day, houses, filter);

          let cellBg = "";
          if (filter === "all") {
            if (greenBooked && blackBooked) cellBg = "calendar-cell-both";
            else if (greenBooked) cellBg = "calendar-cell-green-only";
            else if (blackBooked) cellBg = "calendar-cell-black-only";
          } else if (filter === "green") {
            if (greenBooked) cellBg = "calendar-cell-green-only";
          } else {
            if (blackBooked) cellBg = "calendar-cell-black-only";
          }

          const hasActiveBooking = dayBookings.some((b) => !b.cancelled);

          return (
            <button
              key={day.toISOString()}
              onClick={() => inMonth && onDateClick(day)}
              disabled={!inMonth}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg aspect-square text-xs transition-all",
                !inMonth && "opacity-20 pointer-events-none",
                inMonth && !hasActiveBooking && "hover:bg-secondary",
                today && "ring-1 ring-primary/30",
                isInRange && "bg-primary/10",
                isRangeStart && "ring-2 ring-primary",
                isRangeEnd && "ring-2 ring-primary",
                cellBg
              )}
            >
              <span
                className={cn(
                  "font-semibold leading-none",
                  today && "text-primary",
                  (greenBooked && blackBooked) && "text-primary-foreground",
                  (greenBooked && !blackBooked && filter !== "black") && "text-primary-foreground",
                  (blackBooked && !greenBooked && filter !== "green") && "text-primary-foreground"
                )}
              >
                {format(day, "d")}
              </span>
              {inMonth && price && filter !== "all" && (
                <span
                  className={cn(
                    "text-[8px] leading-none mt-0.5 font-medium",
                    hasActiveBooking ? "text-primary-foreground/70" : "text-price"
                  )}
                >
                  {price.toLocaleString("ru-RU")}
                </span>
              )}
              {/* Red stripe for cancelled bookings */}
              {inMonth && hasCancelled && (
                <span className="absolute bottom-0.5 left-1 right-1 h-[2px] rounded-full bg-destructive" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
