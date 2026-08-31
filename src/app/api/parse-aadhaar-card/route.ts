/**
 * POST /api/parse-aadhaar-card
 *
 * Extracts visible registration fields from an Aadhaar image/PDF.
 * This is a helper for data entry only; the user still reviews before saving.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { checkRateLimit, rateLimitKey } from '@/lib/auth/rate-limit';

export const dynamic = 'force-dynamic';

const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

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

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiUser(req, ['admin', 'hr', 'supervisor']);
    if ('error' in auth) return auth.error;

    const limited = checkRateLimit({
      key: rateLimitKey('parse-aadhaar-card', auth.user.id),
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if ('error' in limited) return limited.error;

    const body = await req.json();
    const { base64, mediaType } = body as {
      base64?: string;
      mediaType?: string;
    };

    if (!base64 || !mediaType) {
      return NextResponse.json({ error: 'base64 and mediaType are required' }, { status: 400 });
    }

    if (!allowedTypes.includes(mediaType)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    if (base64.length > 14 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_AADHAAR_PARSE_API_KEY || process.env.OPENAI_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'OpenAI API key is not configured for this deployment',
        details: {
          expectedNames: ['OPENAI_API_KEY', 'OPENAI_AADHAAR_PARSE_API_KEY', 'OPENAI_KEY'],
          model: process.env.OPENAI_AADHAAR_PARSE_MODEL ?? 'gpt-4.1',
        },
      }, { status: 500 });
    }

    const contentBlock = mediaType === 'application/pdf'
      ? {
          type: 'input_file' as const,
          filename: 'aadhaar-card.pdf',
          file_data: `data:application/pdf;base64,${base64}`,
        }
      : {
          type: 'input_image' as const,
          image_url: `data:${mediaType};base64,${base64}`,
          detail: 'high' as const,
        };

    const prompt = `This is an Aadhaar card image/PDF being used for MSP Coffee sports registration data entry.

Extract only visible fields and return ONLY valid JSON:
{
  "name": "person name exactly as visible, empty string if unreadable",
  "aadhaar_address": "full address exactly as visible, preserving line breaks with \\n where useful, empty string if unreadable",
  "phone_as_per_aadhaar": "10-digit phone/mobile number if visibly printed on the document, empty string if not visible",
  "notes": "short note about unreadable or missing fields"
}

Rules:
- Return only the JSON object, no markdown.
- Do not invent or infer a phone number. Most Aadhaar cards do not print the linked mobile number; return empty string unless a number is visible.
- Do not return the Aadhaar number.
- Do not translate names or addresses unless the visible document already uses English.
- Preserve visible spelling and address details as much as possible.`;

    const aiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_AADHAAR_PARSE_MODEL ?? 'gpt-4.1',
        max_output_tokens: 1000,
        input: [
          {
            role: 'user',
            content: [
              contentBlock,
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
      return NextResponse.json({ error: 'OpenAI parse failed' }, { status: 502 });
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
      name: cleanString(parsed.name),
      aadhaar_address: cleanString(parsed.aadhaar_address),
      phone_as_per_aadhaar: cleanString(parsed.phone_as_per_aadhaar).replace(/\D/g, '').slice(0, 10),
      notes: cleanString(parsed.notes),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
