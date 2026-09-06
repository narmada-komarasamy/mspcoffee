-- Backfill year/month for existing rainfall rows where the columns are NULL,
-- then ensure the trigger that auto-populates them on insert/update exists.
--
-- Root cause: the rainfall_set_year_month trigger was missing on the live
-- database, so rows written by Apps Script or the app have year/month = null.
-- That empties the year dropdown on the infographic page.

-- 1. Backfill
UPDATE public.rainfall
SET year = EXTRACT(year FROM date::date),
 month = EXTRACT(month FROM date::date)
WHERE year IS NULL OR month IS NULL;

-- 2. Re-create the trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.rainfall_set_year_month()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
 NEW.year := EXTRACT(year FROM NEW.date);
 NEW.month := EXTRACT(month FROM NEW.date);
 RETURN NEW;
END
$$;

-- 3. Re-create the trigger (idempotent)
DROP TRIGGER IF EXISTS rainfall_year_month ON public.rainfall;
CREATE TRIGGER rainfall_year_month
 BEFORE INSERT OR UPDATE ON public.rainfall
 FOR EACH ROW EXECUTE FUNCTION public.rainfall_set_year_month();
