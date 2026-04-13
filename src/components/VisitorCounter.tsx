import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function loadAllVisits() {
  const visits: Array<{ visitor_id: string; visited_at: string }> = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("page_visits")
      .select("visitor_id, visited_at")
      .order("visited_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const batch = data ?? [];
    visits.push(...batch);

    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return visits;
}

export default function VisitorCounter() {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<{
    today: number;
    week: number;
    month: number;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStr = getLocalDateKey(now);
      const weekAgoDate = new Date(now);
      weekAgoDate.setDate(weekAgoDate.getDate() - 6);
      const monthAgoDate = new Date(now);
      monthAgoDate.setDate(monthAgoDate.getDate() - 29);
      const weekAgo = getLocalDateKey(weekAgoDate);
      const monthAgo = getLocalDateKey(monthAgoDate);

      const visits = await loadAllVisits();
      const todayVisitors = new Set<string>();
      const weekVisitors = new Set<string>();
      const monthVisitors = new Set<string>();
      const totalVisitors = new Set<string>();

      for (const visit of visits) {
        totalVisitors.add(visit.visitor_id);

        if (visit.visited_at === todayStr) {
          todayVisitors.add(visit.visitor_id);
        }

        if (visit.visited_at >= weekAgo) {
          weekVisitors.add(visit.visitor_id);
        }

        if (visit.visited_at >= monthAgo) {
          monthVisitors.add(visit.visitor_id);
        }
      }

      setStats({
        today: todayVisitors.size,
        week: weekVisitors.size,
        month: monthVisitors.size,
        total: totalVisitors.size,
      });
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) loadStats();
  }, [open]);

  return (
    <>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(true)} title="Посетители">
        <Users className="h-4 w-4" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Статистика посещений</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 pt-4">
            {loading ? (
              <p className="col-span-2 text-sm text-muted-foreground text-center py-4">Загрузка...</p>
            ) : stats ? (
              <>
                <StatCard label="Сегодня" value={stats.today} />
                <StatCard label="7 дней" value={stats.week} />
                <StatCard label="30 дней" value={stats.month} />
                <StatCard label="Всего" value={stats.total} />
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
