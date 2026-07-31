/**
 * POST /api/parse-fleet-entry
 *
 * Accepts odometer and fuel bill images, then uses OpenAI vision to extract
 * a draft fleet fuel entry. The caller must still review before saving.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function extractOutputText(payload: unknown) {
  const response = payload as {
    output_text?: unknown;
    output?: { content?: { type?: string; text?: string }[] }[];
  };

  if (typeof response.output_text === 'string') return response.output_text;

  return response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? '')
    .filter(Boolean)
    .join('\n') ?? '{}';
}

function cleanString(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function cleanNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      odometerBase64,
      odometerMediaType,
      billBase64,
      billMediaType,
      vehicleHints,
    } = body as {
      odometerBase64?: string;
      odometerMediaType?: string;
      billBase64?: string;
      billMediaType?: string;
      vehicleHints?: string[];
    };

    if (!odometerBase64 && !billBase64) {
      return NextResponse.json({ error: 'At least one odometer or bill image is required' }, { status: 400 });
    }

    const images = [
      { label: 'odometer', base64: odometerBase64, mediaType: odometerMediaType },
      { label: 'fuel bill', base64: billBase64, mediaType: billMediaType },
    ].filter((image) => image.base64);

    for (const image of images) {
      if (!image.mediaType || !allowedTypes.includes(image.mediaType)) {
        return NextResponse.json({ error: `Unsupported ${image.label} file type` }, { status: 400 });
      }
      if ((image.base64 ?? '').length > 14 * 1024 * 1024) {
        return NextResponse.json({ error: `${image.label} file too large (max 10 MB)` }, { status: 413 });
      }
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_FLEET_PARSE_API_KEY || process.env.OPENAI_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'OpenAI API key is not configured for this deployment',
        details: {
          expectedNames: ['OPENAI_API_KEY', 'OPENAI_FLEET_PARSE_API_KEY', 'OPENAI_KEY'],
          model: process.env.OPENAI_FLEET_PARSE_MODEL ?? 'gpt-4.1',
        },
      }, { status: 500 });
    }

    const content = [
      ...images.map((image) => ({
        type: 'input_image' as const,
        image_url: `data:${image.mediaType};base64,${image.base64}`,
        detail: 'high' as const,
      })),
      {
        type: 'input_text' as const,
        text: `These images are for MSP Coffee fleet fuel expenses. One may be a vehicle odometer photo and one may be a fuel bill/receipt.

Known vehicle IDs in the system:
${(vehicleHints ?? []).slice(0, 80).join(', ') || 'None provided'}

Extract the fields for a draft row in fleet_daily and return ONLY valid JSON:
{
  "date": "YYYY-MM-DD or empty string",
  "vehicle_id": "vehicle registration or closest known vehicle ID, empty string if unreadable",
  "starting_km": number or null,
  "closing_km": number or null,
  "fuel_filled_l": number or null,
  "fuel_cost": number or null,
  "fuel_type": "Diesel, Petrol, or empty string",
  "vendor": "fuel station/vendor text or empty string",
  "confidence": "high, medium, or low",
  "notes": "short note about uncertainty, unreadable fields, or assumptions"
}

Rules:
- Return ONLY the JSON object, no markdown.
- Odometer reading is usually closing_km unless the image clearly labels start/previous.
- If only one odometer number is visible, put it in closing_km and leave starting_km null.
- Fuel filled must be litres, not price or quantity count.
- Fuel cost must be INR amount paid.
- If the bill shows multiple amounts, use the final paid/net amount for fuel_cost.
- Use null for unreadable numeric fields instead of guessing.
- Match vehicle_id to a known vehicle ID only when the visible registration is clearly the same vehicle.`,
      },
    ];

    const aiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_FLEET_PARSE_MODEL ?? 'gpt-4.1',
        max_output_tokens: 1200,
        input: [
          {
            role: 'user',
            content,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      return NextResponse.json({ error: `OpenAI parse failed: ${errorText}` }, { status: 502 });
    }

    const aiPayload = await aiResponse.json();
    const raw = extractOutputText(aiPayload);
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'AI returned unparseable response', raw }, { status: 422 });
    }

    return NextResponse.json({
      date: cleanString(parsed.date),
      vehicle_id: cleanString(parsed.vehicle_id),
      starting_km: cleanNumber(parsed.starting_km),
      closing_km: cleanNumber(parsed.closing_km),
      fuel_filled_l: cleanNumber(parsed.fuel_filled_l),
      fuel_cost: cleanNumber(parsed.fuel_cost),
      fuel_type: cleanString(parsed.fuel_type),
      vendor: cleanString(parsed.vendor),
      confidence: cleanString(parsed.confidence) || 'low',
      notes: cleanString(parsed.notes),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
