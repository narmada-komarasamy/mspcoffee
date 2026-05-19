-- ============================================================
-- MSP Coffee — Update app_users logins
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Admin  → PIN 1234
UPDATE app_users SET pin = '1234' WHERE name = 'Admin';

-- 2. AM  → PIN 1234
UPDATE app_users SET pin = '1234' WHERE name = 'AM';

-- 3. Rename Gowri Supervisor → NM, PIN 1234
UPDATE app_users SET name = 'NM', pin = '1234' WHERE name = 'Gowri Supervisor';

-- 4. Rename Orchardale Supervisor → MR, PIN 1234
UPDATE app_users SET name = 'MR', pin = '1234' WHERE name = 'Orchardale Supervisor';

-- 5. Add Manager (admin role) → PIN 3333  [skips if already exists]
INSERT INTO app_users (name, pin, role, estate)
SELECT 'Manager', '3333', 'admin', null
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE name = 'Manager');

-- 6. HR  → PIN 3333
UPDATE app_users SET pin = '3333' WHERE name = 'HR';

-- Verify — should show 6 rows in the order below
SELECT name, role, estate, pin FROM app_users ORDER BY name;
