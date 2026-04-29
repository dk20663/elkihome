// Lightweight persistent cache for instant first-paint of calendar data.
// Stores recent successful query results in localStorage, so the calendar can
// render real busy/free dates immediately on next visit while a fresh fetch
// happens in background.

const PREFIX = "elkihome_cache:";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h — fresh fetch always overwrites

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; data: T };
    if (!parsed || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > MAX_AGE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T) {
  try {
    localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {
    // ignore quota errors
  }
}
