# MSP Coffee — Dev / Staging Environment Setup

Standalone guide (tracked separately from `REMEDIATION.md`). Goal: a safe,
prod-like environment to test changes — especially the auth + RLS work — before
anything reaches production.

**Chosen approach:** a **separate Supabase "staging" project** wired to **Vercel
preview deployments**. Branch → preview URL → staging DB → verify → merge to
`main` (production) only when green.

Legend: 🧑 = you do it (dashboard/account access) · 🤖 = I can do it (scripts,
code, config files).

---

## Why this order

You can't faithfully recreate the database yet: the schema is split between
`supabase/migrations/` and six hand-run root `.sql` files
(`supabase_rls_policies.sql`, `role_permissions_migration.sql`,
`update_logins.sql`, `green_lots_import.sql`, `create_activity_log.sql`,
`fleet_setup.sql`). So **Step 1 captures the real prod schema into one source of
truth** — without it, "staging" would just be a guess. Everything else builds on
that.

---

## Step 1 — Capture the current prod schema 🤖🧑

Get one authoritative, re-runnable definition of the database as it exists today.

1. Install the Supabase CLI (one-time): `brew install supabase/tap/supabase`.
2. 🧑 From the Supabase dashboard, grab the **prod** project ref and a DB
   connection string / access token (Project Settings → API / Database).
3. Dump the schema (structure only, no data):
   ```bash
   supabase db dump --db-url "<PROD_CONNECTION_STRING>" -f supabase/schema_snapshot.sql
   ```
   (Or `pg_dump --schema-only`.) This captures tables, RLS policies, functions,
   and grants as they really are — including the policies that only existed
   because someone ran a root `.sql` by hand.
4. 🤖 I reconcile that snapshot into `supabase/migrations/` as a clean baseline
   migration, and move the loose root `.sql` files into `supabase/legacy/` with a
   note that the snapshot supersedes them.

> Do **not** capture prod *data* in this step (it contains real PINs and business
> records). Data handling is Step 3.

**Exit:** `supabase/migrations/` alone can recreate the prod schema from scratch.

---

## Step 2 — Create the staging Supabase project 🧑🤖

1. 🧑 In the Supabase dashboard, create a new project named e.g.
   `mspcoffee-staging` (same region as prod). Note its URL + anon + service-role
   keys.
2. 🤖 Apply the baseline migration from Step 1 to staging:
   ```bash
   supabase link --project-ref <STAGING_REF>
   supabase db push
   ```
3. Confirm tables + RLS exist in staging and match prod structure.

**Exit:** staging has prod's schema and an empty (or near-empty) database.

---

## Step 3 — Seed staging with safe fake data 🤖

Never copy prod credentials into staging. Instead:

1. 🤖 I write a seed script (`supabase/seed_staging.sql` or a small Node script)
   that inserts:
   - A handful of **test auth users** across each role (admin / supervisor /
     worker / ceo) with **known throwaway passwords** — created via the Supabase
     Admin API, not real emails.
   - Matching `profiles` rows (role, estate).
   - A small, realistic-but-fake slice of rainfall / fuel / green_lots /
     coffee_sales so dashboards and the trading flows render.
2. Keep the seed committed and re-runnable so anyone can rebuild staging.

**Exit:** you can log into staging as each role with documented test creds.

---

## Step 4 — Wire Vercel preview deployments 🧑

Vercel already builds a **preview deployment for every branch/PR** — we just
point previews at staging and keep prod keys off them.

1. 🧑 In Vercel → Project → Settings → Environment Variables, set for the
   **Preview** environment only:
   - `NEXT_PUBLIC_SUPABASE_URL` = staging URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` = staging anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = staging service-role key
   - `ANTHROPIC_API_KEY` = a separate/limited key if possible
2. 🧑 Confirm the **Production** environment still holds the (rotated — see
   `REMEDIATION.md` Phase 0.1) **prod** keys, and that Preview never sees prod
   keys.
3. 🤖 Add a committed `.env.example` listing every required var (names only) so
   local dev and onboarding are self-documenting.

**Exit:** opening a preview URL exercises the app against staging, not prod.

---

## Step 5 — Branch & promotion workflow 🧑🤖

1. Work on a feature branch (you already have
   `claude/compassionate-morse-fbba4c`); never commit straight to `main`.
2. Push → Vercel auto-creates a preview deployment on the staging DB.
3. Test there (see Step 6). Iterate on the branch.
4. Open a PR into `main`. Merging to `main` triggers the **production** deploy.
5. Apply DB migrations to **prod** deliberately (`supabase db push` against the
   prod ref) as part of the release, not automatically — schema changes to a live
   business DB should be a conscious step.

**Exit:** a clear path from branch → staging preview → prod, with DB changes
gated.

---

## Step 6 — Verification checklist (run on staging before any prod merge)

Especially relevant once auth/RLS work starts:

- Log in as each role; confirm nav + page access match `src/lib/auth/access.ts`.
- Confirm an unauthenticated user is redirected from every protected route and
  from `/api/*`.
- Confirm RLS blocks a worker from writing tables they shouldn't, and that CEO is
  read-only — tested by hitting the DB directly with that user's session, not
  just by hiding buttons in the UI.
- Confirm no PIN/credential list is returned to the browser on `/login`.
- Confirm `/public` dashboard URLs behave as intended (open now; gated after
  Phase 3).
- `npx tsc --noEmit` clean; `npx eslint .` no new errors; `npm run build` passes.

---

## What I need from you to start

- 🧑 Supabase: ability to create the staging project + the prod connection string
  for the schema dump (Step 1–2).
- 🧑 Vercel: access to set Preview env vars (Step 4).
- Confirm the **email convention** for test users (ties into `REMEDIATION.md`
  Phase 1).

Once Step 1's schema capture is done, I can do Steps 2–4's scripting/config and
hand you the exact dashboard clicks for the parts only you can do.
