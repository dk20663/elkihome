import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const houseName = (url.searchParams.get("house") || "").toUpperCase();

    if (!houseName || !["GREEN", "BLACK"].includes(houseName)) {
      return new Response("Missing or invalid 'house' param (green or black)", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get house id
    const { data: houses } = await supabase.from("houses").select("id, name").eq("name", houseName).single();
    if (!houses) {
      return new Response("House not found", { status: 404, headers: corsHeaders });
    }

    // Get active bookings
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, check_in, check_out, guest_name")
      .eq("house_id", houses.id)
      .eq("cancelled", false);

    if (error) throw error;

    const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ElkiHome//Booking Calendar//RU
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:ElkiHome ${houseName}
`;

    for (const b of bookings || []) {
      ical += `BEGIN:VEVENT
UID:elkihome-${b.id}
DTSTART;VALUE=DATE:${formatDate(b.check_in)}
DTEND;VALUE=DATE:${formatDate(b.check_out)}
SUMMARY:${b.guest_name || "Занято"}
DTSTAMP:${now}
END:VEVENT
`;
    }

    ical += "END:VCALENDAR";

    return new Response(ical, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="elkihome-${houseName.toLowerCase()}.ics"`,
      },
    });
  } catch (err: any) {
    console.error("export-ical error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
