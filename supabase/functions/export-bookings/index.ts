import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all bookings with house info
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*, houses(name)")
      .order("check_in", { ascending: false });

    if (error) throw error;

    const headers = [
      "Дом",
      "Заезд",
      "Выезд",
      "Имя гостя",
      "Телефон",
      "Гостей",
      "Стоимость",
      "Источник",
      "Баня",
      "Купель",
      "Веники",
      "Пихтовая запарка",
      "Цитрусовая запарка",
      "Комментарий",
      "Отменено",
      "Создано",
    ];

    const bom = "\uFEFF";
    const csvRows = [headers.join(";")];

    for (const b of bookings || []) {
      const houseName = (b as any).houses?.name || "";
      const row = [
        houseName,
        b.check_in,
        b.check_out,
        `"${(b.guest_name || "").replace(/"/g, '""')}"`,
        b.guest_phone || "",
        b.guest_count,
        b.total_price,
        b.source || "",
        b.sauna ? "Да" : "Нет",
        b.plunge_pool ? "Да" : "Нет",
        b.bath_brooms ? "Да" : "Нет",
        b.fir_infusion ? "Да" : "Нет",
        b.citrus_infusion ? "Да" : "Нет",
        `"${(b.comment || "").replace(/"/g, '""').replace(/\n/g, " ")}"`,
        b.cancelled ? "Да" : "Нет",
        b.created_at,
      ];
      csvRows.push(row.join(";"));
    }

    const csv = bom + csvRows.join("\n");

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="bookings.csv"',
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Export failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
