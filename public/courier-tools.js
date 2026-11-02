'use strict';
// Uses the authenticated shipment page's API helper and records; no browser-local ticket storage.
let courierTickets = [], activeCourierTicket = null, openingCourierTicket = false;

function courierLabel(shipment) {
  const values = shipment || Object.fromEntries(['recipientName', 'address', 'city', 'phone', 'courier', 'tracking', 'onBehalfOf'].map(key => [key, $(key).value.trim()]));
  if (!shipment) {
    if (values.onBehalfOf === '__other__') values.onBehalfOf = $('otherSender').value.trim();
    if (values.courier === 'Other') values.courier = $('otherCourier').value.trim();
  }
  if (!values.onBehalfOf || !values.recipientName || !values.address) return toast('Enter a sender, recipient name and delivery address before printing.');
  const form = document.createElement('form');
  form.method = 'POST'; form.action = '/api/courier/print-label'; form.target = '_blank'; form.hidden = true;
  form.rel = 'noopener';
  for (const key of ['recipientName', 'address', 'city', 'phone', 'courier', 'tracking', 'onBehalfOf']) {
    const input = document.createElement('input'); input.type = 'hidden'; input.name = key; input.value = values[key] || ''; form.append(input);
  }
  document.body.append(form); form.submit(); form.remove();
}

function courierTicketTitle(ticket) { return 'MSP-TKT-' + String(ticket.ticket_number).padStart(5, '0'); }

async function refreshCourierTickets() {
  try {
    courierTickets = (await api('/api/courier/tickets')).tickets;
    const list = $('courierTicketList'); list.replaceChildren();
    const filter = $('courierTicketFilter').value;
    const visible = courierTickets.filter(t => filter === 'all' || (filter === 'active' ? t.status !== 'Resolved' : t.status === filter));
    $('courierTicketCount').textContent = visible.length + ' ticket(s)';
    visible.forEach(ticket => {
      const shipment = shipments.find(s => s.id === ticket.shipment_id);
      const row = document.createElement('div'); row.className = 'ticket-row';
      const info = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = courierTicketTitle(ticket) + ' · ' + (shipment?.recipientName || 'Shipment');
      const sub = document.createElement('p'); sub.textContent = [ticket.status, ticket.owner || 'Not assigned', ticket.next_followup ? 'Follow up ' + labelDate(ticket.next_followup) : 'No follow-up date'].join(' · ');
      info.append(title, sub); row.append(info, action('Open ticket', () => showCourierTicket(ticket))); list.append(row);
    });
    if (!visible.length) { const p = document.createElement('p'); p.textContent = 'No tickets match this view.'; list.append(p); }
    $('courierTicketLoadError').hidden = true;
  } catch (error) {
    $('courierTicketLoadError').textContent = error.message + ' Use Retry to reload tickets.';
    $('courierTicketLoadError').hidden = false;
  }
}

function showCourierTicket(ticket) {
  activeCourierTicket = ticket;
  $('courierTicketTitle').textContent = courierTicketTitle(ticket);
  const shipment = shipments.find(s => s.id === ticket.shipment_id);
  $('courierTicketShipment').textContent = shipment ? [shipment.recipientName, shipment.courier, shipment.tracking || 'Tracking not recorded', 'Sent ' + labelDate(shipment.sent)].join(' · ') : 'Saved shipment';
  $('ticketStatus').value = ticket.status; $('ticketOwner').value = ticket.owner;
  $('ticketProblem').value = ticket.problem; $('ticketNext').value = ticket.next_followup || ''; $('ticketNote').value = '';
  $('ticketMessage').textContent = ''; $('ticketPrint').href = '/api/courier/tickets/' + encodeURIComponent(ticket.id) + '/print';
  $('ticketHistory').replaceChildren();
  const opened = document.createElement('p'); opened.textContent = 'Opened ' + new Date(ticket.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }); $('ticketHistory').append(opened);
  ticket.history.forEach(event => {
    const p = document.createElement('p'); p.style.whiteSpace = 'pre-wrap';
    p.textContent = [new Date(event.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), event.status, event.owner, event.nextFollowup ? 'Next: ' + labelDate(event.nextFollowup) : '', event.note, 'Problem: ' + event.problem].filter(Boolean).join(' · ');
    $('ticketHistory').append(p);
  });
  if (!$('courierTicketDialog').open) $('courierTicketDialog').showModal();
}

async function courierTicket(shipment) {
  if (openingCourierTicket || saving || loading) return;
  const id = shipment?.id || editingId;
  if (!id) return toast('Save the shipment first, then choose Open a ticket from its history row.');
  openingCourierTicket = true;
  try {
    const result = await api('/api/courier/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shipmentId: id }) });
    showCourierTicket(result.ticket); await refreshCourierTickets();
  } catch (error) { toast(error.message); }
  finally { openingCourierTicket = false; }
}

$('printPackageLabel').onclick = () => courierLabel();
$('openCourierTicket').onclick = () => courierTicket();
$('ticketClose').onclick = () => $('courierTicketDialog').close();
$('courierTicketFilter').onchange = refreshCourierTickets;
$('ticketRetry').onclick = refreshCourierTickets;
$('ticketPrint').onclick = event => {
  if (!activeCourierTicket || $('ticketStatus').value !== activeCourierTicket.status || $('ticketOwner').value.trim() !== activeCourierTicket.owner || $('ticketProblem').value.trim() !== activeCourierTicket.problem || ($('ticketNext').value || null) !== activeCourierTicket.next_followup || $('ticketNote').value.trim()) {
    event.preventDefault(); $('ticketMessage').textContent = 'Save your ticket changes before printing.';
  }
};
$('ticketForm').onsubmit = async event => {
  event.preventDefault(); if (!activeCourierTicket || $('ticketSave').disabled) return;
  $('ticketSave').disabled = true; $('ticketClose').disabled = true; $('ticketMessage').textContent = 'Saving…';
  try {
    const result = await api('/api/courier/tickets/' + encodeURIComponent(activeCourierTicket.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: activeCourierTicket.revision, status: $('ticketStatus').value, owner: $('ticketOwner').value.trim(), problem: $('ticketProblem').value.trim(), nextFollowup: $('ticketNext').value, note: $('ticketNote').value.trim() }) });
    showCourierTicket(result.ticket); $('ticketMessage').textContent = 'Ticket saved.'; await refreshCourierTickets();
  } catch (error) { $('ticketMessage').textContent = error.message; }
  finally { $('ticketSave').disabled = false; $('ticketClose').disabled = false; }
};

refreshCourierTickets().then(() => {
  const id = new URLSearchParams(window.parent.location.search).get('ticket');
  if (id) { const ticket = courierTickets.find(t => t.id === id); if (ticket) showCourierTicket(ticket); }
});
