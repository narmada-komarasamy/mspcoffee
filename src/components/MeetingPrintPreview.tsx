"use client";

import { useMemo, useState } from "react";
import { Mail, Printer, X } from "lucide-react";
import css from "./MeetingPrintPreview.module.css";

type PrintParticipant = {
  name: string;
  role: string | null;
  attendance_status: string;
  conflict_declared?: boolean;
};

type PrintAgendaItem = {
  item_no: number;
  topic: string;
  presenter: string | null;
  time_minutes: number | null;
  status: string;
  notes: string | null;
};

type PrintAction = {
  action_text: string;
  assigned_to: string;
  due_date: string | null;
  status: string;
  priority: string;
  progress?: number;
};

type PrintFile = {
  file_type: string;
  file_name: string;
  public_url: string | null;
};

type PrintMeeting = {
  meeting_date: string;
  meeting_type: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  quorum_status: string;
  confidentiality: string;
  agenda_summary: string | null;
  minutes_draft: string | null;
  decisions: string | null;
  approval_status: string;
  minute_owner: string | null;
  reviewer: string | null;
  approver: string | null;
  approval_date: string | null;
  next_meeting_date: string | null;
  next_meeting_time: string | null;
  next_meeting_location: string | null;
  next_meeting_agenda: string | null;
};

type MeetingPrintPreviewProps = {
  registerName: string;
  eyebrow: string;
  triggerClassName: string;
  meeting: PrintMeeting;
  participants: PrintParticipant[];
  agenda: PrintAgendaItem[];
  actions: PrintAction[];
  files: PrintFile[];
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function fmtTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "-";
}

function clean(value: string | null | undefined) {
  return value?.trim() || "-";
}

function emailBody(
  registerName: string,
  meeting: PrintMeeting,
  participants: PrintParticipant[],
  agenda: PrintAgendaItem[],
  actions: PrintAction[],
  files: PrintFile[],
) {
  const lines = [
    `${registerName}: ${meeting.title}`,
    `Date: ${fmtDate(meeting.meeting_date)}`,
    `Time: ${fmtTime(meeting.start_time)} to ${fmtTime(meeting.end_time)}`,
    `Location: ${clean(meeting.location)}`,
    `Status: ${meeting.approval_status}`,
    "",
    "Agenda Summary",
    clean(meeting.agenda_summary),
    "",
    "Minutes Draft",
    clean(meeting.minutes_draft),
    "",
    "Decisions / Resolutions",
    clean(meeting.decisions),
    "",
    "Participants",
    ...(participants.length ? participants.map((p) => `- ${p.name || "-"} (${p.role || "Role not set"}) - ${p.attendance_status}`) : ["- No participants recorded"]),
    "",
    "Agenda Items",
    ...(agenda.length ? agenda.map((a, i) => `${i + 1}. ${a.topic || "-"} - ${a.presenter || "Presenter not set"}`) : ["- No agenda items recorded"]),
    "",
    "Follow-up Actions",
    ...(actions.length ? actions.map((a) => `- ${a.action_text} | Owner: ${a.assigned_to} | Due: ${fmtDate(a.due_date)} | Status: ${a.status}`) : ["- No follow-up actions recorded"]),
    "",
    "Files",
    ...(files.length ? files.map((f) => `- ${f.file_type}: ${f.file_name}${f.public_url ? ` (${f.public_url})` : ""}`) : ["- No files uploaded"]),
    "",
    "Next Meeting",
    `Date: ${fmtDate(meeting.next_meeting_date)}`,
    `Time: ${fmtTime(meeting.next_meeting_time)}`,
    `Location: ${clean(meeting.next_meeting_location)}`,
    `Agenda: ${clean(meeting.next_meeting_agenda)}`,
  ];
  return lines.join("\n");
}

export function MeetingPrintPreview({
  registerName,
  eyebrow,
  triggerClassName,
  meeting,
  participants,
  agenda,
  actions,
  files,
}: MeetingPrintPreviewProps) {
  const [open, setOpen] = useState(false);
  const subject = `${registerName} - ${meeting.title || "Meeting"} - ${fmtDate(meeting.meeting_date)}`;
  const mailto = useMemo(() => {
    const body = emailBody(registerName, meeting, participants, agenda, actions, files);
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [actions, agenda, files, meeting, participants, registerName, subject]);

  return (
    <>
      <button className={triggerClassName} onClick={() => setOpen(true)}>
        <Printer size={15} /> Print Preview
      </button>

      {open && (
        <div className={css.backdrop} role="dialog" aria-modal="true" aria-label={`${registerName} print preview`}>
          <div className={css.modal}>
            <div className={css.toolbar}>
              <div>
                <div className={css.toolbarTitle}>Print Copy Preview</div>
                <div className={css.toolbarSub}>Review this copy before printing or emailing it.</div>
              </div>
              <div className={css.toolbarActions}>
                <a className={css.actionBtn} href={mailto}>
                  <Mail size={15} /> Email
                </a>
                <button className={css.actionBtn} onClick={() => window.print()}>
                  <Printer size={15} /> Print
                </button>
                <button className={css.iconBtn} onClick={() => setOpen(false)} aria-label="Close print preview">
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className={css.previewScroll}>
              <article className={css.printSheet}>
                <header className={css.printHeader}>
                  <div>
                    <div className={css.printEyebrow}>{eyebrow}</div>
                    <h1>{meeting.title || registerName}</h1>
                    <p>{registerName}</p>
                  </div>
                  <div className={css.statusBox}>
                    <span>Minutes Status</span>
                    <strong>{meeting.approval_status}</strong>
                  </div>
                </header>

                <section className={css.infoGrid}>
                  <div><span>Date</span><strong>{fmtDate(meeting.meeting_date)}</strong></div>
                  <div><span>Time</span><strong>{fmtTime(meeting.start_time)} - {fmtTime(meeting.end_time)}</strong></div>
                  <div><span>Location</span><strong>{clean(meeting.location)}</strong></div>
                  <div><span>Type</span><strong>{meeting.meeting_type}</strong></div>
                  <div><span>Quorum</span><strong>{meeting.quorum_status}</strong></div>
                  <div><span>Confidentiality</span><strong>{meeting.confidentiality}</strong></div>
                </section>

                <section className={css.block}>
                  <h2>Participants</h2>
                  <table>
                    <thead><tr><th>Name</th><th>Role</th><th>Attendance</th><th>Conflict</th></tr></thead>
                    <tbody>
                      {participants.filter((p) => p.name.trim()).map((p, idx) => (
                        <tr key={`${p.name}-${idx}`}><td>{p.name}</td><td>{p.role || "-"}</td><td>{p.attendance_status}</td><td>{p.conflict_declared ? "Declared" : "-"}</td></tr>
                      ))}
                      {!participants.filter((p) => p.name.trim()).length && <tr><td colSpan={4}>No participants recorded.</td></tr>}
                    </tbody>
                  </table>
                </section>

                <section className={css.block}>
                  <h2>Agenda</h2>
                  <table>
                    <thead><tr><th>No.</th><th>Topic</th><th>Presenter</th><th>Minutes</th><th>Status</th></tr></thead>
                    <tbody>
                      {agenda.filter((a) => a.topic.trim()).map((a, idx) => (
                        <tr key={`${a.topic}-${idx}`}><td>{idx + 1}</td><td>{a.topic}</td><td>{a.presenter || "-"}</td><td>{a.time_minutes ?? "-"}</td><td>{a.status}</td></tr>
                      ))}
                      {!agenda.filter((a) => a.topic.trim()).length && <tr><td colSpan={5}>No agenda items recorded.</td></tr>}
                    </tbody>
                  </table>
                </section>

                <section className={css.twoColumn}>
                  <div className={css.block}>
                    <h2>Agenda Summary</h2>
                    <p>{clean(meeting.agenda_summary)}</p>
                  </div>
                  <div className={css.block}>
                    <h2>Decisions / Resolutions</h2>
                    <p>{clean(meeting.decisions)}</p>
                  </div>
                </section>

                <section className={css.block}>
                  <h2>Minutes Draft To Be Passed</h2>
                  <p>{clean(meeting.minutes_draft)}</p>
                </section>

                <section className={css.block}>
                  <h2>Follow-Up Actions</h2>
                  <table>
                    <thead><tr><th>Action</th><th>Assigned To</th><th>Due Date</th><th>Priority</th><th>Status</th></tr></thead>
                    <tbody>
                      {actions.map((a, idx) => (
                        <tr key={`${a.action_text}-${idx}`}><td>{a.action_text}</td><td>{a.assigned_to}</td><td>{fmtDate(a.due_date)}</td><td>{a.priority}</td><td>{a.status}</td></tr>
                      ))}
                      {!actions.length && <tr><td colSpan={5}>No follow-up actions recorded.</td></tr>}
                    </tbody>
                  </table>
                </section>

                <section className={css.twoColumn}>
                  <div className={css.block}>
                    <h2>Files On Record</h2>
                    <ul>
                      {files.map((f, idx) => <li key={`${f.file_name}-${idx}`}><strong>{f.file_type}:</strong> {f.file_name}</li>)}
                      {!files.length && <li>No files uploaded.</li>}
                    </ul>
                  </div>
                  <div className={css.block}>
                    <h2>Next Meeting</h2>
                    <p><strong>Date:</strong> {fmtDate(meeting.next_meeting_date)}</p>
                    <p><strong>Time:</strong> {fmtTime(meeting.next_meeting_time)}</p>
                    <p><strong>Location:</strong> {clean(meeting.next_meeting_location)}</p>
                    <p><strong>Agenda:</strong> {clean(meeting.next_meeting_agenda)}</p>
                  </div>
                </section>

                <section className={css.signatures}>
                  <div><span>Prepared By</span><strong>{clean(meeting.minute_owner)}</strong></div>
                  <div><span>Reviewed By</span><strong>{clean(meeting.reviewer)}</strong></div>
                  <div><span>Approved / Signed By</span><strong>{clean(meeting.approver)}</strong></div>
                  <div><span>Approval Date</span><strong>{fmtDate(meeting.approval_date)}</strong></div>
                </section>
              </article>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
