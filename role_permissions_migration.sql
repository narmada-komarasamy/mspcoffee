-- ══════════════════════════════════════════════════════════════════
--  MSP COFFEE — ROLE PERMISSIONS TABLE
--  Run this in Supabase SQL Editor.
--  Safe to re-run: uses IF NOT EXISTS guards.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Create table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  id         BIGSERIAL PRIMARY KEY,
  page_href  TEXT NOT NULL,
  role       TEXT NOT NULL,
  access     TEXT NOT NULL DEFAULT 'full'
             CHECK (access IN ('none', 'view', 'full')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (page_href, role)
);

-- ── 2. Seed with sensible defaults ──────────────────────────────
INSERT INTO role_permissions (page_href, role, access) VALUES
  ('/rainfall',             'supervisor', 'full'),
  ('/rainfall',             'worker',     'full'),
  ('/fuel-expenses',        'supervisor', 'full'),
  ('/fuel-expenses',        'worker',     'none'),
  ('/ho-fuel',              'supervisor', 'full'),
  ('/ho-fuel',              'worker',     'none'),
  ('/processing-dashboard', 'supervisor', 'full'),
  ('/processing-dashboard', 'worker',     'none'),
  ('/labour-costs',         'supervisor', 'none'),
  ('/labour-costs',         'worker',     'none'),
  ('/daily-report',         'supervisor', 'full'),
  ('/daily-report',         'worker',     'full'),
  ('/estate-management/muster-roll', 'supervisor', 'full'),
  ('/estate-management/muster-roll', 'worker',     'full'),
  ('/harvest-yield',        'supervisor', 'full'),
  ('/harvest-yield',        'worker',     'none'),
  ('/nursery',              'supervisor', 'full'),
  ('/nursery',              'worker',     'none'),
  ('/spraying-log',         'supervisor', 'full'),
  ('/spraying-log',         'worker',     'none'),
  ('/vehicle-log',          'supervisor', 'full'),
  ('/vehicle-log',          'worker',     'none'),
  ('/store-inventory',      'supervisor', 'full'),
  ('/store-inventory',      'worker',     'full'),
  ('/shopify-orders',       'supervisor', 'full'),
  ('/shopify-orders',       'worker',     'full'),
  ('/weather',              'supervisor', 'full'),
  ('/weather',              'worker',     'full'),
  ('/ai-insights',          'supervisor', 'full'),
  ('/ai-insights',          'worker',     'full')
ON CONFLICT (page_href, role) DO NOTHING;

-- ── 3. Row Level Security ────────────────────────────────────────
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_role_permissions"  ON role_permissions;
DROP POLICY IF EXISTS "auth_write_role_permissions" ON role_permissions;

-- Layouts read this on every page load (no auth session in this app)
CREATE POLICY "anon_read_role_permissions"
  ON role_permissions FOR SELECT
  USING (true);

-- Only authenticated sessions can change permissions (admin UI)
CREATE POLICY "auth_write_role_permissions"
  ON role_permissions FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── 4. Verify ────────────────────────────────────────────────────
-- SELECT * FROM role_permissions ORDER BY role, page_href;
