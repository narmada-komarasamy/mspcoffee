/**
 * POST /api/parse-invoice
 *
 * Accepts a base64-encoded invoice image or PDF page and uses Claude vision
 * to extract: customer_name, customer_address, invoice_number, quantity_kg, price_per_kg.
 * Returns { customer_name, customer_address, invoice_number, quantity_kg, price_per_kg }
 */
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

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
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!ALLOWED_TYPES.includes(mediaType)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }
    // ~10 MB limit: base64 inflates by ~33%, so 10 MB file ≈ 13.6 MB base64
    if (base64.length > 14 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });
    }

    const client = new Anthropic();

    // For PDFs, Anthropic requires document type; for images, use image type
    const isPdf = mediaType === 'application/pdf';

    const contentBlock = isPdf
      ? {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: base64,
          },
        }
      : {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64,
          },
        };

    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            {
              type: 'text',
              text: `This is a green coffee sales invoice from MSP Coffee (an Indian specialty coffee estate group based in Yercaud, Tamil Nadu).

Extract the following fields and return ONLY valid JSON with these exact keys:
{
  "customer_name": "full company or person name of the buyer (BILL TO / buyer party, NOT the seller MSP Coffee)",
  "customer_address": "full postal address of the buyer (multi-line as single string with \\n)",
  "invoice_number": "invoice or order reference number (e.g. MSP/SI/26/278)",
  "quantity_kg": <numeric total kg of green coffee sold, null if not found>,
  "price_per_kg": <numeric INR price per kg, null if not found>,
  "lot_number": "the green coffee lot number from the product/item description line — this is typically a 2-4 digit number like '202' or '48' appearing next to the estate name (e.g. 'Moganad Estate', 'Stanmore Estate', 'Orchardale Estate', 'Bison Valley Estate', 'Hidden Falls Estate') and process type (Natural, Washed, etc.). Look in the line item description, NOT in addresses, page numbers, bag counts, or reference numbers. Return ONLY the numeric lot identifier. null if not found."
}

Rules:
- Return ONLY the JSON object, no markdown, no commentary.
- If a field cannot be found, use null.
- quantity_kg and price_per_kg must be numbers (not strings).
- If the invoice uses a different unit (e.g. grams, bags), convert to kg.
- For lot_number: the product line will typically read something like "Green Coffee - Lot 202 - Moganad Estate - Natural" or "Green Coffee Beans, Lot No. 48, Orchardale Estate, Washed". Extract ONLY the lot number digits (e.g. "202" or "48"). Do NOT confuse with bag quantity, page numbers, HSN codes, or reference numbers.
- If the invoice is in a language other than English, translate field values to English.`,
            },
          ],
        },
      ],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'AI returned unparseable response', raw }, { status: 422 });
    }

    return NextResponse.json({
      customer_name: parsed.customer_name ?? null,
      customer_address: parsed.customer_address ?? null,
      invoice_number: parsed.invoice_number ?? null,
      quantity_kg: parsed.quantity_kg ?? null,
      price_per_kg: parsed.price_per_kg ?? null,
      lot_number: parsed.lot_number ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
