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
      const todayStr = now.toISOString().slice(0, 10);
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);

      const [todayRes, weekRes, monthRes, totalRes] = await Promise.all([
        supabase.from("page_visits").select("visitor_id", { count: "exact", head: true }).eq("visited_at", todayStr),
        supabase.from("page_visits").select("visitor_id", { count: "exact", head: true }).gte("visited_at", weekAgo),
        supabase.from("page_visits").select("visitor_id", { count: "exact", head: true }).gte("visited_at", monthAgo),
        supabase.from("page_visits").select("visitor_id", { count: "exact", head: true }),
      ]);

      setStats({
        today: todayRes.count ?? 0,
        week: weekRes.count ?? 0,
        month: monthRes.count ?? 0,
        total: totalRes.count ?? 0,
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
