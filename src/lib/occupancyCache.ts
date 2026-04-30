import type { Booking } from "./types";

const KEY = "elkihome_occupancy_v1";
const TTL_MS = 5 * 60 * 1000; // 5 minutes

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
    const isFresh = Date.now() - parsed.ts <= TTL_MS;
    if (!isFresh) return null;
    return { data: parsed.data, isFresh };
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
