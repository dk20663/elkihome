import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseICS(icsText: string): Array<{ uid: string; dtstart: string; dtend: string; summary: string }> {
  const events: Array<{ uid: string; dtstart: string; dtend: string; summary: string }> = [];
  const blocks = icsText.split("BEGIN:VEVENT");
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    const uid = block.match(/UID:(.+)/)?.[1]?.trim() || "";
    const dtstart = block.match(/DTSTART(?:;VALUE=DATE)?:(\d{8})/)?.[1] || "";
    const dtend = block.match(/DTEND(?:;VALUE=DATE)?:(\d{8})/)?.[1] || "";
    const summary = block.match(/SUMMARY:(.+)/)?.[1]?.trim() || "Суточно";
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

function hasManualEdits(b: any): boolean {
  if (b.guest_phone && b.guest_phone.trim() !== "") return true;
  if (b.comment && b.comment.trim() !== "") return true;
  if (b.total_price && Number(b.total_price) !== 0) return true;
  if (b.guest_count && b.guest_count > 1) return true;
  if (b.sauna || b.plunge_pool || b.bath_brooms || b.fir_infusion || b.citrus_infusion) return true;
  const defaultNames = ["суточно", "sutochno", ""];
  if (b.guest_name && !defaultNames.includes(b.guest_name.toLowerCase().trim())) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: houses, error: hErr } = await supabase
      .from("houses")
      .select("id, name, sutochno_ical_url");
    if (hErr) throw hErr;

    let totalSynced = 0;
    let totalSkipped = 0;
    let totalRemoved = 0;
    let totalCancelled = 0;

    for (const house of houses || []) {
      const feedUrl = (house.sutochno_ical_url || "").trim();
      if (!feedUrl) continue;

      let icsText: string;
      try {
        const res = await fetch(feedUrl);
        if (!res.ok) {
          console.error(`Fetch ${house.name} failed: ${res.status}`);
          continue;
        }
        icsText = await res.text();
      } catch (e) {
        console.error(`Fetch ${house.name} error:`, e);
        continue;
      }

      const events = parseICS(icsText);
      const feedUids = new Set(events.map((ev) => `sutochno_${house.name}_${ev.uid}`));

      const { data: existingSynced } = await supabase
        .from("bookings")
        .select("id, check_in, check_out, external_uid, cancelled, manual_override, guest_name, guest_phone, comment, total_price, guest_count, sauna, plunge_pool, bath_brooms, fir_infusion, citrus_infusion")
        .eq("house_id", house.id)
        .eq("synced_from", "sutochno")
        .not("external_uid", "is", null);

      const existingUids = new Set((existingSynced || []).map((e) => e.external_uid));

      // Remove or cancel bookings that disappeared from the Sutochno feed
      for (const booking of existingSynced || []) {
        if (booking.cancelled) continue;
        if (feedUids.has(booking.external_uid)) continue;
        if (hasManualEdits(booking)) {
          const { error } = await supabase
            .from("bookings")
            .update({ cancelled: true })
            .eq("id", booking.id);
          if (!error) totalCancelled++;
        } else {
          const { error } = await supabase
            .from("bookings")
            .delete()
            .eq("id", booking.id);
          if (!error) totalRemoved++;
        }
      }

      // Active bookings for overlap checks (prevents feedback loop)
      const { data: allActiveBookings } = await supabase
        .from("bookings")
        .select("check_in, check_out")
        .eq("house_id", house.id)
        .eq("cancelled", false);
      const activeList = allActiveBookings || [];

      const cancelledOverrides = (existingSynced || []).filter(
        (b) => b.cancelled && b.manual_override
      );

      for (const ev of events) {
        // Skip events that originated from our own export-ical feed
        if (ev.uid.startsWith("elkihome-")) continue;

        const extUid = `sutochno_${house.name}_${ev.uid}`;

        if (existingUids.has(extUid)) {
          const existing = (existingSynced || []).find((e) => e.external_uid === extUid);
          if (existing?.cancelled && !existing?.manual_override) {
            await supabase.from("bookings").update({ cancelled: false }).eq("id", existing.id);
            totalSynced++;
          }
          continue;
        }

        const hasOverlap = activeList.some((ab) =>
          datesOverlap(ev.dtstart, ev.dtend, ab.check_in, ab.check_out)
        );
        if (hasOverlap) {
          totalSkipped++;
          continue;
        }

        const adminFreed = cancelledOverrides.some((b) =>
          datesOverlap(ev.dtstart, ev.dtend, b.check_in, b.check_out)
        );
        if (adminFreed) {
          totalSkipped++;
          continue;
        }

        const { error: insertErr } = await supabase.from("bookings").insert({
          house_id: house.id,
          check_in: ev.dtstart,
          check_out: ev.dtend,
          guest_name: ev.summary || "Суточно",
          source: "Суточно",
          synced_from: "sutochno",
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

    return new Response(
      JSON.stringify({ ok: true, synced: totalSynced, skipped: totalSkipped, removed: totalRemoved, cancelled: totalCancelled }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("sync-sutochno error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
