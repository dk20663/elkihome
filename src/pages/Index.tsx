import { useState, useCallback, useMemo } from "react";
import { format, addMonths, subMonths, parseISO, isSameDay, isAfter, isBefore } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Eye, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarGrid from "@/components/CalendarGrid";
import HouseFilter from "@/components/HouseFilter";
import MonthStats from "@/components/MonthStats";
import BookingForm from "@/components/BookingForm";
import BookingDetail from "@/components/BookingDetail";
import PublicCalendar from "@/components/PublicCalendar";
import AuthPage from "@/components/AuthPage";
import { useAuth } from "@/hooks/useAuth";
import { useHouses } from "@/hooks/useHouses";
import { useBookings, useCreateBooking, useUpdateBooking, useDeleteBooking } from "@/hooks/useBookings";
import type { HouseFilter as HouseFilterType, Booking, BookingFormData } from "@/lib/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function Index() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { data: houses = [], isLoading: housesLoading } = useHouses();
  const { data: bookings = [], isLoading: bookingsLoading } = useBookings();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const deleteBooking = useDeleteBooking();

  const [month, setMonth] = useState(new Date());
  const [filter, setFilter] = useState<HouseFilterType>("all");
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showPublic, setShowPublic] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });

  const handleDateClick = useCallback(
    (date: Date) => {
      // Check if date has bookings
      const dayBookings = bookings.filter((b) => {
        const checkIn = parseISO(b.check_in);
        const checkOut = parseISO(b.check_out);
        return (isAfter(date, checkIn) || isSameDay(date, checkIn)) && isBefore(date, checkOut);
      });

      // Filter by currently selected house filter
      const greenHouse = houses.find((h) => h.name === "GREEN");
      const blackHouse = houses.find((h) => h.name === "BLACK");
      const filtered = dayBookings.filter((b) => {
        if (filter === "all") return true;
        if (filter === "green") return greenHouse && b.house_id === greenHouse.id;
        return blackHouse && b.house_id === blackHouse.id;
      });

      if (filtered.length > 0) {
        setSelectedBooking(filtered[0]);
        setShowDetail(true);
        return;
      }

      // Range selection for new booking
      if (!selectedRange.start || selectedRange.end) {
        setSelectedRange({ start: date, end: null });
      } else {
        if (isBefore(date, selectedRange.start)) {
          setSelectedRange({ start: date, end: selectedRange.start });
        } else {
          setSelectedRange({ start: selectedRange.start, end: date });
        }
        setShowForm(true);
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

  const handleDeleteBooking = async () => {
    if (!selectedBooking) return;
    try {
      await deleteBooking.mutateAsync(selectedBooking.id);
      toast.success("Бронь удалена");
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

  if (!user) return <AuthPage />;

  if (showPublic) {
    return <PublicCalendar bookings={bookings} houses={houses} onClose={() => setShowPublic(false)} />;
  }

  const isLoading = housesLoading || bookingsLoading;

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <h1 className="text-lg font-bold leading-tight">Бронирования</h1>
          <p className="text-[10px] text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPublic(true)} title="Публичный вид">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut} title="Выйти">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Filter */}
      <div className="px-4 mb-3">
        <HouseFilter value={filter} onChange={setFilter} />
      </div>

      {/* Month Navigation */}
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

      {/* Calendar */}
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

      {/* Legend */}
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

      {/* Stats */}
      <div className="px-4 mb-4">
        {!isLoading && (
          <MonthStats month={month} bookings={bookings} houses={houses} filter={filter} />
        )}
      </div>

      {/* FAB */}
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

      {/* Booking Form */}
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
      />

      {/* Booking Detail */}
      <BookingDetail
        booking={selectedBooking}
        house={selectedHouse}
        open={showDetail}
        onClose={() => {
          setShowDetail(false);
          setSelectedBooking(null);
        }}
        onEdit={() => {
          setEditBooking(selectedBooking);
          setShowDetail(false);
          setShowForm(true);
        }}
        onDelete={handleDeleteBooking}
      />
    </div>
  );
}
