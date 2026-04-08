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

function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// Check if an avito-synced booking has been manually edited
function hasManualEdits(b: any): boolean {
  if (b.guest_phone && b.guest_phone.trim() !== "") return true;
  if (b.comment && b.comment.trim() !== "") return true;
  if (b.total_price && Number(b.total_price) !== 0) return true;
  if (b.guest_count && b.guest_count > 1) return true;
  if (b.sauna || b.plunge_pool || b.bath_brooms || b.fir_infusion || b.citrus_infusion) return true;
  // If guest_name was changed from default avito values
  const defaultNames = ["авито", "avito", "avito (closed)", "avito (booked)", ""];
  if (b.guest_name && !defaultNames.includes(b.guest_name.toLowerCase().trim())) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: houses, error: hErr } = await supabase.from("houses").select("id, name");
    if (hErr) throw hErr;

    const houseMap: Record<string, string> = {};
    for (const h of houses || []) {
      houseMap[h.name] = h.id;
    }

    let totalSynced = 0;
    let totalSkipped = 0;
    let totalRemoved = 0;
    let totalCancelled = 0;

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

      // Build set of current Avito UIDs from the feed
      const feedUids = new Set(events.map((ev) => `avito_${houseName}_${ev.uid}`));

      // Get all existing avito-synced bookings for this house (including cancelled)
      const { data: existingSynced } = await supabase
        .from("bookings")
        .select("id, external_uid, cancelled, manual_override, guest_name, guest_phone, comment, total_price, guest_count, sauna, plunge_pool, bath_brooms, fir_infusion, citrus_infusion")
        .eq("house_id", houseId)
        .eq("synced_from", "avito")
        .not("external_uid", "is", null);

      const existingUids = new Set((existingSynced || []).map((e) => e.external_uid));

      // --- Remove/cancel bookings that disappeared from Avito feed ---
      for (const booking of existingSynced || []) {
        if (booking.cancelled) continue; // already cancelled, skip
        if (feedUids.has(booking.external_uid)) continue; // still in feed, keep

        // This booking was removed from Avito feed
        if (hasManualEdits(booking)) {
          // Has manual data → cancel instead of delete
          const { error } = await supabase
            .from("bookings")
            .update({ cancelled: true })
            .eq("id", booking.id);
          if (!error) totalCancelled++;
          else console.error(`Cancel error for ${booking.external_uid}:`, error.message);
        } else {
          // No manual edits → delete
          const { error } = await supabase
            .from("bookings")
            .delete()
            .eq("id", booking.id);
          if (!error) totalRemoved++;
          else console.error(`Delete error for ${booking.external_uid}:`, error.message);
        }
      }

      // --- Import new events from feed ---
      const { data: manualBookings } = await supabase
        .from("bookings")
        .select("check_in, check_out")
        .eq("house_id", houseId)
        .eq("cancelled", false)
        .is("synced_from", null);

      const manualList = manualBookings || [];

      for (const ev of events) {
        // Skip events that originated from our own export-ical feed (feedback loop protection)
        if (ev.uid.startsWith("elkihome-")) {
          continue;
        }

        const extUid = `avito_${houseName}_${ev.uid}`;

        if (existingUids.has(extUid)) {
          // If it exists but was cancelled, and it's back in the feed → restore it
          // BUT skip if manually overridden by admin
          const existing = (existingSynced || []).find((e) => e.external_uid === extUid);
          if (existing?.cancelled && !existing?.manual_override) {
            await supabase.from("bookings").update({ cancelled: false }).eq("id", existing.id);
            totalSynced++;
          }
          continue;
        }

        const hasManualOverlap = manualList.some((mb) =>
          datesOverlap(ev.dtstart, ev.dtend, mb.check_in, mb.check_out)
        );

        if (hasManualOverlap) {
          totalSkipped++;
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
          if (!insertErr.message.includes("duplicate") && !insertErr.message.includes("unique")) {
            console.error(`Insert error for ${extUid}:`, insertErr.message);
          }
        } else {
          totalSynced++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, synced: totalSynced, skipped: totalSkipped, removed: totalRemoved, cancelled: totalCancelled }), {
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
