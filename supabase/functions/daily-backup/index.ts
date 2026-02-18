import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_CHAT_ID = 190449843;

function buildCsv(bookings: any[]): string {
  const headers = [
    "Дом", "Заезд", "Выезд", "Имя гостя", "Телефон", "Гостей",
    "Стоимость", "Источник", "Баня", "Купель", "Веники",
    "Пихтовая запарка", "Цитрусовая запарка", "Комментарий", "Отменено", "Создано",
  ];
  const bom = "\uFEFF";
  const rows = [headers.join(";")];
  for (const b of bookings) {
    const houseName = b.houses?.name || "";
    rows.push([
      houseName, b.check_in, b.check_out,
      `"${(b.guest_name || "").replace(/"/g, '""')}"`,
      b.guest_phone || "", b.guest_count, b.total_price,
      b.source || "",
      b.sauna ? "Да" : "Нет",
      b.plunge_pool ? "Да" : "Нет",
      b.bath_brooms ? "Да" : "Нет",
      b.fir_infusion ? "Да" : "Нет",
      b.citrus_infusion ? "Да" : "Нет",
      `"${(b.comment || "").replace(/"/g, '""').replace(/\n/g, " ")}"`,
      b.cancelled ? "Да" : "Нет",
      b.created_at,
    ].join(";"));
  }
  return bom + rows.join("\n");
}

async function sendFileToTelegram(botToken: string, chatId: number, csvContent: string, caption: string) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(csvContent);

  const formData = new FormData();
  formData.append("chat_id", String(chatId));
  formData.append("caption", caption);
  formData.append(
    "document",
    new Blob([bytes], { type: "text/csv" }),
    "bookings_backup.csv"
  );

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Telegram API error: ${JSON.stringify(err)}`);
  }
  return res.json();
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

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*, houses(name)")
      .order("check_in", { ascending: false });

    if (error) throw error;

    const csv = buildCsv(bookings || []);
    const now = new Date().toLocaleDateString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric",
      timeZone: "Europe/Moscow",
    });
    const active = (bookings || []).filter((b) => !b.cancelled).length;
    const cancelled = (bookings || []).filter((b) => b.cancelled).length;
    const caption = `🌙 Ночной бэкап ЁлкиHome\nДата: ${now}\n✅ Активных бронирований: ${active}\n❌ Отменённых: ${cancelled}\n📊 Всего записей: ${(bookings || []).length}`;

    await sendFileToTelegram(botToken, ADMIN_CHAT_ID, csv, caption);

    return new Response(JSON.stringify({ ok: true, count: (bookings || []).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Daily backup error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
