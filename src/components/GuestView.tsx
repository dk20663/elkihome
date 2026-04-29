import { useState, useEffect, useMemo } from "react";
import { format, addMonths, subMonths, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarGrid from "./CalendarGrid";
import HouseFilter from "./HouseFilter";
import GuestPriceDetail from "./GuestPriceDetail";
import { supabase } from "@/integrations/supabase/client";
import { readCache, writeCache } from "@/lib/persistCache";
import type { House, HouseFilter as HouseFilterType, Booking, HousePricing } from "@/lib/types";

const GUEST_HOUSES_KEY = "guest_houses";
const GUEST_BOOKINGS_KEY = "guest_bookings";
const GUEST_PRICING_KEY = "guest_pricing";

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
}

export default function GuestView({ onBack }: Props) {
  const [month, setMonth] = useState(new Date());
  const [filter, setFilter] = useState<HouseFilterType>("all");
  const [houses, setHouses] = useState<House[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pricing, setPricing] = useState<HousePricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showPrice, setShowPrice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Load houses first (small, fast) — calendar renders immediately
    supabase.from("houses").select("*").then(({ data }) => {
      if (!cancelled && data) setHouses(data as House[]);
    });
    // Load bookings + pricing in parallel, non-blocking
    Promise.all([
      supabase.from("public_bookings_view").select("*"),
      supabase.from("house_pricing").select("*"),
    ]).then(([bookingsRes, pricingRes]) => {
      if (cancelled) return;
      if (pricingRes.data) setPricing(pricingRes.data as HousePricing[]);
      if (bookingsRes.data) {
        setBookings(
          bookingsRes.data.map((b: any) => ({
            ...b,
            guest_name: "",
            guest_phone: "",
            comment: "",
            source: "",
            guest_count: 0,
            sauna: false,
            plunge_pool: false,
            bath_brooms: false,
            fir_infusion: false,
            citrus_infusion: false,
            created_by: null,
            created_at: "",
            updated_at: "",
          })) as Booking[]
        );
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Track visitor
  useEffect(() => {
    const trackVisit = async () => {
      const today = getLocalDateKey(new Date());
      const lastTrackedDate = localStorage.getItem(LAST_VISIT_DATE_KEY);

      if (lastTrackedDate === today) {
        return;
      }

      let visitorId = localStorage.getItem(VISITOR_ID_KEY);
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem(VISITOR_ID_KEY, visitorId);
      }

      const { error } = await supabase.from("page_visits").insert({
        visitor_id: visitorId,
        visited_at: today,
      });

      if (!error) {
        localStorage.setItem(LAST_VISIT_DATE_KEY, today);
        return;
      }

      const isDuplicate = error.code === "23505" || error.message.includes("duplicate") || error.message.includes("unique");

      if (isDuplicate) {
        localStorage.setItem(LAST_VISIT_DATE_KEY, today);
        return;
      }

      if (!isDuplicate) {
        console.error("Visit tracking failed:", error.message);
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
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
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
          onDateClick={handleDateClick}
          selectedRange={{ start: null, end: null }}
          isPublicView
          bookingsLoading={loading}
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
