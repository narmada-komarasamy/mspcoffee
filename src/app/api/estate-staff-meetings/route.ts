import { NextResponse } from 'next/server';
import { nullableDateOrTime, nullableString, requireEstateStaffMeetingUser, stringValue } from './_auth';

type ParticipantPayload = {
  name?: unknown;
  role?: unknown;
  attendance_status?: unknown;
  conflict_declared?: unknown;
};

type AgendaPayload = {
  topic?: unknown;
  presenter?: unknown;
  time_minutes?: unknown;
  status?: unknown;
  notes?: unknown;
};

const quorumValues = ['pending', 'met', 'not-met', 'not-required'];
const confidentialityValues = ['open', 'internal', 'restricted', 'confidential'];
const approvalValues = ['draft', 'in-review', 'approved', 'signed'];
const attendanceValues = ['present', 'apology', 'invitee', 'absent'];
const agendaStatusValues = ['pending', 'discussed', 'deferred', 'approved'];

export async function POST(request: Request) {
  const auth = await requireEstateStaffMeetingUser(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => null) as {
    meetingId?: unknown;
    form?: Record<string, unknown>;
    participants?: unknown;
    agenda?: unknown;
    userName?: unknown;
  } | null;

  const form = body?.form;
  if (!form || typeof form !== 'object') {
    return NextResponse.json({ error: 'Meeting form is required' }, { status: 400 });
  }

  const title = stringValue(form.title);
  const meetingDate = stringValue(form.meeting_date);
  if (!title || !meetingDate) {
    return NextResponse.json({ error: 'Meeting title and date are required' }, { status: 400 });
  }

  const quorum = stringValue(form.quorum_status) || 'pending';
  const confidentiality = stringValue(form.confidentiality) || 'restricted';
  const approval = stringValue(form.approval_status) || 'draft';
  if (!quorumValues.includes(quorum) || !confidentialityValues.includes(confidentiality) || !approvalValues.includes(approval)) {
    return NextResponse.json({ error: 'Invalid meeting status value' }, { status: 400 });
  }

  const userName = stringValue(body?.userName);
  const meetingId = stringValue(body?.meetingId);
  const payload = {
    meeting_date: meetingDate,
    meeting_type: stringValue(form.meeting_type) || 'Estate Staff Meeting',
    title,
    start_time: nullableDateOrTime(form.start_time),
    end_time: nullableDateOrTime(form.end_time),
    location: nullableString(form.location),
    quorum_status: quorum,
    confidentiality,
    agenda_summary: nullableString(form.agenda_summary),
    minutes_draft: nullableString(form.minutes_draft),
    decisions: nullableString(form.decisions),
    approval_status: approval,
    minute_owner: nullableString(form.minute_owner),
    reviewer: nullableString(form.reviewer),
    approver: nullableString(form.approver),
    approval_date: nullableDateOrTime(form.approval_date),
    next_meeting_date: nullableDateOrTime(form.next_meeting_date),
    next_meeting_time: nullableDateOrTime(form.next_meeting_time),
    next_meeting_location: nullableString(form.next_meeting_location),
    next_meeting_agenda: nullableString(form.next_meeting_agenda),
    minutes_updated_by: nullableString(form.minutes_updated_by),
    minutes_updated_at: nullableDateOrTime(form.minutes_updated_at),
    created_by: nullableString(form.created_by) ?? (userName || null),
  };

  let meetingResult = meetingId
    ? await auth.supabase.from('estate_staff_meetings').update(payload).eq('id', meetingId).select().single()
    : await auth.supabase.from('estate_staff_meetings').insert([payload]).select().single();

  if (meetingResult.error?.message.includes('minutes_updated')) {
    const { minutes_updated_by, minutes_updated_at, ...legacyPayload } = payload;
    void minutes_updated_by;
    void minutes_updated_at;
    meetingResult = meetingId
      ? await auth.supabase.from('estate_staff_meetings').update(legacyPayload).eq('id', meetingId).select().single()
      : await auth.supabase.from('estate_staff_meetings').insert([legacyPayload]).select().single();
  }

  if (meetingResult.error || !meetingResult.data) {
    return NextResponse.json({ error: meetingResult.error?.message ?? 'Failed to save meeting' }, { status: 500 });
  }

  const savedMeetingId = meetingResult.data.id as string;
  const cleanParticipants = (Array.isArray(body?.participants) ? body.participants : [])
    .map((participant: ParticipantPayload) => {
      const attendance = stringValue(participant.attendance_status) || 'present';
      return {
        meeting_id: savedMeetingId,
        name: stringValue(participant.name),
        role: nullableString(participant.role),
        attendance_status: attendanceValues.includes(attendance) ? attendance : 'present',
        conflict_declared: Boolean(participant.conflict_declared),
      };
    })
    .filter((participant) => participant.name);

  const cleanAgenda = (Array.isArray(body?.agenda) ? body.agenda : [])
    .map((item: AgendaPayload, index: number) => {
      const status = stringValue(item.status) || 'pending';
      const minutes = Number(item.time_minutes);
      return {
        meeting_id: savedMeetingId,
        item_no: index + 1,
        topic: stringValue(item.topic),
        presenter: nullableString(item.presenter),
        time_minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
        status: agendaStatusValues.includes(status) ? status : 'pending',
        notes: nullableString(item.notes),
      };
    })
    .filter((item) => item.topic);

  const { error: participantDeleteError } = await auth.supabase
    .from('estate_staff_meeting_participants')
    .delete()
    .eq('meeting_id', savedMeetingId);
  if (participantDeleteError) {
    return NextResponse.json({ error: `Meeting saved, but participant refresh failed: ${participantDeleteError.message}` }, { status: 500 });
  }

  const { error: agendaDeleteError } = await auth.supabase
    .from('estate_staff_meeting_agenda_items')
    .delete()
    .eq('meeting_id', savedMeetingId);
  if (agendaDeleteError) {
    return NextResponse.json({ error: `Meeting saved, but agenda refresh failed: ${agendaDeleteError.message}` }, { status: 500 });
  }

  if (cleanParticipants.length) {
    const { error } = await auth.supabase.from('estate_staff_meeting_participants').insert(cleanParticipants);
    if (error) return NextResponse.json({ error: `Meeting saved, but participants failed: ${error.message}` }, { status: 500 });
  }

  if (cleanAgenda.length) {
    const { error } = await auth.supabase.from('estate_staff_meeting_agenda_items').insert(cleanAgenda);
    if (error) return NextResponse.json({ error: `Meeting saved, but agenda failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ meetingId: savedMeetingId });
}
