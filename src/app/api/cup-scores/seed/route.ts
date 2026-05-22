/**
 * GET  /api/cup-scores/seed  ← just navigate to this URL in the browser while logged in
 * POST /api/cup-scores/seed  ← or call via fetch('/api/cup-scores/seed',{method:'POST'})
 *
 * Idempotent — safe to call multiple times. Skips rows that already exist.
 * Requires an active session (log into the dashboard first).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SEED_COFFEES } from '@/lib/cup-scores-seed';

async function runSeed() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized — log into the dashboard first, then visit this URL again.' },
      { status: 401 },
    );
  }

  const records = SEED_COFFEES.map((c) => ({
    lot:            c.lot,
    series:         c.series,
    name:           c.name,
    type:           c.type,
    estate:         c.estate,
    process:        c.process,
    process_detail: c.processDetail,
    score:          c.score,
    price_inr:      c.priceINR,
    price_usd:      c.priceUSD,
    date:           c.date,
    field:          c.field,
    acidity:        c.acidity,
    body:           c.body,
    notes:          c.notes,
    qty:            c.qty,
    year:           c.year,
    is_seed:        true,
    created_by:     'system-seed',
  }));

  const { error, count } = await supabase
    .from('cup_scores')
    .upsert(records, { onConflict: 'lot,year,estate', ignoreDuplicates: true })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok:    true,
    seeded: count ?? records.length,
    total:  records.length,
    note:  'Already-existing rows were skipped (idempotent).',
  });
}

export const GET  = runSeed;
export const POST = runSeed;
