

## Plan

### 1. Booking-aware strip connectivity (not just color-based)

**Problem:** Current strip logic merges adjacent days if they share the same `cellBg` class, regardless of whether they belong to the same booking. This makes separate bookings look like one continuous block.

**Fix in `CalendarGrid.tsx`:**
- Build a `dayBookingIdMap` that stores, for each day+house, the set of active booking IDs.
- Change strip connectivity logic: instead of comparing `cellBg` class with neighbors, check if the day shares at least one booking ID with its neighbor for the relevant house(s).
- For `filter === "green"` or `"black"`: check if the previous/next day has the same green/black booking ID.
- For `filter === "all"`: check per-house booking continuity. Two adjacent days merge only if the same booking spans both days.
- This ensures single-day bookings are fully rounded, multi-day bookings are seamless strips, and adjacent but separate bookings have visible gaps.

### 2. Telegram `addToHomeScreen` 

**Problem:** The native Telegram menu item "Add to Home Screen" doesn't appear automatically — it requires calling `window.Telegram.WebApp.requestAddToHomeScreen()` or similar API method.

**Fix in `src/main.tsx`:**
- After `tg.ready()` and `tg.expand()`, call `tg.addToHomeScreen?.()` or `tg.requestAddToHomeScreen?.()` (the method that triggers the native prompt). This will make the option available in Telegram's interface. We'll use the correct API method per Telegram Bot API docs.

### 3. Today indicator: inset border instead of hatching

**Fix in `CalendarGrid.tsx` and `index.css`:**
- Remove `calendar-today-hatched` and `calendar-today-hatched-empty` CSS classes and their usage.
- Replace with `box-shadow: inset 0 0 0 2px hsl(217, 91%, 60%)` via a new utility class `calendar-today-outline`. This creates an inset border that doesn't change the cell size and follows the cell's border-radius.
- Apply this class to today's date in both admin and guest views.

