import { text, validDate } from '@/lib/courier';

export const TICKET_STATUSES = ['Open', 'Following up', 'Resolved'] as const;
export type TicketEvent = { at: string; actor: string; status: string; owner: string; nextFollowup: string | null; problem: string; note: string };
export type CourierTicket = {
  id: string; shipment_id: string; ticket_number: number; status: string;
  problem: string; owner: string; next_followup: string | null;
  history: TicketEvent[]; revision: number; created_at: string; updated_at: string;
};

export function ticketFields(input: Record<string, unknown>) {
  const status = text(input.status, 30);
  const problem = text(input.problem, 600);
  const owner = text(input.owner, 100);
  const next = text(input.nextFollowup, 10);
  const note = text(input.note, 300);
  if (!TICKET_STATUSES.includes(status as typeof TICKET_STATUSES[number])) throw new Error('Choose a valid ticket status.');
  if (!problem || !owner) throw new Error('Enter the problem and the person responsible for follow-up.');
  if (next && !validDate(next)) throw new Error('Enter a valid next follow-up date.');
  if (status === 'Resolved' && !note) throw new Error('Add a resolution note before marking the ticket Resolved.');
  return { status, problem, owner, next_followup: next || null, note };
}

export function ticketNumber(ticket: Pick<CourierTicket, 'ticket_number'>) {
  return `MSP-TKT-${String(ticket.ticket_number).padStart(5, '0')}`;
}
