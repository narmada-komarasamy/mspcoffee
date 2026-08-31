# MSP Coffee — Architecture

A practical map of how the system actually works today (2026-06), written for
humans and for AI sessions. It describes reality, including the parts that are
broken or inconsistent. For day-to-day rules and gotchas see `CLAUDE.md`.

## 1. What this app is

An internal web app for running MSP Coffee's estates and trading desk. Major
areas:

- **Rain Gauge** — daily rainfall capture per estate.
- **Fleet Fuel Expenses** and **HO Fuel** — fuel logging/reporting.
- **Labour Costs** — daily labour reports.
- **Processing Data** — per-estate, per-season processing dashboards
  (2020-21 through 2025-26) for 5 estates: Stanmore, Bison Valley, Moganad,
  Orchardale, Hidden Falls.
- **Harvest Yield** — per-estate yield dashboards.
- **Cup Scores** — tasting/quality catalogue.
- **Coffee Trading / Storage** — green-lot inventory, milling, blends, sales,
  with invoice AI extraction and an audit log.
- **Admin Controls** — users, permissions, activity log.

## 2. Stack & hosting

- **Next.js 16.2.1**, App Router, React 19.2.4, React Compiler enabled.
- **Supabase** (Postgres + Auth + RLS) as the backend/data store.
- **Vercel** for hosting/deploys (`.vercel/`, GitHub repo
  `narmada-komarasamy/mspcoffee`).
- **Anthropic SDK** for AI insights and invoice parsing.

## 3. Directory map (`src/app`)

Route groups (parenthesised folders don't appear in the URL):

- `(auth)/` — `login`, `forgot-password`, `reset-password`, `accept-invite`.
- `(dashboard)/` — the main app: `rainfall`, `fuel-expenses`, `ho-fuel`,
  `labour-costs`, `processing-dashboard/...`, `harvest-yield/...`, `cup-scores`,
  `daily-report`, `activity-log`, `admin-controls/...`, plus `DashboardShell.tsx`
  and `layout.tsx` (nav + shell).
- `(trading)/` — `trading-dashboard`, `coffee-storage`, `cup-scores-catalogue`,
  `export-operations`.
- `api/` — `ai-insights`, `ai-insights/ask`, `auth/login`, `parse-invoice`,
  `cup-scores`, `cup-scores/seed`, `cup-scores/[id]`.

Supporting:

- `src/lib/supabase/{server,client,admin}.ts` + legacy `src/lib/supabase.ts`.
- `src/lib/auth/{access.ts,require.ts}` — role/nav definitions and Supabase guards.
- `src/components/ui/*` (shadcn), `src/components/{rainfall,fleet}/*` (modals).
- `src/proxy.ts` — Next 16 "proxy" (formerly middleware).

## 4. Request / auth flow (as built)

```
Browser → src/proxy.ts (checks msp_auth cookie EXISTS) → page/route
```

Two auth mechanisms coexist:

1. **PIN login (LIVE).** `(auth)/login/page.tsx` fetches all `app_users` via the
   anon Supabase client, matches a 4-digit PIN in the browser, stores the user in
   `localStorage.msp_user`, and sets `msp_auth=1`. The proxy only checks that the
   cookie is present.
2. **Supabase email/password (LEGACY, mostly unused by the UI).**
   `(auth)/login/actions.ts`, `api/auth/login/route.ts`, and `lib/auth/require.ts`
   implement real Supabase Auth with `signInWithPassword` and session cookies.

Because the live path never authenticates with Supabase, server-side role
enforcement (`requireRole`) and the role-aware RLS assumptions don't actually
apply to normal usage.

## 5. Data layer

- Tables include: `app_users`, `profiles`, `user_permissions`, `user_activity`,
  `parchment_batches`, `green_lots`, `hilltiller_stock`, `coffee_sales`,
  `blends`, `blend_recipe_items`, `coffee_audit_log`, plus rainfall/fuel/cup-score
  tables.
- **RLS** (`supabase_rls_policies.sql`): most tables allow full read/write to any
  `authenticated` role; `app_users` and some lookups allow `anon` SELECT. There
  is no per-role or per-estate row filtering.
- **Audit log** (`coffee_audit_log`) is insert + select only (no update/delete) —
  a good pattern, but it's populated from client code using the localStorage
  identity, so the "actor" is self-asserted.
- **Migrations**: canonical ones in `supabase/migrations/`; many additional
  schema/data scripts live as loose root `.sql` files applied by hand. No single
  automated history.

## 6. Dashboards: static HTML pattern

Processing and harvest-yield dashboards are pre-built **static HTML files in
`/public`** (≈50 of them, manually versioned `-v3`/`-v4`). The React route
(`processing-dashboard/<season>/<estate>/page.tsx`) is a thin wrapper that loads
the HTML in an `<iframe>`. Editing a dashboard = editing the HTML file. Anything
in `/public` is served as a static asset and is **not** behind the auth proxy.

## 7. AI features

- `api/parse-invoice` — accepts a base64 image/PDF, uses Claude vision to extract
  invoice fields. Size/type validated; **no auth check**.
- `api/ai-insights` (+ `/ask`) — pulls live data via the anon key and asks Claude
  for insights/summaries. **No auth check.**

## 8. Known issues (snapshot — see remediation plan)

These are documented here so sessions don't mistake them for intended design:

1. **PIN exposure** — every user's PIN is downloadable from `/login` (anon SELECT
   on `app_users`). Full auth bypass. *Critical.*
2. **Spoofable gate** — `proxy.ts` only checks that `msp_auth` exists; setting the
   cookie manually bypasses login. *Critical.*
3. **No server-side authorization** — roles live in `localStorage`; RLS only
   checks authenticated-vs-anon. *Critical.*
4. **Open API routes** — `/api/*` is excluded from the proxy and self-checks
   nothing, including the two Anthropic-backed endpoints. *High.*
5. **Hardcoded keys** — anon JWT in `ho-fuel/page.tsx` and `ho_fuel_apps_script.js`.
   *High.*
6. **Public business data** — `/public` dashboards are world-readable by URL.
   *High.*
7. **Two auth systems** — PIN vs Supabase Auth; root cause of 1–3. *High.*
8. **Maintainability** — `getSession()` (not `getUser()`) for server checks;
   duplicate Supabase client modules; ~3,000-line components; 39 lint errors not
   blocking the build; ~80MB of binaries committed to git (incl. a 19MB mp4
   duplicated in root and `/public`); scattered SQL migrations. *Medium.*

## 9. Intended direction

Consolidate onto Supabase Auth, enforce roles in RLS and in server components /
route handlers, remove the PIN/localStorage trust path, move secrets to env vars,
put `/public` business dashboards behind auth, and bring all schema changes into
`supabase/migrations/`. The detailed sequencing lives in the remediation plan.
