import { DATE_RE, nullableString, nullableTime, stringValue } from './_auth';

export const eventTypes = ['schedule', 'report', 'email', 'timeline'];
export const eventStatuses = ['scheduled', 'queued', 'sent', 'risk', 'draft', 'cancelled', 'completed'];

export function buildCalendarEventPayload(body: Record<string, unknown>, userId: string, isUpdate = false) {
  const title = stringValue(body.title);
  const eventDate = stringValue(body.event_date);
  const eventType = stringValue(body.event_type) || 'schedule';
  const status = stringValue(body.status) || (eventType === 'email' ? 'queued' : 'scheduled');

  if (!isUpdate && (!title || !eventDate)) {
    return { error: 'Title and date are required' };
  }
  if (eventDate && !DATE_RE.test(eventDate)) return { error: 'Date must be YYYY-MM-DD' };
  if (!eventTypes.includes(eventType)) return { error: 'Invalid event type' };
  if (!eventStatuses.includes(status)) return { error: 'Invalid event status' };

  const payload: Record<string, unknown> = {
    event_type: eventType,
    status,
    start_time: nullableTime(body.start_time),
    end_time: nullableTime(body.end_time),
    estate: stringValue(body.estate) || 'All Estates',
    owner: nullableString(body.owner),
    report_href: nullableString(body.report_href),
    email_href: nullableString(body.email_href),
    reminder: nullableString(body.reminder),
    notes: nullableString(body.notes),
    conflict_note: nullableString(body.conflict_note),
    recurrence_rule: nullableString(body.recurrence_rule),
    updated_by: userId,
  };

  if (title) payload.title = title;
  if (eventDate) payload.event_date = eventDate;
  if (!isUpdate) payload.created_by = userId;

  return { payload };
}
