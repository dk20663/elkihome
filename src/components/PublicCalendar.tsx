import { useState } from "react";
import { format, addMonths, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarGrid from "./CalendarGrid";
import HouseFilter from "./HouseFilter";
import type { Booking, House, HouseFilter as HouseFilterType } from "@/lib/types";

interface Props {
  bookings: Booking[];
  houses: House[];
  onClose: () => void;
}

export default function PublicCalendar({ bookings, houses, onClose }: Props) {
  const [month, setMonth] = useState(new Date());
  const [filter, setFilter] = useState<HouseFilterType>("green");

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col max-w-md mx-auto">
      <div className="text-center mb-4">
        <h1 className="text-lg font-bold">Календарь загрузки</h1>
        <p className="text-xs text-muted-foreground">Дом {filter === "green" ? "GREEN" : filter === "black" ? "BLACK" : "GREEN & BLACK"}</p>
      </div>

      <div className="mb-3">
        <HouseFilter value={filter} onChange={setFilter} />
      </div>

      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" onClick={() => setMonth(subMonths(month, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-semibold capitalize">
          {format(month, "LLLL yyyy", { locale: ru })}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="bg-card rounded-2xl p-3 shadow-sm border border-border/50">
        <CalendarGrid
          month={month}
          bookings={bookings}
          houses={houses}
          filter={filter}
          onDateClick={() => {}}
          selectedRange={{ start: null, end: null }}
          isPublicView
        />
      </div>

      <div className="flex gap-3 justify-center mt-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-house-green" /> GREEN
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-house-black" /> BLACK
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-background border border-border" /> Свободно
        </span>
      </div>

      <Button variant="outline" className="mt-6" onClick={onClose}>
        Назад
      </Button>
    </div>
  );
}
