/**
 * POST /api/ai-insights/ask
 * Body: { question: string, history?: { role: 'user'|'assistant', content: string }[] }
 *
 * Streams a Claude response grounded in live Supabase data.
 */
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

const PROCESSING_SUMMARY = `
Processing season 2025-26:
- Stanmore Estate (SE): 246 batches, 26.4% outturn, 118,420 kg ripe cherry input
- Moganad Estate (ME): 407 batches, 28.3% outturn, 204,189 kg ripe cherry input (best performer)
- Orchardale Estate (OE): 118 batches, 24.5% outturn, 48,310 kg ripe cherry input
- Bison Valley Estate (BVE): 79 batches, 25.4% outturn, 29,440 kg ripe cherry input
- Hidden Falls Estate (HFE): 149 batches, 24.2% outturn, 52,161 kg ripe cherry input
Season total: 999 batches, ~114,300 kg dry parchment, 25.2% weighted avg outturn
`.trim();

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export async function POST(request: Request) {
  const body = await request.json();
  const question: string = body.question ?? '';
  const history: { role: 'user' | 'assistant'; content: string }[] = body.history ?? [];

  if (!question.trim()) {
    return new Response('Question is required', { status: 400 });
  }

  // Fetch live context
  const supabase = await createClient();

  const [rainRes, fleetRes, cupRes] = await Promise.all([
    supabase.from('rainfall').select('date,estate,rainfall_mm').gte('date', daysAgo(30)).order('date', { ascending: false }),
    supabase.from('fleet_daily').select('date,vehicle_id,total_cost,km_run,fuel_filled_l').gte('date', daysAgo(30)),
    supabase.from('cup_scores').select('name,estate,score,process,year').order('score', { ascending: false }).limit(20),
  ]);

  const rainData  = rainRes.data  ?? [];
  const fleetData = fleetRes.data ?? [];
  const cupData   = cupRes.data   ?? [];

  const totalRain = rainData.reduce((s, r) => s + (Number(r.rainfall_mm) || 0), 0);
  const fleetCost = fleetData.reduce((s, r) => s + (Number(r.total_cost) || 0), 0);
  const fleetKm   = fleetData.reduce((s, r) => s + (Number(r.km_run) || 0), 0);
  const cupAvg    = cupData.length ? (cupData.reduce((s, c) => s + Number(c.score), 0) / cupData.length).toFixed(1) : 'N/A';

  const liveContext = `
CURRENT DATE: ${new Date().toISOString().split('T')[0]}
SEASON: 2025-26, Yercaud, India.

${PROCESSING_SUMMARY}

RAINFALL (last 30 days):
Total all estates: ${totalRain.toFixed(1)} mm
Recent records: ${rainData.slice(0, 10).map(r => `${r.date} ${r.estate} ${r.rainfall_mm}mm`).join(', ')}

FLEET FUEL (last 30 days):
Total spend: ₹${Math.round(fleetCost).toLocaleString('en-IN')} | Total km: ${Math.round(fleetKm).toLocaleString('en-IN')} km
Cost/km: ₹${fleetKm > 0 ? (fleetCost / fleetKm).toFixed(2) : 'N/A'}

CUP SCORES (top lots on record):
Avg score: ${cupAvg} pts
Top lots: ${cupData.slice(0, 8).map(c => `${c.name} ${c.score}pts (${c.process}, ${c.estate})`).join(' | ')}
`.trim();

  const client = new Anthropic();
  const stream = await client.messages.stream({
    model:      'claude-3-5-haiku-20241022',
    max_tokens: 512,
    system: `You are an AI analytics assistant for MSP Coffee estates in Yercaud, India.
You have access to live data below. Answer questions concisely and specifically — always cite actual numbers from the data.
Keep answers under 120 words. If the data doesn't cover something, say so clearly.

LIVE DATA:
${liveContext}`,
    messages: [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: question },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
  });
}
