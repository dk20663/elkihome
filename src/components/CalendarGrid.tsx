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
  bookingsLoading?: boolean;
  isRefreshing?: boolean;
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
  bookingsLoading = false,
  isRefreshing = false,
}: Props) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const greenHouse = houses.find((h) => h.name?.toUpperCase() === "GREEN");
  const blackHouse = houses.find((h) => h.name?.toUpperCase() === "BLACK");

  // Fallback name→id map (covers bookings from public_bookings_view that include house_name)
  const nameToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of houses) m.set(h.name?.toUpperCase?.() ?? "", h.id);
    return m;
  }, [houses]);
  const matchHouse = (b: Booking, target?: House) => {
    if (!target) return false;
    if (b.house_id && b.house_id === target.id) return true;
    const hn = (b as any).house_name as string | undefined;
    if (hn && nameToId.get(hn.toUpperCase()) === target.id) return true;
    return false;
  };

  const filteredBookings = useMemo(() => {
    if (filter === "all") return bookings;
    const house = filter === "green" ? greenHouse : blackHouse;
    if (!house) return bookings;
    return bookings.filter((b) => matchHouse(b, house));
  }, [bookings, filter, greenHouse, blackHouse, nameToId]);

  const today = startOfDay(new Date());

  // Precompute booking status and active booking IDs for each day
  const dayStatusMap = useMemo(() => {
    const map = new Map<string, {
      greenBooked: boolean;
      blackBooked: boolean;
      cellBg: string;
      greenBookingIds: Set<string>;
      blackBookingIds: Set<string>;
      greenHasAvito: boolean;
      blackHasAvito: boolean;
    }>();
    for (const day of days) {
      const allDayBookings = getBookingsForDate(day, bookings);
      const greenIds = new Set<string>();
      const blackIds = new Set<string>();
      let greenAvito = false;
      let blackAvito = false;
      for (const b of allDayBookings) {
        if (b.cancelled) continue;
        if (matchHouse(b, greenHouse)) {
          greenIds.add(b.id);
          if (b.synced_from === "avito") greenAvito = true;
        }
        if (matchHouse(b, blackHouse)) {
          blackIds.add(b.id);
          if (b.synced_from === "avito") blackAvito = true;
        }
      }
      const gb = greenIds.size > 0;
      const bb = blackIds.size > 0;
      map.set(format(day, "yyyy-MM-dd"), {
        greenBooked: gb,
        blackBooked: bb,
        cellBg: getCellBg(gb, bb, filter),
        greenBookingIds: greenIds,
        blackBookingIds: blackIds,
        greenHasAvito: greenAvito,
        blackHasAvito: blackAvito,
      });
    }
    return map;
  }, [days, bookings, greenHouse, blackHouse, filter]);

  return (
    <div>
      {bookingsLoading && (
        <div className="calendar-loading-bar mb-2" aria-label="Загрузка занятых дат" />
      )}
      <div className={cn("grid grid-cols-7 mb-1", isPublicView && "gap-1.5 lg:gap-2 mb-2")}>
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={cn(
              "text-center text-[10px] lg:text-sm font-medium text-muted-foreground py-1 lg:py-2",
              (i === 5 || i === 6) && "font-bold text-foreground/70",
              isPublicView && "text-guest-muted font-medium text-[11px] lg:text-sm tracking-wide"
            )}
          >
            {d}
          </div>
        ))}
      </div>
      <div className={cn("grid grid-cols-7", isPublicView && "gap-1.5 lg:gap-2")}>
        {days.map((day, idx) => {
          const inMonth = isSameMonth(day, month);
          const isCurrentDay = isToday(day);
          const isPast = isBefore(day, today);
          const dayBookings = getBookingsForDate(day, filteredBookings);
          const dayKey = format(day, "yyyy-MM-dd");
          const status = dayStatusMap.get(dayKey)!;
          const { greenBooked, blackBooked, cellBg, greenHasAvito, blackHasAvito } = status;
          const dayOfWeek = getDay(day);
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          // In guest/public view, past dates are all gray (no booking colors)
          if (isPublicView && isPast) {
            return (
              <button
                key={day.toISOString()}
                disabled
                className="relative flex items-center justify-center aspect-square rounded-2xl bg-guest-cell/40 text-sm lg:text-lg pointer-events-none"
              >
                <span className="font-medium leading-none text-guest-muted/45">
                  {format(day, "d")}
                </span>
              </button>
            );
          }

          // Guest/public view: single selected house — clean modern cells
          if (isPublicView) {
            const booked = filter === "green" ? greenBooked : filter === "black" ? blackBooked : (greenBooked || blackBooked);
            return (
              <button
                key={day.toISOString()}
                onClick={() => inMonth && onDateClick(day)}
                disabled={!inMonth}
                className={cn(
                  "group relative flex items-center justify-center aspect-square rounded-2xl",
                  "transition-all duration-200 ease-out outline-none",
                  "focus-visible:ring-2 focus-visible:ring-guest-booked/50",
                  !inMonth && "pointer-events-none bg-guest-cell/35",
                  inMonth && !booked && "bg-guest-cell hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-10px_hsl(var(--guest-booked)/0.55)] hover:ring-2 hover:ring-guest-booked/25",
                  inMonth && booked && "bg-guest-booked shadow-[0_8px_20px_-12px_hsl(var(--guest-booked)/0.9)] hover:-translate-y-0.5 hover:ring-2 hover:ring-guest-booked/30",
                  isCurrentDay && !booked && "ring-2 ring-guest-booked/45",
                  isRefreshing && "calendar-cell-refreshing"
                )}
                aria-label={`${format(day, "d MMMM")}: ${booked ? "занято" : "свободно"}`}
              >
                <span
                  className={cn(
                    "font-medium leading-none text-sm lg:text-lg tabular-nums transition-colors",
                    !inMonth && "text-guest-muted/40",
                    inMonth && (booked ? "text-guest-booked-foreground" : "text-guest-ink")
                  )}
                >
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
          if (!isPublicView && cellBg) {
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

            // Check if booking continues from/to outside visible grid
            const bookingContinuesFromBefore = (() => {
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
            
            const prevSame = (prevDayInGrid && prevStatus && sharesBookingWithPrev(status, prevStatus))
              || (!prevDayInGrid && bookingContinuesFromBefore);
            const nextSame = (nextDayInGrid && nextStatus && sharesBookingWithPrev(status, nextStatus))
              || (!nextDayInGrid && bookingContinuesToAfter);

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
                "relative flex flex-col items-center justify-center aspect-square text-xs lg:text-lg transition-all rounded-[var(--radius)]",
                !inMonth && !cellBg && "opacity-20 pointer-events-none",
                !inMonth && cellBg && "opacity-40 pointer-events-none",
                inMonth && !hasActiveBooking && "hover:bg-secondary",
                inMonth && isWeekend && !cellBg && "bg-muted/40",
                isInRange && "bg-primary/10",
                isRangeStart && "ring-2 ring-primary",
                isRangeEnd && "ring-2 ring-primary",
                isPublicView && isPast ? "" : cellBg,
                cellBg && "calendar-fade-in",
                cellBg && isRefreshing && isPublicView && "calendar-cell-refreshing",
                !isPublicView && cellBg && (
                  (filter === "green" && greenHasAvito) ? "avito-synced-green" :
                  (filter === "black" && blackHasAvito) ? "avito-synced-black" :
                  (filter === "all" && greenHasAvito && blackHasAvito) ? "avito-synced" :
                  (filter === "all" && greenHasAvito && !blackHasAvito) ? "avito-synced-green" :
                  (filter === "all" && !greenHasAvito && blackHasAvito) ? "avito-synced-black" :
                  ""
                ),
                // Today: inset outline
                isCurrentDay && "calendar-today-outline"
              )}
            >
              <span
                className={cn(
                  "font-semibold leading-none lg:text-lg relative z-10",
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
                <span className="absolute bottom-0.5 left-1 right-1 h-[2px] rounded-full bg-destructive z-10" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
