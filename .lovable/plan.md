

## Plan

### 1. Fix cross-month booking strip breaks in CalendarGrid

**Problem:** The strip connectivity logic (line 178) is gated on `inMonth`, so out-of-month days shown at the edges of the calendar grid don't participate in strip rendering. A booking spanning March 29 - April 2 appears as disconnected chunks.

**Fix in `CalendarGrid.tsx`:**
- Remove the `inMonth` gate from the strip connectivity logic — apply border-radius calculations to ALL days in the grid (including out-of-month days)
- For out-of-month days that are part of a booking, apply the `cellBg` class but with reduced opacity (e.g., `opacity-40` instead of `opacity-20`) so they're visually connected but still distinguishable as not-current-month
- The `disabled` and `pointer-events-none` behavior remains for out-of-month days

### 2. Avito iCal Synchronization

**Yes, this is doable.** Avito uses standard iCal (.ics) format for calendar sync. The plan:

#### 2a. Import from Avito (close dates in our calendar)

- Create an edge function `sync-avito` that:
  - Fetches the two Avito .ics URLs
  - Parses iCal VEVENT entries to extract booked date ranges
  - Upserts bookings into the `bookings` table with a new `source` value like `"avito_sync"` and a flag to distinguish auto-synced entries
- Add a `synced_from` column (nullable text) to `bookings` table — when set to `"avito"`, indicates auto-synced booking
- Schedule this edge function via pg_cron (e.g., every 30 minutes) to keep dates up to date
- In guest view: synced bookings display identically to manual bookings (date closed)
- In admin view: synced bookings show with a distinct color shade + label "Закрыто при синхронизации с Авито" in the date card
- Admin can still cancel synced bookings ("отмена заезда"), and can edit all booking fields manually

#### 2b. Export our calendar as .ics (for Avito to import)

- Create an edge function `export-ical` that:
  - Accepts a `house` query param (`green` or `black`)
  - Queries active (non-cancelled) bookings for that house
  - Returns a valid .ics file with VEVENT entries
- Publish stable URLs like:
  - `https://<project>.supabase.co/functions/v1/export-ical?house=green`
  - `https://<project>.supabase.co/functions/v1/export-ical?house=black`
- These URLs can be pasted into Avito's calendar import settings

#### Database changes

- Add column `synced_from` (text, nullable, default null) to `bookings` table
- Add column `external_uid` (text, nullable) to avoid duplicate imports from the same iCal event

#### Admin calendar display

- In `CalendarGrid.tsx`: when a booking has `synced_from = 'avito'`, use a slightly different shade (e.g., lighter/hatched variant of the house color) so admin can visually distinguish auto-synced dates
- In `BookingDetail.tsx` / `DateActionDialog.tsx`: show "Закрыто при синхронизации с Авито" badge, plus all editable fields as usual

#### Files to create/modify
- **New:** `supabase/functions/sync-avito/index.ts` — import .ics from Avito
- **New:** `supabase/functions/export-ical/index.ts` — export .ics for Avito
- **Migration:** add `synced_from` and `external_uid` columns to `bookings`
- **Modify:** `CalendarGrid.tsx` — cross-month fix + avito color distinction
- **Modify:** `BookingDetail.tsx` / `DateActionDialog.tsx` — show avito sync label
- **Modify:** `src/lib/types.ts` — add new fields to Booking type
- **pg_cron:** schedule sync-avito every 30 minutes

