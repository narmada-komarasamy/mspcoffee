# Baseline Schema — Reconstruction Notes

The local-dev schema was **reconstructed from application code**, not from a
production dump (we couldn't reach prod over IPv4). This file records what's
confident, what's a guess, and how to run it.

## What was added

- `supabase/migrations/0000_prereqs.sql` — defines `update_updated_at_column()`.
  Fixes a real latent bug: `0001_auth_profiles` references this function but it
  was only defined in the non-migration `fleet_setup.sql`, so `migrations/`
  could not be applied from scratch before now.
- `supabase/migrations/29999_drift_reconstructed.sql` — the tables that existed
  only in prod (`app_users`, `user_permissions`, `rainfall`, `ho_fuel_log`,
  `hilltiller_stock`, `export_orders`), the previously hand-run root files folded
  in (`fleet_daily`, `user_activity`, `role_permissions`), `coffee_sales` column
  additions (`invoice_url`, `customer_address`), anon RLS so the PIN app works,
  and the `invoices` storage bucket.
- `supabase/seed.sql` — fake test users + a little sample data for local dev.

The original three migrations (`0001`, `20260522`, `20260527`) are unchanged.
The root `.sql` files are now redundant for fresh setups but left in place as
historical reference.

## Confidence

**High** (names + types taken directly from `.insert`/`.select` calls or TS
types): `app_users`, `rainfall`, `ho_fuel_log`, `export_orders`,
`user_permissions`, `role_permissions`, `fleet_daily`, `user_activity`, and the
`coffee_sales` column additions.

**Lower — marked `(VERIFY)` in the SQL:**
- `hilltiller_stock` — modelled on `green_lots`; primary-key type and the exact
  column set are inferred. (Prod may use a `text` id like `H-001`.)
- `app_users.id` assumed `uuid`; `pin` assumed plain `text`.
- `user_permissions.user_id` assumed `uuid` with no FK.
- `rainfall.year`/`month` are filled by a trigger here; prod may compute them
  app-side instead.

**RLS divergence (important):** the committed migrations grant only the
`authenticated` role, but the live app uses the **anon** key (PIN auth, no
Supabase session). For the app to actually work, prod must have anon policies
that were added by hand and never captured. The reconstruction adds anon
policies to match that observed behaviour. This is current-reality, *not* the
hardened target — tightening RLS is REMEDIATION.md Phase 2.

## How to run locally

```bash
# one-time
brew install --cask docker        # then launch Docker Desktop once
cd ~/Documents/Projects/mspcoffee
supabase init                      # creates supabase/config.toml (keep defaults)

# bring up the local stack + apply all migrations + seed
supabase start
supabase db reset                  # runs migrations in order, then seed.sql
```

`supabase start` prints local URLs/keys. Put them in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<anon key from `supabase start`>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase start`>
```
Then `npm run dev` and log in at `/login` (e.g. Admin / 1234).

Supabase Studio (local DB browser) runs at http://127.0.0.1:54323.

## Verifying against prod later

When a prod dump (or pooler access) is available:
```bash
supabase db diff --linked        # or diff the dump against this schema
```
Reconcile any differences — especially the `(VERIFY)` items and the real RLS
policies — and fold corrections back into `29999_drift_reconstructed.sql` (or a
follow-up migration). Then this baseline becomes trustworthy, not just runnable.
