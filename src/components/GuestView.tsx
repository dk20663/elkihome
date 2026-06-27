import { useState, useEffect } from "react";
import { format, addMonths, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarGrid from "./CalendarGrid";
import HouseFilter from "./HouseFilter";
import GuestPriceDetail from "./GuestPriceDetail";
import { supabase } from "@/integrations/supabase/client";
import { loadSnapshot, readCachedSnapshot } from "@/lib/snapshot";
import type { House, HouseFilter as HouseFilterType, Booking, HousePricing } from "@/lib/types";

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

export default function GuestView({ onBack, hideBack = false }: Props) {
  const [month, setMonth] = useState(new Date());
  const [filter, setFilter] = useState<HouseFilterType>("all");

  // Мгновенный рендер из локального кэша снапшота
  const cached = readCachedSnapshot();
  const [houses, setHouses] = useState<House[]>(cached?.data.houses ?? []);
  const [bookings, setBookings] = useState<Booking[]>(cached?.data.bookings ?? []);
  const [pricing, setPricing] = useState<HousePricing[]>(cached?.data.pricing ?? []);
  const [bookingsLoading, setBookingsLoading] = useState(!cached);
  const [isRefreshing, setIsRefreshing] = useState(!cached?.isFresh);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showPrice, setShowPrice] = useState(false);

  // Один запрос — статический snapshot.json с того же CDN, что и виджет.
  // Никаких обращений к Supabase / Cloudflare Worker из браузера.
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

  // Трекинг посетителя — write-only, не блокирует UI, тихо игнорируется при недоступности Supabase
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
        /* ignore — аналитика не критична */
      }
    };
    trackVisit();
  }, []);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowPrice(true);
  };

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col lg:max-w-5xl max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-4">
        {!hideBack && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-lg font-bold leading-tight">Календарь загрузки</h1>
          <p className="text-sm font-medium text-foreground/70">
            Нажмите на дату, чтобы увидеть цены
          </p>
        </div>
      </div>

      <div className="mb-3">
        <HouseFilter value={filter} onChange={setFilter} />
      </div>

      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" onClick={() => setMonth(subMonths(month, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-semibold capitalize flex items-center gap-1.5">
          {format(month, "LLLL yyyy", { locale: ru })}
          {isRefreshing && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Обновление данных" />
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
          filter={filter}
          onDateClick={handleDateClick}
          selectedRange={{ start: null, end: null }}
          isPublicView
          bookingsLoading={bookingsLoading}
          isRefreshing={isRefreshing}
        />
      </div>

      <div className="flex gap-4 justify-center mt-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="font-bold text-house-green text-sm leading-none">✓</span> свободно
        </span>
        <span className="flex items-center gap-1">
          <span className="text-destructive text-sm leading-none">🔒</span> занято
        </span>
        <span className="flex items-center gap-1">
          <span className="font-bold text-house-green">G</span>
          <span className="font-bold text-foreground/80">B</span> — дома
        </span>
      </div>

      <GuestPriceDetail
        date={selectedDate}
        houses={houses}
        filter={filter}
        open={showPrice}
        onClose={() => setShowPrice(false)}
        bookings={bookings}
        pricing={pricing}
      />
    </div>
  );
}
