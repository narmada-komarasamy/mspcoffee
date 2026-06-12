-- ══════════════════════════════════════════════════════════════════
--  MSP COFFEE — ROW LEVEL SECURITY POLICIES
--  Run this entire file in Supabase SQL Editor (once).
--  Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS guards.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. PARCHMENT BATCHES ────────────────────────────────────────
ALTER TABLE parchment_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_parchment_batches"   ON parchment_batches;
DROP POLICY IF EXISTS "auth_write_parchment_batches"  ON parchment_batches;

CREATE POLICY "auth_read_parchment_batches"
  ON parchment_batches FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "auth_write_parchment_batches"
  ON parchment_batches FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── 2. GREEN LOTS ───────────────────────────────────────────────
ALTER TABLE green_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_green_lots"   ON green_lots;
DROP POLICY IF EXISTS "auth_write_green_lots"  ON green_lots;
DROP POLICY IF EXISTS "allow_read_green_lots"  ON green_lots;
DROP POLICY IF EXISTS "allow_all_green_lots"   ON green_lots;

CREATE POLICY "auth_read_green_lots"
  ON green_lots FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "auth_write_green_lots"
  ON green_lots FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── 3. HILLTILLER STOCK ─────────────────────────────────────────
ALTER TABLE hilltiller_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_hilltiller_stock"   ON hilltiller_stock;
DROP POLICY IF EXISTS "auth_write_hilltiller_stock"  ON hilltiller_stock;

CREATE POLICY "auth_read_hilltiller_stock"
  ON hilltiller_stock FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "auth_write_hilltiller_stock"
  ON hilltiller_stock FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── 4. COFFEE SALES ─────────────────────────────────────────────
ALTER TABLE coffee_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_coffee_sales"   ON coffee_sales;
DROP POLICY IF EXISTS "auth_write_coffee_sales"  ON coffee_sales;

CREATE POLICY "auth_read_coffee_sales"
  ON coffee_sales FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "auth_write_coffee_sales"
  ON coffee_sales FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── 5. BLENDS ───────────────────────────────────────────────────
ALTER TABLE blends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_blends"   ON blends;
DROP POLICY IF EXISTS "auth_write_blends"  ON blends;

CREATE POLICY "auth_read_blends"
  ON blends FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "auth_write_blends"
  ON blends FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── 6. BLEND RECIPE ITEMS ───────────────────────────────────────
ALTER TABLE blend_recipe_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_blend_recipe_items"   ON blend_recipe_items;
DROP POLICY IF EXISTS "auth_write_blend_recipe_items"  ON blend_recipe_items;

CREATE POLICY "auth_read_blend_recipe_items"
  ON blend_recipe_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "auth_write_blend_recipe_items"
  ON blend_recipe_items FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── 7. AUDIT LOG (insert-only — no update/delete ever) ──────────
ALTER TABLE coffee_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_audit_log"    ON coffee_audit_log;
DROP POLICY IF EXISTS "auth_insert_audit_log"  ON coffee_audit_log;
DROP POLICY IF EXISTS "auth_write_audit_log"   ON coffee_audit_log;

CREATE POLICY "auth_read_audit_log"
  ON coffee_audit_log FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT only — UPDATE and DELETE are intentionally NOT granted
CREATE POLICY "auth_insert_audit_log"
  ON coffee_audit_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ── 8. USER ACTIVITY LOG ────────────────────────────────────────
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_user_activity"    ON user_activity;
DROP POLICY IF EXISTS "auth_insert_user_activity"  ON user_activity;
DROP POLICY IF EXISTS "auth_update_user_activity"  ON user_activity;

CREATE POLICY "auth_read_user_activity"
  ON user_activity FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "auth_insert_user_activity"
  ON user_activity FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow duration update (on page exit) but not full write
CREATE POLICY "auth_update_user_activity"
  ON user_activity FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ── 9. APP USERS ────────────────────────────────────────────────
--  SELECT is also allowed for anon so the login page can fetch the
--  user list (names only — no sensitive data except hashed PIN).
--  WRITE (INSERT/UPDATE/DELETE) is restricted to authenticated only.
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_app_users"   ON app_users;
DROP POLICY IF EXISTS "anon_read_app_users"   ON app_users;
DROP POLICY IF EXISTS "auth_write_app_users"  ON app_users;

-- Login page needs to read names/IDs without a session
CREATE POLICY "anon_read_app_users"
  ON app_users FOR SELECT
  USING (true);

-- Only authenticated users can manage app_users (admin UI)
CREATE POLICY "auth_write_app_users"
  ON app_users FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── 10. USER PERMISSIONS ────────────────────────────────────────
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_user_permissions"   ON user_permissions;
DROP POLICY IF EXISTS "auth_write_user_permissions"  ON user_permissions;

CREATE POLICY "auth_read_user_permissions"
  ON user_permissions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "auth_write_user_permissions"
  ON user_permissions FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ══════════════════════════════════════════════════════════════════
--  VERIFY — run this query to confirm all tables have RLS enabled:
--
--  SELECT tablename, rowsecurity
--  FROM pg_tables
--  WHERE schemaname = 'public'
--  ORDER BY tablename;
--
--  Every row should show rowsecurity = true.
-- ══════════════════════════════════════════════════════════════════
