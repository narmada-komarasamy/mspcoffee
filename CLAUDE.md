@AGENTS.md

# MSP Coffee — Project Context

Estate-management web app for MSP Coffee: rainfall, fleet/HO fuel, labour costs,
processing & harvest-yield dashboards, cup scores, and a coffee-trading/inventory
module. Next.js 16 (App Router) + Supabase (Postgres) + Vercel.

This file states the **non-obvious truths** a new session needs to avoid common
mistakes. Keep it accurate — a stale instruction here is worse than none. If you
change one of these realities in the code, update this file in the same change.

## Read first

- `ARCHITECTURE.md` — how the system actually fits together and where the bodies
  are buried (two auth systems, public data, etc.).
- `AGENTS.md` — this is **not** the Next.js you know from training data. Next 16
  has breaking changes (middleware is now `proxy.ts`, etc.). Check
  `node_modules/next/dist/docs/` before writing framework code.

## Tech stack (as of 2026-06)

- Next.js `16.2.1`, React `19.2.4`, React Compiler **on** (`reactCompiler: true`
  in `next.config.ts`).
- Supabase JS `2.x` + `@supabase/ssr` for the cookie-based server flow.
- Tailwind v4, shadcn/ui (Radix) components in `src/components/ui`.
- `@anthropic-ai/sdk` for AI insights and invoice parsing.
- Charts: `recharts`. Spreadsheets: `xlsx`.

## Auth — READ THIS BEFORE TOUCHING ANYTHING AUTH-RELATED

There are **two parallel, contradictory auth systems** in this repo. Know which
one is live:

- **LIVE (what the UI uses): PIN login.** `src/app/(auth)/login/page.tsx` loads
  all rows from `app_users` and matches a 4-digit `pin` client-side, then stores
  the user in `localStorage.msp_user` and sets a `msp_auth=1` cookie.
  `src/proxy.ts` only checks that the `msp_auth` cookie *exists*.
- **LEGACY (built but not wired to the UI): Supabase email/password.**
  `login/actions.ts`, `api/auth/login/route.ts`, and `lib/auth/require.ts`
  (`requireUser` / `requireRole`) implement real Supabase Auth. Most dashboard
  pages do **not** call these guards.

Consequences you must keep in mind:
- Role checks (`worker`/`supervisor`/`admin`/`ceo`) read from `localStorage` and
  are **not enforced server-side**. Do not assume a role gate is real security.
- RLS only distinguishes `anon` vs `authenticated` (`auth.role() = 'authenticated'`).
  There is **no per-role or per-estate restriction in the database**.
- `app_users` is readable by `anon` (`USING (true)`), so PINs are exposed to the
  browser. This is a known critical issue — see ARCHITECTURE.md "Known issues".

When asked to "fix auth", the intended direction is to consolidate onto the
Supabase Auth flow and enforce roles server-side. Confirm before assuming.

## Supabase client modules — use the right one

- `src/lib/supabase/server.ts` — server components / route handlers (cookie-aware). **Default for server code.**
- `src/lib/supabase/client.ts` — browser client.
- `src/lib/supabase/admin.ts` — service-role key, **server-only**, never import in client code.
- `src/lib/supabase.ts` — **legacy** anon singleton. Avoid in new code; only the
  PIN login page still uses it. Do not add new imports of it.

Never hardcode keys. Use env vars (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
`ho-fuel/page.tsx` and `ho_fuel_apps_script.js` currently hardcode an anon key —
do not copy that pattern.

## Data / dashboards

- **Processing & yield dashboards are static HTML in `/public`** (e.g.
  `bve-processing-2024-25-v4.html`), embedded via `<iframe>` in thin `page.tsx`
  wrappers under `src/app/(dashboard)/processing-dashboard/...`. To change a
  dashboard's content you edit the HTML file, not the React page. Note: files in
  `/public` are served without auth.
- Versioned HTML (`-v3`, `-v4`) is manual. Pick the latest version referenced by
  the corresponding `page.tsx` before editing.
- Live/dynamic data (rainfall, fuel, cup scores, trading) lives in Supabase tables.

## Database changes

- Canonical migrations live in `supabase/migrations/`.
- Several loose `.sql` files in the repo root (`supabase_rls_policies.sql`,
  `role_permissions_migration.sql`, `update_logins.sql`, `green_lots_import.sql`,
  etc.) were run by hand in the Supabase SQL editor and are **not** part of an
  automated migration history. Treat them as historical/reference. New schema
  changes should go into `supabase/migrations/` — do not add more root SQL files.

## Conventions & gotchas

- Route groups: `(auth)`, `(dashboard)`, `(trading)` — folder names in parens do
  not appear in the URL.
- `src/lib/auth/access.ts` is the single source of truth for nav + role lists.
  Keep it serializable (no React, no server-only imports).
- Some page components are very large (`coffee-storage/page.tsx` ~3,000 lines).
  Prefer extracting helpers/components over growing them further.
- Lint currently reports errors (mostly React-hooks rules) and the build does
  **not** block on them. Don't add new lint errors; run `npx eslint .` before
  finishing.

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build
- `npx tsc --noEmit` — typecheck (currently clean — keep it that way)
- `npx eslint .` — lint
