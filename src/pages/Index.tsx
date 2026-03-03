import { useState, useCallback, useMemo } from "react";
import { format, addMonths, subMonths, parseISO, isSameDay, isAfter, isBefore } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Eye, LogOut, Settings, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarGrid from "@/components/CalendarGrid";
import HouseFilter from "@/components/HouseFilter";
import MonthStats from "@/components/MonthStats";
import BookingForm from "@/components/BookingForm";
import BookingDetail from "@/components/BookingDetail";
import PublicCalendar from "@/components/PublicCalendar";
import PriceSettings from "@/components/PriceSettings";
import RoleSelection from "@/components/RoleSelection";
import GuestView from "@/components/GuestView";
import CancelledBookingsSheet from "@/components/CancelledBookingsSheet";
import DateActionDialog from "@/components/DateActionDialog";
import DatePriceEditor from "@/components/DatePriceEditor";
import AuthPage from "@/components/AuthPage";
import { useAuth } from "@/hooks/useAuth";
import { useHouses } from "@/hooks/useHouses";
import { useBookings, useCreateBooking, useUpdateBooking, useCancelBooking } from "@/hooks/useBookings";
import type { HouseFilter as HouseFilterType, Booking, BookingFormData } from "@/lib/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const [role, setRole] = useState<"guest" | "admin" | null>(
    () => localStorage.getItem("elkihome_role") as "guest" | "admin" | null
  );

  const handleSelectRole = (r: "guest" | "admin") => {
    localStorage.setItem("elkihome_role", r);
    setRole(r);
  };

  const handleBackToRoleSelect = () => {
    localStorage.removeItem("elkihome_role");
    setRole(null);
  };

  if (!role) {
    return <RoleSelection onSelectRole={handleSelectRole} />;
  }

  if (role === "guest") {
    return <GuestView onBack={handleBackToRoleSelect} />;
  }

  return <AdminView onBackToRoles={handleBackToRoleSelect} />;
}

function AdminView({ onBackToRoles }: { onBackToRoles: () => void }) {
  const { user, telegramUser, loading: authLoading, signOut } = useAuth();

  const { data: houses = [], isLoading: housesLoading } = useHouses();
  const { data: bookings = [], isLoading: bookingsLoading } = useBookings();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const cancelBooking = useCancelBooking();

  const [month, setMonth] = useState(new Date());
  const [filter, setFilter] = useState<HouseFilterType>("all");
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showPublic, setShowPublic] = useState(false);
  const [showPriceSettings, setShowPriceSettings] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });
  const [cancelledForDate, setCancelledForDate] = useState<Booking[]>([]);
  const [allActiveDateBookings, setAllActiveDateBookings] = useState<Booking[]>([]);
  const [showCancelled, setShowCancelled] = useState(false);
  const [cancelledClickedDate, setCancelledClickedDate] = useState<Date | null>(null);
  const [showDateAction, setShowDateAction] = useState(false);
  const [showPriceEditor, setShowPriceEditor] = useState(false);
  const handleDateClick = useCallback(
    (date: Date) => {
      const dayBookings = bookings.filter((b) => {
        const checkIn = parseISO(b.check_in);
        const checkOut = parseISO(b.check_out);
        return (isAfter(date, checkIn) || isSameDay(date, checkIn)) && isBefore(date, checkOut);
      });

      const greenHouse = houses.find((h) => h.name === "GREEN");
      const blackHouse = houses.find((h) => h.name === "BLACK");
      const filtered = dayBookings.filter((b) => {
        if (filter === "all") return true;
        if (filter === "green") return greenHouse && b.house_id === greenHouse.id;
        return blackHouse && b.house_id === blackHouse.id;
      });

      const activeBookings = filtered.filter((b) => !b.cancelled);
      const cancelledBookings = filtered.filter((b) => b.cancelled);

      // If active bookings exist, show them
      if (activeBookings.length > 0) {
        // In "all" mode with multiple bookings, show all via a list
        setSelectedBooking(activeBookings[0]);
        setAllActiveDateBookings(activeBookings);
        setShowDetail(true);
        setCancelledForDate(cancelledBookings);
        return;
      }

      // If only cancelled bookings, store them and show cancelled sheet (not form yet)
      if (cancelledBookings.length > 0) {
        setCancelledForDate(cancelledBookings);
        setCancelledClickedDate(date);
        setShowCancelled(true);
        // Reset range so next click starts fresh
        setSelectedRange({ start: null, end: null });
        return;
      }

      // Range selection for new booking (only when no cancelled bookings on this date)
      if (!selectedRange.start || selectedRange.end) {
        setSelectedRange({ start: date, end: null });
      } else if (isSameDay(date, selectedRange.start)) {
        // Double-click on same date — open action dialog for single date
        setShowDateAction(true);
      } else {
        if (isBefore(date, selectedRange.start)) {
          setSelectedRange({ start: date, end: selectedRange.start });
        } else {
          setSelectedRange({ start: selectedRange.start, end: date });
        }
        setShowDateAction(true);
      }
    },
    [bookings, houses, filter, selectedRange]
  );

  const handleCreateBooking = async (data: BookingFormData) => {
    try {
      await createBooking.mutateAsync(data);
      toast.success("Бронь создана");
      setShowForm(false);
      setSelectedRange({ start: null, end: null });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdateBooking = async (data: BookingFormData) => {
    if (!editBooking) return;
    try {
      await updateBooking.mutateAsync({ ...data, id: editBooking.id });
      toast.success("Бронь обновлена");
      setShowForm(false);
      setEditBooking(null);
      setShowDetail(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    try {
      await cancelBooking.mutateAsync(selectedBooking.id);
      toast.success("Заезд отменён");
      setShowDetail(false);
      setSelectedBooking(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const selectedHouse = useMemo(() => {
    if (!selectedBooking) return null;
    return houses.find((h) => h.id === selectedBooking.house_id) || null;
  }, [selectedBooking, houses]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (!user) return <AuthPage onBack={onBackToRoles} />;

  if (showPublic) {
    return <PublicCalendar bookings={bookings} houses={houses} onClose={() => setShowPublic(false)} />;
  }

  if (showPriceSettings) {
    return <PriceSettings houses={houses} onClose={() => setShowPriceSettings(false)} />;
  }

  if (showPriceEditor && selectedRange.start) {
    return (
      <DatePriceEditor
        houses={houses}
        dateRange={{ start: selectedRange.start, end: selectedRange.end }}
        onClose={() => {
          setShowPriceEditor(false);
          setSelectedRange({ start: null, end: null });
        }}
      />
    );
  }

  const isLoading = housesLoading || bookingsLoading;
  const displayName = telegramUser?.first_name || telegramUser?.username || user.email;

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto flex flex-col">
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <h1 className="text-lg font-bold leading-tight">Бронирования</h1>
          <p className="text-[10px] text-muted-foreground">{displayName}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-telegram-export`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${session?.access_token}`,
                    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                    "Content-Type": "application/json",
                  },
                }
              );
              if (!res.ok) throw new Error("Export failed");
              toast.success("Файл отправлен в Телеграм");
            } catch (err: any) {
              toast.error(err.message);
            }
          }} title="Выгрузить данные">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPriceSettings(true)} title="Настройки цен">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPublic(true)} title="Публичный вид">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
            signOut();
            onBackToRoles();
          }} title="Выйти">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="px-4 mb-3">
        <HouseFilter value={filter} onChange={setFilter} />
      </div>

      <div className="flex items-center justify-between px-4 mb-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(subMonths(month, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-semibold capitalize">
          {format(month, "LLLL yyyy", { locale: ru })}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="px-4 mb-3">
        {isLoading ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : (
          <div className="bg-card rounded-2xl p-3 shadow-sm border border-border/50">
            <CalendarGrid
              month={month}
              bookings={bookings}
              houses={houses}
              filter={filter}
              onDateClick={handleDateClick}
              selectedRange={selectedRange}
            />
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-center mb-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-house-green" /> GREEN
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-house-black" /> BLACK
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded border border-border bg-background" /> Свободно
        </span>
      </div>

      <div className="px-4 mb-4">
        {!isLoading && (
          <MonthStats month={month} bookings={bookings} houses={houses} filter={filter} />
        )}
      </div>

      <div className="fixed bottom-6 right-6 z-50 max-w-md">
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={() => {
            setEditBooking(null);
            setSelectedRange({ start: null, end: null });
            setShowForm(true);
          }}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <BookingForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditBooking(null);
          setSelectedRange({ start: null, end: null });
        }}
        houses={houses}
        onSubmit={editBooking ? handleUpdateBooking : handleCreateBooking}
        initialData={editBooking}
        defaultDates={selectedRange}
        loading={createBooking.isPending || updateBooking.isPending}
        currentFilter={filter}
      />

      <BookingDetail
        booking={selectedBooking}
        house={selectedHouse}
        open={showDetail}
        onClose={() => {
          setShowDetail(false);
          setSelectedBooking(null);
          setAllActiveDateBookings([]);
        }}
        onEdit={() => {
          setEditBooking(selectedBooking);
          setShowDetail(false);
          setShowForm(true);
        }}
        onCancel={handleCancelBooking}
        cancelledBookings={cancelledForDate}
        houses={houses}
        onShowCancelled={() => {
          setShowDetail(false);
          setShowCancelled(true);
        }}
        allActiveBookings={allActiveDateBookings}
        onSelectBooking={(b) => {
          setSelectedBooking(b);
        }}
      />

      <CancelledBookingsSheet
        bookings={cancelledForDate}
        houses={houses}
        open={showCancelled}
        onClose={() => setShowCancelled(false)}
        onAddBooking={() => {
          setEditBooking(null);
          setSelectedRange({ start: cancelledClickedDate, end: null });
          setShowForm(true);
        }}
      />

      <DateActionDialog
        open={showDateAction}
        onClose={() => {
          setShowDateAction(false);
          setSelectedRange({ start: null, end: null });
        }}
        dateRange={selectedRange}
        onAddBooking={() => {
          setShowDateAction(false);
          setShowForm(true);
        }}
        onEditPrice={() => {
          setShowDateAction(false);
          setShowPriceEditor(true);
        }}
      />
    </div>
  );
}
