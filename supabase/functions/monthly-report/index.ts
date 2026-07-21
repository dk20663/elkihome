import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_CHAT_ID = 190449843;

interface ReportSettings {
  salary_green: number;
  salary_black: number;
  salary_sauna_bonus: number;
  salary_pool_bonus: number;
  laundry_per_guest: number;
  electricity_green: number;
  electricity_black: number;
  water_delivery_price: number;
  pools_per_delivery: number;
  firewood_per_pool: number;
}

const DEFAULT_SETTINGS: ReportSettings = {
  salary_green: 2250,
  salary_black: 2650,
  salary_sauna_bonus: 250,
  salary_pool_bonus: 500,
  laundry_per_guest: 500,
  electricity_green: 5000,
  electricity_black: 20000,
  water_delivery_price: 5500,
  pools_per_delivery: 4,
  firewood_per_pool: 1500,
};

function houseKind(name: string): "GREEN" | "BLACK" | "OTHER" {
  const n = (name || "").toUpperCase();
  if (n.includes("GREEN") || n.includes("ЗЕЛ")) return "GREEN";
  if (n.includes("BLACK") || n.includes("ЧЁР") || n.includes("ЧЕР")) return "BLACK";
  return "OTHER";
}

function salaryPerBooking(kind: "GREEN" | "BLACK" | "OTHER", sauna: boolean, pool: boolean, s: ReportSettings): number {
  const base = kind === "BLACK" ? s.salary_black : s.salary_green;
  return base + (sauna ? s.salary_sauna_bonus : 0) + (pool ? s.salary_pool_bonus : 0);
}

function fmt(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

function monthRange(partial: boolean, ref: Date): { start: Date; end: Date; label: string } {
  // ref — «сегодня» в МСК
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  if (partial) {
    const start = new Date(Date.UTC(y, m, 1));
    const end = new Date(Date.UTC(y, m, ref.getUTCDate() + 1)); // до завтра (включ. сегодня)
    return { start, end, label: `${format(start)} — ${format(new Date(Date.UTC(y, m, ref.getUTCDate())))} (текущий)` };
  }
  // Прошлый месяц целиком
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(y, m, 0));
  return { start, end, label: `${format(start)} — ${format(last)}` };
}

function format(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface HouseStats {
  name: string;
  kind: "GREEN" | "BLACK" | "OTHER";
  bookings: number;
  guests: number;
  sauna: number;
  pool: number;
  bath_brooms: number;
  fir_infusion: number;
  citrus_infusion: number;
  revenue: number;
  laundry: number;
  salary: number;
  electricity: number;
  water: number;
}

async function sendTelegram(botToken: string, chatId: number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram error: ${err}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* empty */ }
    const partial: boolean = !!body.partial;

    // МСК = UTC+3
    const nowMsk = new Date(Date.now() + 3 * 3600 * 1000);
    const { start, end, label } = monthRange(partial, nowMsk);

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*, houses(name)")
      .eq("cancelled", false)
      .gte("check_in", toISODate(start))
      .lt("check_in", toISODate(end));
    if (error) throw error;

    // Группируем по дому
    const byHouse = new Map<string, HouseStats>();
    for (const b of bookings || []) {
      const name = b.houses?.name || "—";
      const kind = houseKind(name);
      let s = byHouse.get(name);
      if (!s) {
        s = {
          name, kind,
          bookings: 0, guests: 0,
          sauna: 0, pool: 0,
          bath_brooms: 0, fir_infusion: 0, citrus_infusion: 0,
          revenue: 0, laundry: 0, salary: 0, electricity: 0, water: 0,
        };
        byHouse.set(name, s);
      }
      s.bookings += 1;
      s.guests += b.guest_count || 0;
      if (b.sauna) s.sauna += 1;
      if (b.plunge_pool) s.pool += 1;
      if (b.bath_brooms) s.bath_brooms += 1;
      if (b.fir_infusion) s.fir_infusion += 1;
      if (b.citrus_infusion) s.citrus_infusion += 1;
      s.revenue += Number(b.total_price) || 0;
      s.laundry += (b.guest_count || 0) * LAUNDRY_PER_GUEST;
      s.salary += salaryPerBooking(kind, !!b.sauna, !!b.plunge_pool);
    }

    // Расходы на электричество и воду
    for (const s of byHouse.values()) {
      if (s.kind === "GREEN") {
        s.electricity = ELECTRICITY.GREEN;
        s.water = Math.floor(s.pool / POOLS_PER_DELIVERY) * WATER_DELIVERY_PRICE;
      } else if (s.kind === "BLACK") {
        s.electricity = ELECTRICITY.BLACK;
      }
    }

    // Формируем текст
    const lines: string[] = [];
    lines.push(`📊 <b>Финансовый отчёт ЁлкиHome</b>`);
    lines.push(`🗓 Период: <b>${label}</b>`);
    lines.push("");

    let totalRevenue = 0, totalExpenses = 0;

    // Порядок: GREEN, BLACK, OTHER
    const order = [...byHouse.values()].sort((a, b) => {
      const rank = (k: string) => (k === "GREEN" ? 0 : k === "BLACK" ? 1 : 2);
      return rank(a.kind) - rank(b.kind);
    });

    for (const s of order) {
      const emoji = s.kind === "GREEN" ? "🌲" : s.kind === "BLACK" ? "🖤" : "🏠";
      const expenses = s.laundry + s.salary + s.electricity + s.water;
      const profit = s.revenue - expenses;
      totalRevenue += s.revenue;
      totalExpenses += expenses;

      lines.push(`${emoji} <b>${s.name}</b>`);
      lines.push(`━━━━━━━━━━━━━━━`);
      lines.push(`📅 Бронирований: <b>${s.bookings}</b>`);
      lines.push(`👥 Гостей: <b>${s.guests}</b>`);
      lines.push(`🧖 Баня: <b>${s.sauna}</b>`);
      lines.push(`🛁 Купель: <b>${s.pool}</b>`);
      lines.push(`🌿 Веники: <b>${s.bath_brooms}</b>  🌲 Пихта: <b>${s.fir_infusion}</b>  🍊 Цитрус: <b>${s.citrus_infusion}</b>`);
      lines.push("");
      lines.push(`💰 Выручка: <b>${fmt(s.revenue)} ₽</b>`);
      lines.push(`<i>Расходы:</i>`);
      lines.push(`  • Прачечная (${s.guests}×500): ${fmt(s.laundry)} ₽`);
      lines.push(`  • З/П персонала: ${fmt(s.salary)} ₽`);
      lines.push(`  • Электричество: ${fmt(s.electricity)} ₽`);
      if (s.kind === "GREEN") {
        const deliveries = Math.floor(s.pool / POOLS_PER_DELIVERY);
        lines.push(`  • Привозная вода (${deliveries}×5500): ${fmt(s.water)} ₽`);
      }
      lines.push(`  <b>Итого расходов: ${fmt(expenses)} ₽</b>`);
      lines.push(`${profit >= 0 ? "✅" : "⚠️"} <b>Прибыль: ${fmt(profit)} ₽</b>`);
      lines.push("");
    }

    if (order.length === 0) {
      lines.push("<i>За период нет активных бронирований.</i>");
      lines.push("");
    }

    const totalProfit = totalRevenue - totalExpenses;
    lines.push(`═══════════════`);
    lines.push(`<b>ИТОГО ПО ВСЕМ ДОМАМ</b>`);
    lines.push(`💰 Выручка: <b>${fmt(totalRevenue)} ₽</b>`);
    lines.push(`💸 Расходы: <b>${fmt(totalExpenses)} ₽</b>`);
    lines.push(`${totalProfit >= 0 ? "🟢" : "🔴"} <b>Прибыль: ${fmt(totalProfit)} ₽</b>`);

    await sendTelegram(botToken, ADMIN_CHAT_ID, lines.join("\n"));

    return new Response(JSON.stringify({ ok: true, houses: order.length, revenue: totalRevenue, profit: totalProfit }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Monthly report error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
