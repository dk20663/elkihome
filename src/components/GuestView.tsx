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
      <div className="min-h-screen bg-guest-bg p-4 sm:p-6 flex flex-col lg:max-w-3xl max-w-md mx-auto">
        {!hideBack && (
          <div className="mb-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-guest-ink" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
        )}
        <div className="flex-1 flex flex-col justify-center py-8">
          <div className="text-center mb-8">
            <p className="text-[11px] uppercase tracking-[0.25em] text-guest-muted mb-3">Elki Home</p>
            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-guest-ink mb-2">
              Выберите дом
            </h1>
            <p className="text-sm lg:text-base text-guest-muted">
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
                    "group relative overflow-hidden rounded-3xl p-8 lg:p-10 text-left text-white",
                    "transition-all duration-300 hover:-translate-y-1 active:translate-y-0",
                    "shadow-[0_18px_40px_-24px_hsl(var(--guest-ink)/0.7)] hover:shadow-[0_26px_50px_-24px_hsl(var(--guest-ink)/0.8)]",
                    isGreen ? "bg-guest-booked" : "bg-[hsl(155_10%_13%)]"
                  )}
                >
                  <div className="text-[11px] uppercase tracking-[0.25em] opacity-70 mb-2">Дом</div>
                  <div className="text-4xl lg:text-5xl font-semibold tracking-tight mb-6">
                    {isGreen ? "GREEN" : "BLACK"}
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm opacity-90 transition-transform duration-300 group-hover:translate-x-1">
                    Смотреть календарь
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs text-guest-muted mt-8">
            Вы сможете в любой момент вернуться и выбрать другой дом
          </p>
        </div>
      </div>
    );
  }

  // ============ Экран календаря выбранного дома ============
  const houseLabel = selectedHouse === "green" ? "GREEN" : "BLACK";

  return (
    <div className="min-h-screen bg-guest-bg p-4 sm:p-6 flex flex-col lg:max-w-3xl max-w-md mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={() => setSelectedHouse(null)}
          className="inline-flex items-center gap-2 rounded-full bg-guest-surface px-4 py-2 text-sm font-medium text-guest-ink border border-guest-line transition-colors hover:bg-guest-cell"
        >
          <ArrowLeft className="h-4 w-4" />
          Другой дом
        </button>
        <span className="inline-flex items-center gap-2 rounded-full bg-guest-booked px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-guest-booked-foreground">
          {houseLabel}
        </span>
      </div>

      <div className="rounded-[28px] bg-guest-surface border border-guest-line p-4 sm:p-6 shadow-[0_24px_60px_-40px_hsl(var(--guest-ink)/0.6)]">
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => setMonth(subMonths(month, 1))}
            className="h-11 w-11 rounded-full border border-guest-line flex items-center justify-center text-guest-ink transition-colors hover:bg-guest-cell"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-xl lg:text-2xl font-semibold capitalize text-guest-ink flex items-center gap-2 tracking-tight">
            {format(month, "LLLL yyyy", { locale: ru })}
            {isRefreshing && (
              <Loader2 className="h-4 w-4 animate-spin text-guest-muted" aria-label="Обновление" />
            )}
          </span>
          <button
            onClick={() => setMonth(addMonths(month, 1))}
            className="h-11 w-11 rounded-full border border-guest-line flex items-center justify-center text-guest-ink transition-colors hover:bg-guest-cell"
            aria-label="Следующий месяц"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <p className="text-center text-sm text-guest-muted mb-5">
          Нажмите на дату, чтобы узнать подробности
        </p>

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

        <div className="flex flex-wrap gap-5 justify-center mt-6 pt-5 border-t border-guest-line text-sm text-guest-muted">
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full bg-guest-cell border border-guest-line" />
            Свободно
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full bg-guest-booked" />
            Забронировано
          </span>
        </div>
      </div>

      <p className="text-center text-xs text-guest-muted mt-4">
        Нажмите на дату, чтобы увидеть цены
      </p>

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

