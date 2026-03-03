import { useState, useEffect, useMemo } from "react";
import { format, addMonths, subMonths, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarGrid from "./CalendarGrid";
import HouseFilter from "./HouseFilter";
import GuestPriceDetail from "./GuestPriceDetail";
import { supabase } from "@/integrations/supabase/client";
import type { House, HouseFilter as HouseFilterType, Booking, HousePricing } from "@/lib/types";

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
    async function load() {
      const [housesRes, bookingsRes, pricingRes] = await Promise.all([
        supabase.from("houses").select("*"),
        supabase.from("public_bookings_view").select("*"),
        supabase.from("house_pricing").select("*"),
      ]);
      if (housesRes.data) setHouses(housesRes.data as House[]);
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
    }
    load();
  }, []);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowPrice(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col max-w-md mx-auto">
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
