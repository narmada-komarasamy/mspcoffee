/**
 * POST /api/estate-produce/photo-count
 *
 * Estimates visible produce count from an uploaded photo. This is an assisted
 * verification step only; the user must review before saving official quantity.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { checkRateLimit, rateLimitKey } from '@/lib/auth/rate-limit';

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

function cleanCount(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiUser(req, ['admin', 'supervisor', 'worker', 'ceo', 'hr']);
    if ('error' in auth) return auth.error;

    const limited = checkRateLimit({
      key: rateLimitKey('estate-produce-photo-count', auth.user.id),
      limit: 30,
      windowMs: 60 * 60 * 1000,
    });
    if ('error' in limited) return limited.error;

    const body = await req.json();
    const { base64, mediaType, product } = body as {
      base64?: string;
      mediaType?: string;
      product?: string;
    };

    if (!base64 || !mediaType) {
      return NextResponse.json({ error: 'base64 and mediaType are required' }, { status: 400 });
    }

    if (!allowedTypes.includes(mediaType)) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
    }

    if (base64.length > 14 * 1024 * 1024) {
      return NextResponse.json({ error: 'Photo too large (max 10 MB)' }, { status: 413 });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_ESTATE_PRODUCE_API_KEY || process.env.OPENAI_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'OpenAI API key is not configured for this deployment',
        details: {
          expectedNames: ['OPENAI_API_KEY', 'OPENAI_ESTATE_PRODUCE_API_KEY', 'OPENAI_KEY'],
          model: process.env.OPENAI_ESTATE_PRODUCE_MODEL ?? 'gpt-4.1',
        },
      }, { status: 500 });
    }

    const prompt = `This is an MSP Coffee estate produce photo. Estimate the visible count of the product in the image.

Product hint: ${cleanString(product) || 'unknown produce'}

Return ONLY valid JSON:
{
  "min": number or null,
  "max": number or null,
  "best": number or null,
  "confidence": "high, medium, or low",
  "notes": "short note about overlap, blocked items, blur, damaged pieces, or uncertainty"
}

Rules:
- Count only clearly visible produce items.
- If items overlap or some are hidden, return a range in min/max and put your best estimate in best.
- Do not count leaves, stems, shadows, sacks, boxes, or background objects.
- Use null only if a count is not possible.
- Return JSON only, no markdown.`;

    const aiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_ESTATE_PRODUCE_MODEL ?? 'gpt-4.1',
        max_output_tokens: 500,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_image',
                image_url: `data:${mediaType};base64,${base64}`,
                detail: 'high',
              },
              {
                type: 'input_text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      return NextResponse.json({ error: 'OpenAI photo count failed' }, { status: 502 });
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
      min: cleanCount(parsed.min),
      max: cleanCount(parsed.max),
      best: cleanCount(parsed.best),
      confidence: cleanString(parsed.confidence) || 'low',
      notes: cleanString(parsed.notes),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
