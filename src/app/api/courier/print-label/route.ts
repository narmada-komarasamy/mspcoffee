import { courierAuth } from '../_auth';
import { labelHtml } from '@/lib/courier-print';

export async function POST(request: Request) {
  const auth = await courierAuth(request, true); if ('error' in auth) return auth.error;
  try {
    const form = await request.formData();
    return new Response(labelHtml(Object.fromEntries(form)), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'self'" } });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Unable to print label.', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
}
