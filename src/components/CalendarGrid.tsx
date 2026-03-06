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
  isBefore,
  isAfter,
  isSameDay,
  parseISO,
  getDay,
  startOfDay,
  addDays,
  subDays,
} from "date-fns";
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

function getCellBg(
  greenBooked: boolean,
  blackBooked: boolean,
  filter: HouseFilter
): string {
  if (filter === "all") {
    if (greenBooked && blackBooked) return "calendar-cell-both";
    if (greenBooked) return "calendar-cell-green-only";
    if (blackBooked) return "calendar-cell-black-only";
  } else if (filter === "green") {
    if (greenBooked) return "calendar-cell-green-full";
  } else {
    if (blackBooked) return "calendar-cell-black-full";
  }
  return "";
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

  const today = startOfDay(new Date());

  // Precompute booking status for each day for strip connectivity
  const dayStatusMap = useMemo(() => {
    const map = new Map<string, { greenBooked: boolean; blackBooked: boolean; cellBg: string }>();
    for (const day of days) {
      const allDayBookings = getBookingsForDate(day, bookings);
      const gb = allDayBookings.some(
        (b) => greenHouse && b.house_id === greenHouse.id && !b.cancelled
      );
      const bb = allDayBookings.some(
        (b) => blackHouse && b.house_id === blackHouse.id && !b.cancelled
      );
      map.set(format(day, "yyyy-MM-dd"), { greenBooked: gb, blackBooked: bb, cellBg: getCellBg(gb, bb, filter) });
    }
    return map;
  }, [days, bookings, greenHouse, blackHouse, filter]);

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={cn(
              "text-center text-[10px] font-medium text-muted-foreground py-1",
              (i === 5 || i === 6) && "font-bold text-foreground/70"
            )}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, idx) => {
          const inMonth = isSameMonth(day, month);
          const isCurrentDay = isToday(day);
          const isPast = isBefore(day, today);
          const dayBookings = getBookingsForDate(day, filteredBookings);
          const dayKey = format(day, "yyyy-MM-dd");
          const status = dayStatusMap.get(dayKey)!;
          const { greenBooked, blackBooked, cellBg } = status;
          const dayOfWeek = getDay(day);
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          // In guest/public view, past dates are all gray
          if (isPublicView && inMonth && isPast) {
            return (
              <button
                key={day.toISOString()}
                disabled
                className="relative flex flex-col items-center justify-center rounded-lg aspect-square text-xs opacity-20 pointer-events-none"
              >
                <span className="font-semibold leading-none text-muted-foreground">
                  {format(day, "d")}
                </span>
              </button>
            );
          }

          // Check for cancelled bookings — only show in admin view
          const hasCancelled = !isPublicView && dayBookings.some((b) => b.cancelled);

          const isInRange =
            selectedRange.start &&
            selectedRange.end &&
            !isBefore(day, selectedRange.start) &&
            !isAfter(day, selectedRange.end);

          const isRangeStart = selectedRange.start && isSameDay(day, selectedRange.start);
          const isRangeEnd = selectedRange.end && isSameDay(day, selectedRange.end);

          const hasActiveBooking = dayBookings.some((b) => !b.cancelled);

          // Strip connectivity for admin view (multi-day bookings)
          let stripClass = "rounded-lg";
          if (!isPublicView && cellBg && inMonth) {
            const colIndex = idx % 7;
            const prevKey = colIndex > 0 ? format(subDays(day, 1), "yyyy-MM-dd") : null;
            const nextKey = colIndex < 6 ? format(addDays(day, 1), "yyyy-MM-dd") : null;
            const prevStatus = prevKey ? dayStatusMap.get(prevKey) : null;
            const nextStatus = nextKey ? dayStatusMap.get(nextKey) : null;
            const prevSame = prevStatus && prevStatus.cellBg === cellBg && isSameMonth(subDays(day, 1), month);
            const nextSame = nextStatus && nextStatus.cellBg === cellBg && isSameMonth(addDays(day, 1), month);

            if (prevSame && nextSame) {
              stripClass = "rounded-none";
            } else if (prevSame) {
              stripClass = "rounded-l-none rounded-r-lg";
            } else if (nextSame) {
              stripClass = "rounded-r-none rounded-l-lg";
            } else {
              stripClass = "rounded-lg";
            }
          }

          return (
            <button
              key={day.toISOString()}
              onClick={() => inMonth && onDateClick(day)}
              disabled={!inMonth}
              className={cn(
                "relative flex flex-col items-center justify-center aspect-square text-xs transition-all",
                stripClass,
                !inMonth && "opacity-20 pointer-events-none",
                inMonth && !hasActiveBooking && "hover:bg-secondary",
                inMonth && isWeekend && !cellBg && "bg-muted/40",
                // Today: bold blue ring for admin, subtle for guest
                isCurrentDay && !isPublicView && "ring-2 ring-[hsl(217,91%,60%)]",
                isCurrentDay && isPublicView && "ring-1 ring-primary/30",
                isInRange && "bg-primary/10",
                isRangeStart && "ring-2 ring-primary",
                isRangeEnd && "ring-2 ring-primary",
                cellBg
              )}
            >
              <span
                className={cn(
                  "font-semibold leading-none",
                  isCurrentDay && "text-primary",
                  (greenBooked && blackBooked) && "text-primary-foreground",
                  (filter === "green" && greenBooked) && "text-primary-foreground",
                  (filter === "black" && blackBooked) && "text-primary-foreground",
                  (filter === "all" && greenBooked && !blackBooked) && "text-primary-foreground",
                  (filter === "all" && blackBooked && !greenBooked) && "text-primary-foreground"
                )}
              >
                {format(day, "d")}
              </span>
              {/* Red stripe for cancelled bookings — admin only */}
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
