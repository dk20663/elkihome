import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AVITO_FEEDS: Record<string, string> = {
  GREEN: "https://www.avito.ru/calendars-export/36/91/3697418891.ics",
  BLACK: "https://www.avito.ru/calendars-export/36/15/3696922015.ics",
};

function parseICS(icsText: string): Array<{ uid: string; dtstart: string; dtend: string; summary: string }> {
  const events: Array<{ uid: string; dtstart: string; dtend: string; summary: string }> = [];
  const blocks = icsText.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    const uid = block.match(/UID:(.+)/)?.[1]?.trim() || "";
    const dtstart = block.match(/DTSTART(?:;VALUE=DATE)?:(\d{8})/)?.[1] || "";
    const dtend = block.match(/DTEND(?:;VALUE=DATE)?:(\d{8})/)?.[1] || "";
    const summary = block.match(/SUMMARY:(.+)/)?.[1]?.trim() || "Avito";

    if (uid && dtstart && dtend) {
      events.push({
        uid,
        dtstart: `${dtstart.slice(0, 4)}-${dtstart.slice(4, 6)}-${dtstart.slice(6, 8)}`,
        dtend: `${dtend.slice(0, 4)}-${dtend.slice(4, 6)}-${dtend.slice(6, 8)}`,
        summary,
      });
    }
  }
  return events;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get houses
    const { data: houses, error: hErr } = await supabase.from("houses").select("id, name");
    if (hErr) throw hErr;

    const houseMap: Record<string, string> = {};
    for (const h of houses || []) {
      houseMap[h.name] = h.id;
    }

    let totalSynced = 0;

    for (const [houseName, feedUrl] of Object.entries(AVITO_FEEDS)) {
      const houseId = houseMap[houseName];
      if (!houseId) continue;

      let icsText: string;
      try {
        const res = await fetch(feedUrl);
        if (!res.ok) {
          console.error(`Failed to fetch ${houseName} feed: ${res.status}`);
          continue;
        }
        icsText = await res.text();
      } catch (e) {
        console.error(`Error fetching ${houseName} feed:`, e);
        continue;
      }

      const events = parseICS(icsText);

      // Get existing external_uids for this house to know what's already synced
      const { data: existing } = await supabase
        .from("bookings")
        .select("external_uid")
        .eq("house_id", houseId)
        .eq("synced_from", "avito")
        .not("external_uid", "is", null);

      const existingUids = new Set((existing || []).map((e) => e.external_uid));

      for (const ev of events) {
        const extUid = `avito_${houseName}_${ev.uid}`;

        if (existingUids.has(extUid)) {
          // Already exists, skip
          continue;
        }

        const { error: insertErr } = await supabase.from("bookings").insert({
          house_id: houseId,
          check_in: ev.dtstart,
          check_out: ev.dtend,
          guest_name: ev.summary || "Авито",
          source: "Авито",
          synced_from: "avito",
          external_uid: extUid,
          total_price: 0,
        });

        if (insertErr) {
          // Duplicate uid constraint will prevent re-inserts
          if (!insertErr.message.includes("duplicate") && !insertErr.message.includes("unique")) {
            console.error(`Insert error for ${extUid}:`, insertErr.message);
          }
        } else {
          totalSynced++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, synced: totalSynced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("sync-avito error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
