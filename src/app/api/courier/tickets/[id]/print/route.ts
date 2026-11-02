import { courierAuth } from '../../../_auth';
import { UUID_RE } from '@/lib/auth/api';
import { ticketHtml } from '@/lib/courier-print';
import type { CourierTicket } from '@/lib/courier-tickets';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await courierAuth(request); if ('error' in auth) return auth.error;
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return new Response('Invalid ticket.', { status: 400 });
  const { data: ticket, error } = await auth.supabase.from('courier_tickets').select('*').eq('id', id).maybeSingle();
  if (error) return new Response('Unable to load ticket.', { status: 503 });
  if (!ticket) return new Response('Ticket not found.', { status: 404 });
  const shipment = await auth.supabase.from('courier_shipments').select('data,receipt_path').eq('id', ticket.shipment_id).single();
  if (shipment.error) return new Response('Unable to load shipment details.', { status: 503 });
  return new Response(ticketHtml(ticket as CourierTicket, shipment.data.data, !!shipment.data.receipt_path), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'self'" } });
}
