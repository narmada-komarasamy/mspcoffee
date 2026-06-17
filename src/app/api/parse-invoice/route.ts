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
              text: `Extract the following fields from this invoice and return ONLY valid JSON with these exact keys:
{
  "customer_name": "full company or person name of the buyer",
  "customer_address": "full postal address of the buyer (multi-line as single string with \\n)",
  "invoice_number": "invoice or order number",
  "quantity_kg": <numeric kg sold, null if not found or unclear>,
  "price_per_kg": <numeric INR price per kg, null if not found or unclear>,
  "lot_number": "the green coffee lot number or lot ID referenced on the invoice (e.g. '48', 'LOT-48', 'G-048'), null if not found"
}

Rules:
- Return ONLY the JSON object, no markdown, no commentary.
- If a field cannot be found, use null.
- quantity_kg and price_per_kg must be numbers (not strings).
- If the invoice uses a different unit (e.g. grams, bags), convert to kg.
- customer_name is the BUYER / BILL TO party, not the seller.
- lot_number: look for terms like "Lot", "Lot No", "Lot #", "Lot Number", "Green Lot", "Batch", "Item Code" near the product description. Return only the numeric or alphanumeric identifier (e.g. "48" or "202"), not the full product description.
- If the invoice is in a language other than English, translate the field values to English.`,
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
