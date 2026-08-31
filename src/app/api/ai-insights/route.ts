/**
 * GET /api/ai-insights
 *
 * Pulls live data from Supabase (rainfall, fleet, cup_scores),
 * builds a compact context, and asks Claude to generate structured insights.
 * Returns { insights, summary, refreshedAt }.
 */
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { requireApiUser } from '@/lib/auth/api';
import { checkRateLimit, rateLimitKey } from '@/lib/auth/rate-limit';

export const dynamic = 'force-dynamic';

// ── Static processing KPIs (from 2025-26 season CSVs) ─────────────────────────
const PROCESSING_ESTATES = [
  { name: 'Stanmore Estate',     code: 'SE',  batches: 246, ripe: 118420, dry: 31204, outturn: 26.4 },
  { name: 'Moganad Estate',      code: 'ME',  batches: 407, ripe: 204189, dry: 51182, outturn: 28.3 },
  { name: 'Orchardale Estate',   code: 'OE',  batches: 118, ripe:  48310, dry: 11820, outturn: 24.5 },
  { name: 'Bison Valley Estate', code: 'BVE', batches:  79, ripe:  29440, dry:  7480, outturn: 25.4 },
  { name: 'Hidden Falls Estate', code: 'HFE', batches: 149, ripe:  52161, dry: 12614, outturn: 24.2 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function r1(n: number) { return Math.round(n * 10) / 10; }

// ── Build compact context from Supabase data ───────────────────────────────────
async function buildContext(supabase: SupabaseClient) {
  const today      = new Date().toISOString().split('T')[0];
  const w7ago      = daysAgo(7);
  const w14ago     = daysAgo(14);
  const d30ago     = daysAgo(30);
  const d90ago     = daysAgo(90);

  // ── Rainfall ────────────────────────────────────────────────────────────────
  const { data: rain90 } = await supabase
    .from('rainfall')
    .select('date, estate, rainfall_mm, year')
    .gte('date', d90ago)
    .order('date', { ascending: false });

  const rain90Data = rain90 ?? [];

  // Unique estates in rainfall
  const rainEstates = [...new Set(rain90Data.map(r => r.estate))];

  // This week vs last week per estate
  const rainThisWeek = rain90Data.filter(r => r.date >= w7ago);
  const rainLastWeek = rain90Data.filter(r => r.date >= w14ago && r.date < w7ago);

  const rainStats = rainEstates.map(est => {
    const tw = rainThisWeek.filter(r => r.estate === est).reduce((s, r) => s + (r.rainfall_mm ?? 0), 0);
    const lw = rainLastWeek.filter(r => r.estate === est).reduce((s, r) => s + (r.rainfall_mm ?? 0), 0);
    const season = rain90Data.filter(r => r.estate === est).reduce((s, r) => s + (r.rainfall_mm ?? 0), 0);
    return { estate: est, thisWeek: r1(tw), lastWeek: r1(lw), season90d: r1(season) };
  });

  // Dry streak — count consecutive weeks with <5mm total (all estates combined)
  let dryStreak = 0;
  for (let i = 0; i < 12; i++) {
    const wStart = daysAgo(7 * (i + 1));
    const wEnd   = daysAgo(7 * i);
    const total  = rain90Data.filter(r => r.date >= wStart && r.date < wEnd)
                             .reduce((s, r) => s + (r.rainfall_mm ?? 0), 0);
    if (total < 5) dryStreak++;
    else break;
  }

  // ── Fleet fuel ──────────────────────────────────────────────────────────────
  const { data: fleet30 } = await supabase
    .from('fleet_daily')
    .select('date, vehicle_id, fuel_cost, maint_cost, total_cost, km_run, fuel_filled_l, avg_mileage, fuel_type')
    .gte('date', d30ago);

  const { data: fleet60 } = await supabase
    .from('fleet_daily')
    .select('date, total_cost, km_run')
    .gte('date', daysAgo(60))
    .lt('date', d30ago);

  const fleet30Data = fleet30 ?? [];
  const fleet60Data = fleet60 ?? [];

  const fleetTotalCost30 = fleet30Data.reduce((s, r) => s + (Number(r.total_cost) || 0), 0);
  const fleetTotalCost60 = fleet60Data.reduce((s, r) => s + (Number(r.total_cost) || 0), 0);
  const fleetKm30        = fleet30Data.reduce((s, r) => s + (Number(r.km_run) || 0), 0);
  const fleetFuel30      = fleet30Data.reduce((s, r) => s + (Number(r.fuel_filled_l) || 0), 0);
  const fleetCostPerKm   = fleetKm30 > 0 ? r1(fleetTotalCost30 / fleetKm30) : 0;

  // Per-vehicle summary
  const vehicleMap = new Map<string, { cost: number; km: number; records: number }>();
  fleet30Data.forEach(r => {
    const v = r.vehicle_id ?? 'Unknown';
    const e = vehicleMap.get(v) ?? { cost: 0, km: 0, records: 0 };
    vehicleMap.set(v, { cost: e.cost + (Number(r.total_cost) || 0), km: e.km + (Number(r.km_run) || 0), records: e.records + 1 });
  });
  const vehicleSummary = [...vehicleMap.entries()]
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 5)
    .map(([id, v]) => ({ id, cost: Math.round(v.cost), km: Math.round(v.km), cpkm: v.km > 0 ? r1(v.cost / v.km) : 0 }));

  // ── Cup scores ──────────────────────────────────────────────────────────────
  const { data: cups } = await supabase
    .from('cup_scores')
    .select('name, estate, score, process, year, series')
    .order('score', { ascending: false });

  const cupsData = cups ?? [];
  const cupAvg   = cupsData.length > 0 ? r1(cupsData.reduce((s, c) => s + Number(c.score), 0) / cupsData.length) : 0;
  const cup88plus = cupsData.filter(c => Number(c.score) >= 88).length;
  const cup86plus = cupsData.filter(c => Number(c.score) >= 86).length;
  const topCups   = cupsData.slice(0, 5).map(c => ({ name: c.name, score: c.score, estate: c.estate, process: c.process }));

  // Estate cup avg
  const cupEstates = [...new Set(cupsData.map(c => c.estate))];
  const cupByEstate = cupEstates.map(est => {
    const lots = cupsData.filter(c => c.estate === est);
    const avg  = lots.length ? r1(lots.reduce((s, c) => s + Number(c.score), 0) / lots.length) : 0;
    return { estate: est, lots: lots.length, avg };
  }).sort((a, b) => b.avg - a.avg);

  // ── Assemble context string ─────────────────────────────────────────────────
  const ctx = `
TODAY: ${today}
SEASON: 2025-26 coffee harvest season, Yercaud, Tamil Nadu, India.

=== PROCESSING DASHBOARD (2025-26 season, static data) ===
${PROCESSING_ESTATES.map(e =>
  `${e.name} (${e.code}): ${e.batches} batches | ${e.ripe.toLocaleString()} kg ripe cherry input | ${e.dry.toLocaleString()} kg dry parchment output | ${e.outturn}% outturn`
).join('\n')}
Season total: 999 batches | 453,520 kg ripe | 114,300 kg dry | 25.2% weighted avg outturn
Best estate: Moganad (28.3%) | Worst: HFE (24.2%)

=== RAINFALL (last 90 days) ===
Dry streak: ${dryStreak} consecutive week(s) with <5mm total rainfall
Per-estate this week vs last week:
${rainStats.length > 0 ? rainStats.map(r => `  ${r.estate}: this week ${r.thisWeek}mm | last week ${r.lastWeek}mm | 90-day total ${r.season90d}mm`).join('\n') : '  No rainfall data available in last 90 days.'}

=== FLEET FUEL (last 30 days) ===
Total spend: ₹${Math.round(fleetTotalCost30).toLocaleString('en-IN')} | Previous 30 days: ₹${Math.round(fleetTotalCost60).toLocaleString('en-IN')}
Total km run: ${Math.round(fleetKm30).toLocaleString('en-IN')} km | Fuel used: ${Math.round(fleetFuel30).toLocaleString('en-IN')} L
Avg cost/km: ₹${fleetCostPerKm}
Top vehicles by cost (last 30d):
${vehicleSummary.length > 0 ? vehicleSummary.map(v => `  ${v.id}: ₹${v.cost.toLocaleString('en-IN')} total | ${v.km} km | ₹${v.cpkm}/km`).join('\n') : '  No fleet data.'}

=== CUP SCORES (all seasons on record) ===
Total lots scored: ${cupsData.length} | Avg score: ${cupAvg} | Lots ≥88pts: ${cup88plus} | Lots ≥86pts: ${cup86plus}
Top 5 lots: ${topCups.map(c => `${c.name} (${c.score}pts, ${c.process}, ${c.estate})`).join(' | ')}
Avg score by estate: ${cupByEstate.map(e => `${e.estate}: ${e.avg} (${e.lots} lots)`).join(' | ')}
`.trim();

  return { ctx, rainStats, dryStreak, fleetTotalCost30, fleetTotalCost60, cupsData };
}

// ── Main handler ───────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request);
    if ('error' in auth) return auth.error;

    const limited = checkRateLimit({
      key: rateLimitKey('ai-insights', auth.user.id),
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if ('error' in limited) return limited.error;

    const { ctx } = await buildContext(auth.supabase);

    const client = new Anthropic();
    const msg = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 2048,
      system: `You are an analytics assistant for MSP Coffee, a specialty coffee estate group in Yercaud, India.
Your job: analyse the provided estate data and produce concise, specific, actionable insights in JSON format.

Return ONLY a valid JSON array (no markdown, no commentary) with 8-12 insight objects.
Each object must have exactly these fields:
- "category": one of "processing" | "rainfall" | "fleet" | "cup-scores" | "alert"
- "priority": one of "red" (urgent/action needed) | "amber" (watch/warning) | "green" (positive) | "blue" (informational)
- "estate": estate name or "All Estates"
- "title": max 8-word heading for the insight
- "text": 2-3 sentences. Be specific — include actual numbers from the data. Be direct and actionable.
- "source": short string describing the data source (e.g. "Based on 246 Stanmore processing batches")
- "trend": "up" | "down" | "flat" | null  (direction of the key metric)

Rules:
- Do NOT fabricate numbers not in the data. If data is empty, note that.
- Prioritise alerts (red) and warnings (amber) first.
- Include at least 1 "green" insight highlighting what's going well.
- At least 2 processing insights, 1 rainfall, 1 fleet, 1 cup-scores.
- Keep "text" under 60 words per insight.`,
      messages: [{ role: 'user', content: `Here is the current estate data:\n\n${ctx}\n\nGenerate insights now.` }],
    });

    const raw     = msg.content[0].type === 'text' ? msg.content[0].text : '[]';
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    let insights: unknown[] = [];
    try {
      insights = JSON.parse(cleaned);
    } catch {
      insights = [];
    }

    const needsAttention = (insights as { priority: string }[]).filter(i => i.priority === 'red').length;

    return NextResponse.json({
      insights,
      summary: { total: insights.length, needsAttention },
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
