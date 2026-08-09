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

    // Get active bookings - exclude avito-synced to prevent feedback loop
    // Export ALL active bookings (including avito-synced) so Avito sees our full availability
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, check_in, check_out")
      .eq("house_id", houses.id)
      .eq("cancelled", false);

    if (error) throw error;

    // Cancelled bookings whose dates are still in the future (or very recent past):
    // external platforms (Avito, Cian, Sutochno) often keep an imported event forever
    // if it simply disappears from the feed. We publish an explicit tombstone
    // (STATUS:CANCELLED + higher SEQUENCE) so the date gets released on their side.
    const horizon = new Date();
    horizon.setDate(horizon.getDate() - 7);
    const horizonStr = horizon.toISOString().slice(0, 10);

    const { data: cancelled } = await supabase
      .from("bookings")
      .select("id, check_in, check_out")
      .eq("house_id", houses.id)
      .eq("cancelled", true)
      .gte("check_out", horizonStr);

    const activeIds = new Set((bookings || []).map((b) => b.id));

    const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ElkiHome//Booking Calendar//RU
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:ElkiHome ${houseName}
X-PUBLISHED-TTL:PT15M
REFRESH-INTERVAL;VALUE=DURATION:PT15M
`;

    for (const b of bookings || []) {
      ical += `BEGIN:VEVENT
UID:elkihome-${b.id}
DTSTART;VALUE=DATE:${formatDate(b.check_in)}
DTEND;VALUE=DATE:${formatDate(b.check_out)}
SUMMARY:Занято
STATUS:CONFIRMED
TRANSP:OPAQUE
SEQUENCE:0
LAST-MODIFIED:${now}
DTSTAMP:${now}
END:VEVENT
`;
    }

    for (const b of cancelled || []) {
      if (activeIds.has(b.id)) continue;
      ical += `BEGIN:VEVENT
UID:elkihome-${b.id}
DTSTART;VALUE=DATE:${formatDate(b.check_in)}
DTEND;VALUE=DATE:${formatDate(b.check_out)}
SUMMARY:Отменено
STATUS:CANCELLED
TRANSP:TRANSPARENT
SEQUENCE:2
LAST-MODIFIED:${now}
DTSTAMP:${now}
END:VEVENT
`;
    }

    ical += "END:VCALENDAR";

    return new Response(ical, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Content-Disposition": `inline; filename="elkihome-${houseName.toLowerCase()}.ics"`,
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
