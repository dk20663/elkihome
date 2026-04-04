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

  // Precompute booking status and active booking IDs for each day
  const dayStatusMap = useMemo(() => {
    const map = new Map<string, {
      greenBooked: boolean;
      blackBooked: boolean;
      cellBg: string;
      greenBookingIds: Set<string>;
      blackBookingIds: Set<string>;
    }>();
    for (const day of days) {
      const allDayBookings = getBookingsForDate(day, bookings);
      const greenIds = new Set<string>();
      const blackIds = new Set<string>();
      for (const b of allDayBookings) {
        if (b.cancelled) continue;
        if (greenHouse && b.house_id === greenHouse.id) greenIds.add(b.id);
        if (blackHouse && b.house_id === blackHouse.id) blackIds.add(b.id);
      }
      const gb = greenIds.size > 0;
      const bb = blackIds.size > 0;
      map.set(format(day, "yyyy-MM-dd"), {
        greenBooked: gb,
        blackBooked: bb,
        cellBg: getCellBg(gb, bb, filter),
        greenBookingIds: greenIds,
        blackBookingIds: blackIds,
      });
    }
    return map;
  }, [days, bookings, greenHouse, blackHouse, filter]);

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
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
      <div className="grid grid-cols-7">
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
                className="relative flex flex-col items-center justify-center aspect-square text-xs opacity-20 pointer-events-none"
              >
                <span className="font-semibold leading-none text-muted-foreground">
                  {format(day, "d")}
                </span>
              </button>
            );
          }

          const hasCancelled = !isPublicView && dayBookings.some((b) => b.cancelled);

          const isInRange =
            selectedRange.start &&
            selectedRange.end &&
            !isBefore(day, selectedRange.start) &&
            !isAfter(day, selectedRange.end);

          const isRangeStart = selectedRange.start && isSameDay(day, selectedRange.start);
          const isRangeEnd = selectedRange.end && isSameDay(day, selectedRange.end);

          const hasActiveBooking = dayBookings.some((b) => !b.cancelled);

          // Strip connectivity: booking-aware (share same booking ID with neighbor)
          let borderRadiusStyle: React.CSSProperties = {};
          if (!isPublicView && cellBg && inMonth) {
            const colIndex = idx % 7;
            const prevKey = format(subDays(day, 1), "yyyy-MM-dd");
            const nextKey = format(addDays(day, 1), "yyyy-MM-dd");
            const prevStatus = dayStatusMap.get(prevKey);
            const nextStatus = dayStatusMap.get(nextKey);

            // Check if neighbor shares a booking ID (not just same color)
            const sharesBookingWithPrev = (a: typeof status, b: typeof prevStatus) => {
              if (!b) return false;
              if (filter === "green" || filter === "all") {
                for (const id of a.greenBookingIds) {
                  if (b.greenBookingIds.has(id)) return true;
                }
              }
              if (filter === "black" || filter === "all") {
                for (const id of a.blackBookingIds) {
                  if (b.blackBookingIds.has(id)) return true;
                }
              }
              return false;
            };

            // Check if booking continues from/to outside visible month
            const bookingContinuesFromBefore = (() => {
              // Check if any booking on this day started before this day
              const allIds = [...status.greenBookingIds, ...status.blackBookingIds];
              return allIds.some(id => {
                const b = bookings.find(bk => bk.id === id);
                return b && parseISO(b.check_in) < day;
              });
            })();
            const bookingContinuesToAfter = (() => {
              const allIds = [...status.greenBookingIds, ...status.blackBookingIds];
              return allIds.some(id => {
                const b = bookings.find(bk => bk.id === id);
                return b && parseISO(b.check_out) > addDays(day, 1);
              });
            })();

            const prevDayInGrid = colIndex > 0;
            const nextDayInGrid = colIndex < 6;
            const prevDayInMonth = isSameMonth(subDays(day, 1), month);
            const nextDayInMonth = isSameMonth(addDays(day, 1), month);
            
            // Connect to previous if: same row + same booking + both in month
            // OR if booking continues from before month and this is the first visible day of the booking
            const prevSame = (prevDayInGrid && prevStatus && sharesBookingWithPrev(status, prevStatus) && prevDayInMonth)
              || (!prevDayInMonth && inMonth && bookingContinuesFromBefore && colIndex > 0);
            const nextSame = (nextDayInGrid && nextStatus && sharesBookingWithPrev(status, nextStatus) && nextDayInMonth)
              || (!nextDayInMonth && inMonth && bookingContinuesToAfter && colIndex < 6);

            if (prevSame && nextSame) {
              borderRadiusStyle = { borderRadius: 0 };
            } else if (prevSame) {
              borderRadiusStyle = { borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderTopRightRadius: 'var(--radius)', borderBottomRightRadius: 'var(--radius)' };
            } else if (nextSame) {
              borderRadiusStyle = { borderTopRightRadius: 0, borderBottomRightRadius: 0, borderTopLeftRadius: 'var(--radius)', borderBottomLeftRadius: 'var(--radius)' };
            }
          }

          return (
            <button
              key={day.toISOString()}
              onClick={() => inMonth && onDateClick(day)}
              disabled={!inMonth}
              style={borderRadiusStyle}
              className={cn(
                "relative flex flex-col items-center justify-center aspect-square text-xs transition-all rounded-[var(--radius)]",
                !inMonth && "opacity-20 pointer-events-none",
                inMonth && !hasActiveBooking && "hover:bg-secondary",
                inMonth && isWeekend && !cellBg && "bg-muted/40",
                isInRange && "bg-primary/10",
                isRangeStart && "ring-2 ring-primary",
                isRangeEnd && "ring-2 ring-primary",
                cellBg,
                // Today: inset outline
                isCurrentDay && "calendar-today-outline"
              )}
            >
              <span
                className={cn(
                  "font-semibold leading-none",
                  isCurrentDay && !cellBg && "text-primary",
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
