import { useMemo } from "react";
import { startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isBefore, isAfter, isSameDay } from "date-fns";
import type { Booking, House, HouseFilter } from "@/lib/types";

interface Props {
  month: Date;
  bookings: Booking[];
  houses: House[];
  filter: HouseFilter;
}

export default function MonthStats({ month, bookings, houses, filter }: Props) {
  const stats = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days = eachDayOfInterval({ start, end });
    
    const greenHouse = houses.find(h => h.name === "GREEN");
    const blackHouse = houses.find(h => h.name === "BLACK");

    let greenOccupied = 0;
    let blackOccupied = 0;

    days.forEach(day => {
      bookings.forEach(b => {
        const checkIn = parseISO(b.check_in);
        const checkOut = parseISO(b.check_out);
        const inRange = (isAfter(day, checkIn) || isSameDay(day, checkIn)) && isBefore(day, checkOut);
        if (!inRange || b.cancelled) return;
        if (greenHouse && b.house_id === greenHouse.id) greenOccupied++;
        if (blackHouse && b.house_id === blackHouse.id) blackOccupied++;
      });
    });

    const total = days.length;
    return {
      total,
      greenOccupied,
      greenFree: total - greenOccupied,
      blackOccupied,
      blackFree: total - blackOccupied,
    };
  }, [month, bookings, houses]);

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {(filter === "all" || filter === "green") && (
        <div className="rounded-xl bg-house-green/10 p-3 border border-house-green/20">
          <div className="font-semibold text-house-green mb-1">GREEN</div>
          <div className="flex justify-between text-muted-foreground">
            <span>Занято: <strong className="text-foreground">{stats.greenOccupied}</strong></span>
            <span>Свободно: <strong className="text-foreground">{stats.greenFree}</strong></span>
          </div>
        </div>
      )}
      {(filter === "all" || filter === "black") && (
        <div className="rounded-xl bg-house-black/10 p-3 border border-house-black/20">
          <div className="font-semibold text-house-black mb-1">BLACK</div>
          <div className="flex justify-between text-muted-foreground">
            <span>Занято: <strong className="text-foreground">{stats.blackOccupied}</strong></span>
            <span>Свободно: <strong className="text-foreground">{stats.blackFree}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
