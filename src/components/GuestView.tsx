import { useState, useEffect } from "react";
import { format, addMonths, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarGrid from "./CalendarGrid";
import GuestPriceDetail from "./GuestPriceDetail";
import { supabase } from "@/integrations/supabase/client";
import { loadSnapshot, readCachedSnapshot } from "@/lib/snapshot";
import { cn } from "@/lib/utils";
import type { House, Booking, HousePricing } from "@/lib/types";

const VISITOR_ID_KEY = "elkihome_visitor_id";
const LAST_VISIT_DATE_KEY = "elkihome_last_visit_date";

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface Props {
  onBack: () => void;
  hideBack?: boolean;
}

type SelectedHouse = "green" | "black" | null;

export default function GuestView({ onBack, hideBack = false }: Props) {
  const [month, setMonth] = useState(new Date());
  const [selectedHouse, setSelectedHouse] = useState<SelectedHouse>(null);

  // Мгновенный рендер из локального кэша снапшота
  const cached = readCachedSnapshot();
  const [houses, setHouses] = useState<House[]>(cached?.data.houses ?? []);
  const [bookings, setBookings] = useState<Booking[]>(cached?.data.bookings ?? []);
  const [pricing, setPricing] = useState<HousePricing[]>(cached?.data.pricing ?? []);
  const [bookingsLoading, setBookingsLoading] = useState(!cached);
  const [isRefreshing, setIsRefreshing] = useState(!cached?.isFresh);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showPrice, setShowPrice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSnapshot().then((snap) => {
      if (cancelled || !snap) {
        if (!cancelled) {
          setBookingsLoading(false);
          setIsRefreshing(false);
        }
        return;
      }
      setHouses(snap.houses);
      setBookings(snap.bookings);
      setPricing(snap.pricing);
      setBookingsLoading(false);
      setIsRefreshing(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const trackVisit = async () => {
      const today = getLocalDateKey(new Date());
      const lastTrackedDate = localStorage.getItem(LAST_VISIT_DATE_KEY);
      if (lastTrackedDate === today) return;

      let visitorId = localStorage.getItem(VISITOR_ID_KEY);
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem(VISITOR_ID_KEY, visitorId);
      }

      try {
        const { error } = await supabase
          .from("page_visits")
          .insert({ visitor_id: visitorId, visited_at: today });
        if (!error || error.code === "23505" || error.message?.includes("duplicate")) {
          localStorage.setItem(LAST_VISIT_DATE_KEY, today);
        }
      } catch {
        /* ignore */
      }
    };
    trackVisit();
  }, []);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowPrice(true);
  };

  // ============ Экран выбора дома ============
  if (!selectedHouse) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col lg:max-w-3xl max-w-md mx-auto">
        {!hideBack && (
          <div className="mb-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
        )}
        <div className="flex-1 flex flex-col justify-center py-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold mb-2">Выберите дом</h1>
            <p className="text-sm lg:text-base text-muted-foreground">
              Чтобы посмотреть свободные даты и цены
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {(["green", "black"] as const).map((h) => {
              const isGreen = h === "green";
              return (
                <button
                  key={h}
                  onClick={() => setSelectedHouse(h)}
                  className={cn(
                    "group relative overflow-hidden rounded-3xl p-8 lg:p-10 text-left transition-all hover:scale-[1.02] active:scale-[0.99] shadow-lg hover:shadow-xl",
                    isGreen
                      ? "bg-house-green text-white"
                      : "bg-house-black text-white"
                  )}
                >
                  <div className="text-xs uppercase tracking-widest opacity-80 mb-2">
                    Дом
                  </div>
                  <div className="text-4xl lg:text-5xl font-black tracking-tight mb-4">
                    {isGreen ? "GREEN" : "BLACK"}
                  </div>
                  <div className="text-sm opacity-90">
                    Смотреть календарь →
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            Вы сможете в любой момент вернуться и выбрать другой дом
          </p>
        </div>
      </div>
    );
  }

  // ============ Экран календаря выбранного дома ============
  const houseLabel = selectedHouse === "green" ? "GREEN" : "BLACK";
  const isGreen = selectedHouse === "green";

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col lg:max-w-5xl max-w-md mx-auto">
      {/* Заметная кнопка возврата к выбору дома */}
      <button
        onClick={() => setSelectedHouse(null)}
        className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/70 transition-colors text-sm font-semibold text-foreground self-start"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад к выбору дома
      </button>

      {/* Крупный заголовок текущего дома */}
      <div
        className={cn(
          "rounded-2xl p-4 mb-4 flex items-center gap-3 shadow-sm",
          isGreen ? "bg-house-green text-white" : "bg-house-black text-white"
        )}
      >
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-widest opacity-80">
            Календарь дома
          </div>
          <div className="text-2xl lg:text-3xl font-black tracking-tight">
            {houseLabel}
          </div>
        </div>
        <p className="text-xs opacity-90 max-w-[140px] text-right hidden sm:block">
          Нажмите на дату, чтобы увидеть цены
        </p>
      </div>

      <p className="text-xs text-muted-foreground text-center mb-3 sm:hidden">
        Нажмите на дату, чтобы увидеть цены
      </p>

      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" onClick={() => setMonth(subMonths(month, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-base font-bold capitalize flex items-center gap-1.5">
          {format(month, "LLLL yyyy", { locale: ru })}
          {isRefreshing && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Обновление" />
          )}
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
          filter={selectedHouse}
          onDateClick={handleDateClick}
          selectedRange={{ start: null, end: null }}
          isPublicView
          bookingsLoading={bookingsLoading}
          isRefreshing={isRefreshing}
        />
      </div>

      <div className="flex gap-6 justify-center mt-4 text-sm text-foreground/80">
        <span className="flex items-center gap-1.5">
          <span className="text-lg leading-none">✅</span>
          <span className="font-medium">свободно</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-lg leading-none">🔒</span>
          <span className="font-medium">занято</span>
        </span>
      </div>

      {/* Дублирующая кнопка возврата внизу для длинных страниц */}
      <button
        onClick={() => setSelectedHouse(null)}
        className="mt-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-border hover:bg-secondary transition-colors text-sm font-semibold"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад к выбору дома
      </button>

      <GuestPriceDetail
        date={selectedDate}
        houses={houses}
        filter={selectedHouse}
        open={showPrice}
        onClose={() => setShowPrice(false)}
        bookings={bookings}
        pricing={pricing}
      />
    </div>
  );
}
