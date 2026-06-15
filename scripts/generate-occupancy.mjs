#!/usr/bin/env node
/**
 * Генератор статического снапшота для гостевого календаря.
 *
 * Читает данные из Supabase (с сервера GitHub Actions — никакой РКН-блокировки),
 * формирует один JSON-файл `dist-embed/data/snapshot.json`, который виджет
 * загружает с того же CDN (jsDelivr), что и сам HTML/JS.
 *
 * Запуск: node scripts/generate-occupancy.mjs
 * ENV: SUPABASE_URL, SUPABASE_ANON_KEY
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://hpfurpylorcuvcoevpsl.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error("ERROR: SUPABASE_ANON_KEY env is required");
  process.exit(1);
}

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

function todayMinus1ISO() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const cutoff = todayMinus1ISO();

  const [houses, bookings, pricing] = await Promise.all([
    sb("houses?select=id,name,color,base_price_weekday,base_price_weekend,guest_comment,created_at"),
    sb(
      `public_bookings_view?select=id,house_id,house_name,check_in,check_out,cancelled&cancelled=eq.false&check_out=gte.${cutoff}`
    ),
    sb(`house_pricing?select=id,house_id,date,price&date=gte.${cutoff}`),
  ]);

  const snapshot = {
    version: 1,
    generated_at: new Date().toISOString(),
    cutoff,
    houses,
    bookings,
    pricing,
  };

  const json = JSON.stringify(snapshot);
  const outDir = path.resolve("dist-embed/data");
  const outFile = path.join(outDir, "snapshot.json");

  // Идемпотентность: не коммитим, если содержимое не изменилось
  // (кроме поля generated_at). Это снимает мусорные коммиты.
  if (existsSync(outFile)) {
    try {
      const prev = JSON.parse(await readFile(outFile, "utf8"));
      const a = { ...prev, generated_at: null };
      const b = { ...snapshot, generated_at: null };
      if (JSON.stringify(a) === JSON.stringify(b)) {
        console.log("Snapshot unchanged, skipping write.");
        process.exit(0);
      }
    } catch {
      /* перезапишем */
    }
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, json);
  console.log(
    `Wrote ${outFile} — houses:${houses.length} bookings:${bookings.length} pricing:${pricing.length} size:${json.length}b`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
