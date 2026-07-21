/**
 * POST /api/parse-employee-form
 *
 * Accepts a base64-encoded employee application PDF/image and uses OpenAI vision
 * to extract the fields used by Estate Management > Muster Roll > Employee Center.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FORM_KEYS = [
  'estateName',
  'fullName',
  'parentSpouseName',
  'dob',
  'age',
  'gender',
  'maritalStatus',
  'aadhaar',
  'pan',
  'mobile',
  'altContact',
  'reference',
  'permAddress',
  'currAddress',
  'empId',
  'doj',
  'jobRole',
  'section',
  'wage',
  'payMode',
  'bankAcc',
  'ifsc',
  'experience',
  'education',
  'epf',
  'esi',
  'emName',
  'emNumber',
  'bloodGroup',
  'medical',
  'nomineeName',
  'nomineeRel',
  'empSigDate',
  'hrSigDate',
  'mdSigDate',
] as const;

function stringOrEmpty(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { base64, mediaType } = body as {
      base64: string;
      mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf';
    };

    if (!base64 || !mediaType) {
      return NextResponse.json({ error: 'base64 and mediaType are required' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(mediaType)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    if (base64.length > 14 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
    }

    const isPdf = mediaType === 'application/pdf';
    const contentBlock = isPdf
      ? {
          type: 'input_file' as const,
          filename: 'employee-application.pdf',
          file_data: `data:application/pdf;base64,${base64}`,
        }
      : {
          type: 'input_image' as const,
          image_url: `data:${mediaType};base64,${base64}`,
          detail: 'high' as const,
        };

    const prompt = `This is an MSP Coffee estate employee application form for farm labor / plantation workers. It may be English, Tamil, handwritten, typed, scanned, or a PDF/image.

Extract the filled values and return ONLY valid JSON with these exact keys:
{
  "estateName": "",
  "fullName": "",
  "parentSpouseName": "",
  "dob": "",
  "age": "",
  "gender": "",
  "maritalStatus": "",
  "aadhaar": "",
  "pan": "",
  "mobile": "",
  "altContact": "",
  "reference": "",
  "permAddress": "",
  "currAddress": "",
  "empId": "",
  "doj": "",
  "jobRole": "",
  "section": "",
  "wage": "",
  "payMode": "",
  "bankAcc": "",
  "ifsc": "",
  "experience": "",
  "education": "",
  "epf": "",
  "esi": "",
  "emName": "",
  "emNumber": "",
  "bloodGroup": "",
  "medical": "",
  "nomineeName": "",
  "nomineeRel": "",
  "empSigDate": "",
  "hrSigDate": "",
  "mdSigDate": "",
  "family": [
    { "name": "", "relationship": "", "age": "", "aadhaar": "" }
  ]
}

Rules:
- Return ONLY the JSON object, no markdown, no commentary.
- If a field is blank or unreadable, return "" for that field.
- Dates should be YYYY-MM-DD when you can infer them confidently; otherwise preserve the visible date text.
- gender should be "M", "F", or "Other" when marked.
- payMode should be "Cash" or "Bank" when marked.
- Preserve Aadhaar, PAN, mobile, bank account and IFSC exactly as visible.
- Translate Tamil field values to English only when helpful, but keep names, addresses, IDs and numbers exactly as written.
- For family, include one object per filled family row; if no family row is filled, return an empty array.`;

    const aiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_EMPLOYEE_FORM_MODEL ?? 'gpt-4.1',
        max_output_tokens: 2000,
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
      const errorText = await aiResponse.text();
      return NextResponse.json({ error: `OpenAI parse failed: ${errorText}` }, { status: 502 });
    }

    const aiPayload = await aiResponse.json();
    const raw = extractOutputText(aiPayload);
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'AI returned unparseable response', raw }, { status: 422 });
    }

    const response: Record<string, unknown> = {};
    for (const key of FORM_KEYS) response[key] = stringOrEmpty(parsed[key]);
    response.family = Array.isArray(parsed.family)
      ? parsed.family.map((row) => {
          const item = row as Record<string, unknown>;
          return {
            name: stringOrEmpty(item.name),
            relationship: stringOrEmpty(item.relationship),
            age: stringOrEmpty(item.age),
            aadhaar: stringOrEmpty(item.aadhaar),
          };
        }).filter((row) => row.name || row.relationship || row.age || row.aadhaar)
      : [];

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
