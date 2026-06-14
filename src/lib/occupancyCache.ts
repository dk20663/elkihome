import type { Booking } from "./types";

const KEY = "elkihome_occupancy_v1";
const FRESH_MS = 5 * 60 * 1000;       // 5 min: считается «свежим», тихо обновляется в фоне
const STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней: даже устаревшие данные лучше пустого экрана для РФ-пользователей с нестабильной сетью

interface CacheEntry {
  ts: number;
  data: Booking[];
}

export function readOccupancy(): { data: Booking[]; isFresh: boolean } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed?.data || !Array.isArray(parsed.data)) return null;
    const age = Date.now() - parsed.ts;
    if (age > STALE_MS) return null;
    return { data: parsed.data, isFresh: age <= FRESH_MS };
  } catch {
    return null;
  }
}

export function writeOccupancy(data: Booking[]) {
  try {
    const entry: CacheEntry = { ts: Date.now(), data };
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // ignore storage errors (quota, private mode)
  }
}

export function invalidateOccupancy() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
