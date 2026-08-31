# MSP Coffee — Remediation Plan

Status: **proposed — no code changed yet.** Owner decisions baked in:
- Auth model: **switch to Supabase email + password** (retire PIN/localStorage).
- This document is the review artifact; implementation happens phase by phase
  after sign-off.

Severity legend: **🔴 Critical** (exploitable now) · **🟠 High** · **🟡 Medium**.

> Reality check this plan is based on: see `ARCHITECTURE.md` §8. The app is
> currently open — anyone with the URL can read every user's PIN and/or set one
> cookie to bypass login. Phases 0–2 close that; treat them as an incident, not a
> backlog item.

---

## Phase 0 — Containment (🔴 do first, ~half a day)

Goal: stop active exploitation without a big refactor. Each item is small and
independently deployable.

### 0.1 Rotate Supabase keys
- In Supabase dashboard → Project Settings → API, rotate the **anon/publishable**
  and **service-role** keys.
- Reason: the anon key is hardcoded in `src/app/(dashboard)/ho-fuel/page.tsx:16`
  and `ho_fuel_apps_script.js:25`, and ships in client bundles. Assume it is
  compromised.
- Update Vercel env vars (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- ⚠️ Sequence with 0.2/0.4 so nothing breaks when the old anon key dies.

### 0.2 Remove hardcoded keys
- `src/app/(dashboard)/ho-fuel/page.tsx` — replace the literal JWT with
  `process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`.
- `ho_fuel_apps_script.js` — if this is a Google Apps Script (not part of the
  Next build), move the key into Apps Script *Script Properties* and read it at
  runtime; do not keep it in the committed file.

### 0.3 Lock down `app_users` (stops PIN leak)
- Drop the anon read policy that exposes PINs:
  ```sql
  DROP POLICY IF EXISTS "anon_read_app_users" ON app_users;
  ```
- This will break the current PIN login page (it reads `app_users` as anon).
  That's expected — Phase 1 replaces that page. If you need a working login in
  the gap, ship Phase 1 in the same window as 0.3 (recommended) rather than
  leaving login broken.
- Interim option if Phase 1 can't land same-day: keep a login that does PIN
  verification in a **server** route (service-role key, server-side), never
  returning the PIN list to the browser. This is throwaway code, so prefer going
  straight to Phase 1.

### 0.4 Harden the proxy gate
- `src/proxy.ts` currently does `request.cookies.has('msp_auth')` — presence
  only. Until Phase 1 lands, at minimum reject when the cookie is absent *or* not
  a valid value. After Phase 1 this is replaced by a real Supabase session check
  (see 1.3).

**Phase 0 exit criteria:** no PIN list reaches the browser; no anon key in
source; old keys rotated; login still works (via Phase 1 or the interim server
route).

---

## Phase 1 — Real authentication (🔴, ~1–2 days)

Goal: one auth system — Supabase email/password — validated server-side.

### 1.1 User migration (PIN → email/password)
- Create a Supabase **auth user** for each row in `app_users`.
- Decide email convention (e.g. `name@mspcoffee.com` or an internal alias).
- Set an initial password and the existing `must_change_password` flag (already
  referenced in `lib/auth/require.ts`) so users reset on first login.
- Keep `profiles` as the role/estate source of truth (`id, name, role, estate,
  must_change_password`), linked to `auth.users.id`.
- Write this as a one-time migration script in `supabase/migrations/` +
  documented manual steps (creating auth users is an Admin API call, not pure
  SQL).

### 1.2 Replace the login UI
- Rewrite `src/app/(auth)/login/page.tsx` to a standard email + password form
  posting to the existing server action `(auth)/login/actions.ts` (`signIn`),
  which already calls `supabase.auth.signInWithPassword`.
- Delete the PIN keypad, the `app_users` fetch, `localStorage.msp_user`, and the
  `document.cookie = 'msp_auth=1'` line.
- Keep the existing `forgot-password` / `reset-password` / `accept-invite` flows
  (they already use real Supabase Auth).

### 1.3 Server-validated sessions everywhere
- `src/lib/auth/require.ts`: change `getSession()` → `getUser()` so the JWT is
  verified with Supabase on each server check (current comment admits it's a
  local cookie read).
- `src/proxy.ts`: replace the `msp_auth` cookie check with a real session check
  using `@supabase/ssr` (read the Supabase auth cookies, refresh if needed,
  redirect to `/login` when there's no valid user). Remove the `/api/` blanket
  exemption from auth (see 2.3).

### 1.4 Retire the legacy/duplicate bits
- Remove `src/lib/supabase.ts` (legacy anon singleton) once nothing imports it.
- Decide whether `api/auth/login/route.ts` is still needed (the server action
  covers it) and remove if redundant.

**Phase 1 exit criteria:** login is email/password; `requireUser` uses
`getUser`; proxy enforces a real session; no `localStorage`/`msp_auth` trust path
remains.

---

## Phase 2 — Authorization that's enforced (🔴/🟠, ~1–2 days)

Goal: roles (`admin`/`supervisor`/`worker`/`ceo`) enforced on the server and in
the database, not in the browser.

### 2.1 Server-side role gates
- Call `requireRole([...])` (from `lib/auth/require.ts`) at the top of every
  protected server component / page, matching the role lists already declared in
  `src/lib/auth/access.ts` (`NAV_ITEMS[].roles`).
- Replace client-side checks like `getUserRole()` / `isViewOnly()` in
  `(trading)/coffee-storage/page.tsx` with role data passed down from a
  server-verified source. Client checks can stay for UX (hiding buttons) but must
  no longer be the only gate.

### 2.2 Role-aware RLS
- Replace blanket `auth.role() = 'authenticated'` policies in
  `supabase_rls_policies.sql` with policies that read the caller's role/estate
  from `profiles`, e.g.:
  ```sql
  -- example: CEO is read-only; workers limited to their estate; admin full
  CREATE POLICY "read_coffee_sales"
    ON coffee_sales FOR SELECT
    USING (auth.uid() IS NOT NULL);     -- all authed can read

  CREATE POLICY "write_coffee_sales"
    ON coffee_sales FOR ALL
    USING (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','supervisor')
    )
    WITH CHECK (
      (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','supervisor')
    );
  ```
- Apply per-table: define the read/write matrix (who can read, who can write,
  CEO = read-only everywhere) and codify it. Add this as a migration in
  `supabase/migrations/`, superseding the root `supabase_rls_policies.sql`.
- Make the `coffee_audit_log` actor trustworthy: derive it from `auth.uid()` /
  `profiles`, not from a client-supplied name.

### 2.3 Guard API routes
- Add a session check to every handler under `src/app/api/`:
  - `parse-invoice` and `ai-insights` (+ `/ask`) — require an authenticated user;
    these call the Anthropic API and are a cost/abuse risk while open.
  - `cup-scores`, `cup-scores/seed`, `cup-scores/[id]` — require appropriate
    roles (seed/write = admin).
- Stop using the anon key inside `ai-insights` to read data; use the
  session-scoped server client so RLS applies.

**Phase 2 exit criteria:** changing `localStorage` grants no privilege; RLS
blocks unauthorized reads/writes even with a valid session; all API routes
authenticate.

---

## Phase 3 — Protect the data dashboards (🟠, ~1–2 days)

Goal: the processing/yield dashboards in `/public` stop being world-readable by
URL.

- Today `/public/*.html` is served as static assets, bypassing the proxy, and is
  embedded via `<iframe>` in thin wrappers under
  `(dashboard)/processing-dashboard/...`.
- Options (pick one during this phase):
  1. **Move HTML out of `/public`** into a non-public location and serve it
     through an authenticated route handler that checks the session, then point
     the iframe at that route. (Preferred — keeps the iframe pattern.)
  2. Convert the dashboards to authenticated React pages (larger effort; only if
     you want to retire the static-HTML pattern).
- Also fold the manual `-v3`/`-v4` versioning into something deliberate (keep
  only the live version referenced by each `page.tsx`; archive the rest).

**Phase 3 exit criteria:** dashboard URLs return 401/redirect when not logged in.

---

## Phase 4 — Hygiene & guardrails (🟡, ongoing)

Goal: stop regressions and shrink the maintenance surface. None of these are
urgent, but they're what keeps Phases 0–3 from quietly breaking again.

### 4.1 Migration consolidation
- Bring the loose root SQL (`supabase_rls_policies.sql`,
  `role_permissions_migration.sql`, `update_logins.sql`, `green_lots_import.sql`,
  `create_activity_log.sql`, `fleet_setup.sql`) into `supabase/migrations/` with
  proper timestamps, or explicitly archive them under `supabase/legacy/` and
  document that the DB is the source of truth.
- Adopt the Supabase CLI for future schema changes so history is automated.

### 4.2 Build guardrails
- Make lint block the build (or add a pre-commit hook / CI check). Current state:
  39 ESLint errors, 58 warnings, build does not fail. Fix or explicitly disable
  rules, then enforce zero-new-errors.
- Keep `npx tsc --noEmit` green (currently clean).

### 4.3 Secrets & config
- Add a committed `.env.example` listing every required var (no values).
- Confirm `.env*` stays gitignored (it currently is).

### 4.4 Repo weight
- ~80MB of binaries are committed, including `background_merged.mp4` (19MB)
  duplicated in **both** repo root and `/public`, plus `bg-video-*.mp4`,
  `HILLTILLER.png` (7.3MB), etc.
- Move large media to Vercel Blob / a CDN and reference by URL; delete the root
  duplicate. Consider `git filter-repo` to purge them from history (coordinate —
  this rewrites history).

### 4.5 Component size
- `coffee-storage/page.tsx` (~3,000 lines), `fuel-expenses` (~1,580),
  `ho-fuel` (~1,190): extract hooks/subcomponents opportunistically when touching
  them. Not a standalone project.

### 4.6 Tests (optional but recommended)
- Add focused tests around money/stock logic in the trading module (stock
  deduction on sale, sale cancel/restore, blend production) — the areas where a
  silent bug costs real money.

---

## Suggested sequencing

| When | Phases | Why |
|---|---|---|
| Day 1 | 0 + start 1 | Stop the bleeding (keys, PIN leak, gate). |
| Days 2–3 | 1 + 2 | Real auth + enforced roles — the core fix. |
| Days 4–5 | 3 | Close the public-data hole. |
| Rolling | 4 | Guardrails so it stays fixed. |

## Open questions for the owner

1. **Email convention** for migrated users (real addresses vs internal aliases)?
2. **Role/permission matrix** — confirm exactly what each of admin / supervisor /
   worker / ceo can read and write per module (needed to write RLS in 2.2).
3. **Estate scoping** — should workers/supervisors be limited to their own
   estate's rows, or is access company-wide once authenticated?
4. **Media hosting** — OK to move large video/images to Vercel Blob/CDN and
   rewrite git history to purge them?
