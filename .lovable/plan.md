

## Plan: Web Login for Admin Mode

### Problem
Currently admin access only works via Telegram auth. Need to add email/password login for web browser access with hardcoded credentials (admin / Den12344321Qq+).

### Approach

The system already creates Supabase auth users for Telegram users. We need to:

1. **Create an admin user in the database** via edge function or migration — email `admin@elkihome.local`, password `Den12344321Qq+`. This will be a real Supabase auth user that can perform authenticated operations (same RLS policies apply).

2. **Add login form to `AuthPage.tsx`** — when not in Telegram (no `initData`), show a simple login/password form instead of "Open in Telegram" link. On submit, call `supabase.auth.signInWithPassword()`.

3. **Update `useAuth.ts`** — add a `signInWithPassword(email, password)` method that the login form can call. The existing `onAuthStateChange` listener will handle setting the user state automatically.

4. **Create the admin user** — add an edge function `create-admin-user` that creates the user via `supabase.auth.admin.createUser()` with `email_confirm: true`. Call it once to seed the account. Alternatively, do this via a migration or manually — but the simplest reliable approach is an edge function we invoke once.

### Technical Details

**Edge function `create-admin-user/index.ts`:**
- Uses service role key to call `auth.admin.createUser({ email: "admin@elkihome.local", password: "Den12344321Qq+", email_confirm: true })`
- Idempotent — returns success if user already exists

**`AuthPage.tsx` changes:**
- When `!hasTelegram`: render email + password inputs + "Войти" button
- On submit: call `supabase.auth.signInWithPassword({ email, password })`
- Show error toast on failure
- Keep the back button

**`useAuth.ts` changes:**
- Add `signIn(email: string, password: string)` function
- Return it from the hook so AuthPage can use it
- No other changes needed — `onAuthStateChange` already handles session

**No database changes needed** — all tables use `authenticated` role RLS, so the new web admin user gets the same access as Telegram users.

### Files to Create/Modify
- `supabase/functions/create-admin-user/index.ts` — new edge function
- `src/hooks/useAuth.ts` — add `signIn` method
- `src/components/AuthPage.tsx` — add login form for web

