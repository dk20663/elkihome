import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarDays, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  open: boolean;
  onClose: () => void;
  dateRange: { start: Date | null; end: Date | null };
  onAddBooking: () => void;
  onEditPrice: () => void;
}

export default function DateActionDialog({ open, onClose, dateRange, onAddBooking, onEditPrice }: Props) {
  if (!dateRange.start) return null;

  const label = dateRange.end
    ? `${format(dateRange.start, "d MMM", { locale: ru })} — ${format(dateRange.end, "d MMM", { locale: ru })}`
    : format(dateRange.start, "d MMMM yyyy", { locale: ru });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{label}</SheetTitle>
          <p className="text-xs text-muted-foreground">Выберите действие</p>
        </SheetHeader>
        <div className="flex flex-col gap-3 pt-4">
          <Button
            variant="outline"
            className="h-14 justify-start gap-3 text-sm"
            onClick={() => { onClose(); onAddBooking(); }}
          >
            <CalendarDays className="h-5 w-5" />
            <div className="text-left">
              <div className="font-semibold">Добавить бронирование</div>
              <div className="text-xs text-muted-foreground">Создать новый заезд на эти даты</div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="h-14 justify-start gap-3 text-sm"
            onClick={() => { onClose(); onEditPrice(); }}
          >
            <DollarSign className="h-5 w-5" />
            <div className="text-left">
              <div className="font-semibold">Изменить цену</div>
              <div className="text-xs text-muted-foreground">Установить особую цену на выбранные даты</div>
            </div>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
