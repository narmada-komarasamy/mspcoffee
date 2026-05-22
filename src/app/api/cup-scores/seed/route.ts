/**
 * POST /api/cup-scores/seed
 *
 * One-time endpoint to import the 73 original hardcoded lots into Supabase.
 * Safe to call multiple times — uses upsert with ignoreDuplicates.
 * Requires an active admin session (same Supabase auth cookie as the dashboard).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SEED_COFFEES } from '@/lib/cup-scores-seed';

export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  return NextResponse.json({ seeded: count ?? records.length });
}
