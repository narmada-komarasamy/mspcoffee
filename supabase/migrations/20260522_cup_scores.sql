-- ─────────────────────────────────────────────────────────────────────────────
-- Cup Scores table
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New Query)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cup_scores (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  lot            TEXT          NOT NULL,
  series         TEXT          NOT NULL DEFAULT 'Gold Series',
  name           TEXT          NOT NULL,
  type           TEXT          NOT NULL DEFAULT 'Arabica',
  estate         TEXT          NOT NULL,
  process        TEXT          NOT NULL DEFAULT 'Natural',
  process_detail TEXT          NOT NULL DEFAULT '—',
  score          NUMERIC(5,2)  NOT NULL,
  price_inr      TEXT          NOT NULL DEFAULT '—',
  price_usd      TEXT          NOT NULL DEFAULT '—',
  date           TEXT          NOT NULL DEFAULT '—',
  field          TEXT          NOT NULL DEFAULT '—',
  acidity        TEXT          NOT NULL DEFAULT '—',
  body           TEXT          NOT NULL DEFAULT '—',
  notes          TEXT          NOT NULL DEFAULT '—',
  qty            TEXT          NOT NULL DEFAULT '—',
  year           INTEGER       NOT NULL,
  is_seed        BOOLEAN       NOT NULL DEFAULT FALSE,
  created_by     TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Prevent duplicate seed rows (lot + year + estate must be unique)
CREATE UNIQUE INDEX IF NOT EXISTS cup_scores_lot_year_estate_idx
  ON cup_scores (lot, year, estate);

-- ── Row-Level Security ────────────────────────────────────────────────────────
-- The app uses PIN-based auth (not Supabase Auth), so API routes run with the
-- publishable/anon key. Access is gated at the Next.js page level (admin +
-- supervisor roles only). RLS is kept on for defence-in-depth but policies
-- allow the anon role since server-side API routes use the publishable key.

ALTER TABLE cup_scores ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running this migration
DROP POLICY IF EXISTS "cup_scores_select"  ON cup_scores;
DROP POLICY IF EXISTS "cup_scores_insert"  ON cup_scores;
DROP POLICY IF EXISTS "cup_scores_update"  ON cup_scores;
DROP POLICY IF EXISTS "cup_scores_delete"  ON cup_scores;

-- Allow reads for everyone using the publishable key (anon role)
CREATE POLICY "cup_scores_select"
  ON cup_scores FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow inserts for anon + authenticated
CREATE POLICY "cup_scores_insert"
  ON cup_scores FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow updates for anon + authenticated
CREATE POLICY "cup_scores_update"
  ON cup_scores FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Only allow deleting non-seed rows
CREATE POLICY "cup_scores_delete"
  ON cup_scores FOR DELETE
  TO anon, authenticated
  USING (is_seed = FALSE);

-- ── Auto-update updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cup_scores_updated_at ON cup_scores;
CREATE TRIGGER cup_scores_updated_at
  BEFORE UPDATE ON cup_scores
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
