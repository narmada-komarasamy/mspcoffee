"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  FileAudio,
  FileCheck2,
  FileText,
  Loader2,
  Plus,
  Save,
  Upload,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MeetingPrintPreview } from "@/components/MeetingPrintPreview";
import css from "./estate-staff-meetings.module.css";

type Participant = {
  id?: string;
  meeting_id?: string;
  name: string;
  role: string | null;
  attendance_status: "present" | "apology" | "invitee" | "absent";
  conflict_declared: boolean;
};

type AgendaItem = {
  id?: string;
  meeting_id?: string;
  item_no: number;
  topic: string;
  presenter: string | null;
  time_minutes: number | null;
  status: "pending" | "discussed" | "deferred" | "approved";
  notes: string | null;
};

type MeetingAction = {
  id: string;
  meeting_id: string;
  action_text: string;
  assigned_to: string;
  due_date: string | null;
  status: "open" | "in-progress" | "blocked" | "completed";
  priority: "low" | "medium" | "high" | "critical";
  progress: number;
  closure_notes: string | null;
  created_at: string;
  updated_at: string;
};

type MeetingFile = {
  id: string;
  meeting_id: string;
  file_type: "meeting-pack" | "audio" | "minutes-draft" | "signed-minutes" | "attachment";
  file_name: string;
  file_path: string;
  public_url: string | null;
  content_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
};

type Meeting = {
  id: string;
  meeting_date: string;
  meeting_type: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  quorum_status: "pending" | "met" | "not-met" | "not-required";
  confidentiality: "open" | "internal" | "restricted" | "confidential";
  agenda_summary: string | null;
  minutes_draft: string | null;
  decisions: string | null;
  approval_status: "draft" | "in-review" | "approved" | "signed";
  minute_owner: string | null;
  reviewer: string | null;
  approver: string | null;
  approval_date: string | null;
  next_meeting_date: string | null;
  next_meeting_time: string | null;
  next_meeting_location: string | null;
  next_meeting_agenda: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  estate_staff_meeting_participants?: Participant[];
  estate_staff_meeting_agenda_items?: AgendaItem[];
  estate_staff_meeting_actions?: MeetingAction[];
  estate_staff_meeting_files?: MeetingFile[];
};

type MeetingForm = Omit<Meeting, "id" | "created_at" | "updated_at" | "estate_staff_meeting_participants" | "estate_staff_meeting_agenda_items" | "estate_staff_meeting_actions" | "estate_staff_meeting_files">;

type AppUser = { id: string; name: string; role: string; estate: string | null };

const todayISO = () => new Date().toISOString().slice(0, 10);

const blankForm = (userName = ""): MeetingForm => ({
  meeting_date: todayISO(),
  meeting_type: "Estate Staff Meeting",
  title: "Estate Staff Meeting",
  start_time: "11:00",
  end_time: null,
  location: "Estate Office",
  quorum_status: "pending",
  confidentiality: "internal",
  agenda_summary: "",
  minutes_draft: "",
  decisions: "",
  approval_status: "draft",
  minute_owner: userName || "Estate Office",
  reviewer: "Manager",
  approver: "Estate Manager",
  approval_date: null,
  next_meeting_date: null,
  next_meeting_time: null,
  next_meeting_location: "",
  next_meeting_agenda: "",
  created_by: userName || null,
});

const blankParticipants = (): Participant[] => [
  { name: "", role: "", attendance_status: "present", conflict_declared: false },
];

const blankAgenda = (): AgendaItem[] => [
  { item_no: 1, topic: "", presenter: "", time_minutes: 15, status: "pending", notes: "" },
];

function fmtDate(s: string | null | undefined) {
  if (!s) return "-";
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}/${m}/${y}` : s;
}

function displayTime(s: string | null | undefined) {
  return s ? s.slice(0, 5) : "-";
}

function statusClass(status: Meeting["approval_status"] | MeetingAction["status"]) {
  if (status === "approved" || status === "signed" || status === "completed") return css.badgeApproved;
  if (status === "in-review" || status === "in-progress") return css.badgeReview;
  if (status === "blocked") return css.badgeRisk;
  return css.badgeDraft;
}

function actionIsOverdue(action: MeetingAction) {
  return action.status !== "completed" && !!action.due_date && action.due_date < todayISO();
}

function fileFor(files: MeetingFile[] | undefined, fileType: MeetingFile["file_type"]) {
  return [...(files ?? [])]
    .filter((f) => f.file_type === fileType)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export default function EstateStaffMeetingsPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<MeetingForm>(() => blankForm());
  const [participants, setParticipants] = useState<Participant[]>(() => blankParticipants());
  const [agenda, setAgenda] = useState<AgendaItem[]>(() => blankAgenda());
  const [newAction, setNewAction] = useState({ action_text: "", assigned_to: "", due_date: "", priority: "medium" as MeetingAction["priority"] });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const selected = useMemo(
    () => meetings.find((m) => m.id === selectedId) ?? null,
    [meetings, selectedId]
  );

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("estate_staff_meetings")
      .select(`
        *,
        estate_staff_meeting_participants (*),
        estate_staff_meeting_agenda_items (*),
        estate_staff_meeting_actions (*),
        estate_staff_meeting_files (*)
      `)
      .order("meeting_date", { ascending: false });

    if (error) {
      setMessage({ type: "error", text: `Failed to load estate staff meetings: ${error.message}` });
      setLoading(false);
      return;
    }

    const rows = (data ?? []).map((m) => ({
      ...m,
      estate_staff_meeting_agenda_items: [...(m.estate_staff_meeting_agenda_items ?? [])].sort((a, b) => a.item_no - b.item_no),
      estate_staff_meeting_actions: [...(m.estate_staff_meeting_actions ?? [])].sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")),
      estate_staff_meeting_files: [...(m.estate_staff_meeting_files ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    })) as Meeting[];

    setMeetings(rows);
    setSelectedId((current) => current ?? rows[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("msp_user");
    if (stored) {
      const parsed = JSON.parse(stored) as AppUser;
      // Hydrate the PIN-login user from the app's existing localStorage session.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(parsed);
      setForm(blankForm(parsed.name));
    }
    loadMeetings();
  }, [loadMeetings]);

  useEffect(() => {
    if (!selected) return;
    // Keep the editor fields in sync with the selected register row.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      meeting_date: selected.meeting_date,
      meeting_type: selected.meeting_type,
      title: selected.title,
      start_time: selected.start_time?.slice(0, 5) ?? "",
      end_time: selected.end_time?.slice(0, 5) ?? "",
      location: selected.location ?? "",
      quorum_status: selected.quorum_status,
      confidentiality: selected.confidentiality,
      agenda_summary: selected.agenda_summary ?? "",
      minutes_draft: selected.minutes_draft ?? "",
      decisions: selected.decisions ?? "",
      approval_status: selected.approval_status,
      minute_owner: selected.minute_owner ?? "",
      reviewer: selected.reviewer ?? "",
      approver: selected.approver ?? "",
      approval_date: selected.approval_date ?? "",
      next_meeting_date: selected.next_meeting_date ?? "",
      next_meeting_time: selected.next_meeting_time?.slice(0, 5) ?? "",
      next_meeting_location: selected.next_meeting_location ?? "",
      next_meeting_agenda: selected.next_meeting_agenda ?? "",
      created_by: selected.created_by,
    });
    setParticipants(selected.estate_staff_meeting_participants?.length ? selected.estate_staff_meeting_participants : blankParticipants());
    setAgenda(selected.estate_staff_meeting_agenda_items?.length ? selected.estate_staff_meeting_agenda_items : blankAgenda());
  }, [selected]);

  const stats = useMemo(() => {
    const actions = meetings.flatMap((m) => m.estate_staff_meeting_actions ?? []);
    const openActions = actions.filter((a) => a.status !== "completed");
    const overdue = openActions.filter(actionIsOverdue);
    const pendingMinutes = meetings.filter((m) => m.approval_status === "draft" || m.approval_status === "in-review");
    const nextMeeting = [...meetings]
      .filter((m) => m.next_meeting_date)
      .sort((a, b) => (a.next_meeting_date ?? "").localeCompare(b.next_meeting_date ?? ""))[0];
    return {
      meetings: meetings.length,
      pendingMinutes: pendingMinutes.length,
      openActions: openActions.length,
      overdue: overdue.length,
      nextMeeting,
    };
  }, [meetings]);

  const filteredMeetings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meetings.filter((m) => {
      const matchesSearch = !q || [
        m.title,
        m.meeting_type,
        m.location ?? "",
        m.agenda_summary ?? "",
        ...(m.estate_staff_meeting_participants ?? []).map((p) => p.name),
      ].join(" ").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || m.approval_status === statusFilter;
      const matchesType = typeFilter === "all" || m.meeting_type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [meetings, search, statusFilter, typeFilter]);

  const meetingTypes = useMemo(
    () => Array.from(new Set(meetings.map((m) => m.meeting_type))).sort(),
    [meetings]
  );

  const updateForm = <K extends keyof MeetingForm>(key: K, value: MeetingForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const startNewMeeting = () => {
    setSelectedId(null);
    setForm(blankForm(user?.name ?? ""));
    setParticipants(blankParticipants());
    setAgenda(blankAgenda());
    setMessage(null);
  };

  const saveMeeting = async () => {
    if (!form.title.trim() || !form.meeting_date) {
      setMessage({ type: "error", text: "Meeting title and date are required." });
      return;
    }

    const cleanParticipants = participants.filter((p) => p.name.trim()).map((p) => ({
      name: p.name.trim(),
      role: p.role?.trim() || null,
      attendance_status: p.attendance_status,
      conflict_declared: p.conflict_declared,
    }));
    const cleanAgenda = agenda.filter((a) => a.topic.trim()).map((a, idx) => ({
      item_no: idx + 1,
      topic: a.topic.trim(),
      presenter: a.presenter?.trim() || null,
      time_minutes: Number(a.time_minutes) || null,
      status: a.status,
      notes: a.notes?.trim() || null,
    }));

    setSaving(true);
    setMessage(null);

    const payload = {
      ...form,
      title: form.title.trim(),
      meeting_type: form.meeting_type.trim() || "Estate Staff Meeting",
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location: form.location?.trim() || null,
      agenda_summary: form.agenda_summary?.trim() || null,
      minutes_draft: form.minutes_draft?.trim() || null,
      decisions: form.decisions?.trim() || null,
      minute_owner: form.minute_owner?.trim() || null,
      reviewer: form.reviewer?.trim() || null,
      approver: form.approver?.trim() || null,
      approval_date: form.approval_date || null,
      next_meeting_date: form.next_meeting_date || null,
      next_meeting_time: form.next_meeting_time || null,
      next_meeting_location: form.next_meeting_location?.trim() || null,
      next_meeting_agenda: form.next_meeting_agenda?.trim() || null,
      created_by: form.created_by || user?.name || null,
    };

    const meetingResult = selectedId
      ? await supabase.from("estate_staff_meetings").update(payload).eq("id", selectedId).select().single()
      : await supabase.from("estate_staff_meetings").insert([payload]).select().single();

    if (meetingResult.error || !meetingResult.data) {
      setSaving(false);
      setMessage({ type: "error", text: `Failed to save meeting: ${meetingResult.error?.message ?? "Unknown error"}` });
      return;
    }

    const meetingId = meetingResult.data.id as string;
    await supabase.from("estate_staff_meeting_participants").delete().eq("meeting_id", meetingId);
    await supabase.from("estate_staff_meeting_agenda_items").delete().eq("meeting_id", meetingId);

    if (cleanParticipants.length) {
      const { error } = await supabase.from("estate_staff_meeting_participants").insert(
        cleanParticipants.map((p) => ({ ...p, meeting_id: meetingId }))
      );
      if (error) setMessage({ type: "error", text: `Meeting saved, but participants failed: ${error.message}` });
    }

    if (cleanAgenda.length) {
      const { error } = await supabase.from("estate_staff_meeting_agenda_items").insert(
        cleanAgenda.map((a) => ({ ...a, meeting_id: meetingId }))
      );
      if (error) setMessage({ type: "error", text: `Meeting saved, but agenda failed: ${error.message}` });
    }

    setSelectedId(meetingId);
    await loadMeetings();
    setSaving(false);
    setMessage({ type: "ok", text: "Estate staff meeting saved." });
  };

  const addAction = async () => {
    if (!selectedId) {
      setMessage({ type: "error", text: "Save the meeting before adding follow-up actions." });
      return;
    }
    if (!newAction.action_text.trim() || !newAction.assigned_to.trim()) {
      setMessage({ type: "error", text: "Action and assigned owner are required." });
      return;
    }
    const { error } = await supabase.from("estate_staff_meeting_actions").insert([{
      meeting_id: selectedId,
      action_text: newAction.action_text.trim(),
      assigned_to: newAction.assigned_to.trim(),
      due_date: newAction.due_date || null,
      priority: newAction.priority,
      status: "open",
      progress: 0,
    }]);
    if (error) {
      setMessage({ type: "error", text: `Failed to add action: ${error.message}` });
      return;
    }
    setNewAction({ action_text: "", assigned_to: "", due_date: "", priority: "medium" });
    await loadMeetings();
    setMessage({ type: "ok", text: "Follow-up action added." });
  };

  const updateActionStatus = async (action: MeetingAction, status: MeetingAction["status"]) => {
    const progress = status === "completed" ? 100 : status === "in-progress" ? Math.max(action.progress, 40) : action.progress;
    const { error } = await supabase
      .from("estate_staff_meeting_actions")
      .update({ status, progress })
      .eq("id", action.id);
    if (error) {
      setMessage({ type: "error", text: `Failed to update action: ${error.message}` });
      return;
    }
    await loadMeetings();
  };

  const uploadFile = async (fileType: MeetingFile["file_type"], file: File | null) => {
    if (!file || !selectedId) return;
    setUploading(fileType);
    const ext = file.name.split(".").pop() ?? "bin";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${selectedId}/${fileType}/${new Date().getTime()}-${safeName || `file.${ext}`}`;
    const { error: uploadError } = await supabase.storage
      .from("estate-staff-meetings")
      .upload(path, file, { contentType: file.type || undefined, upsert: false });

    if (uploadError) {
      setUploading(null);
      setMessage({ type: "error", text: `Upload failed: ${uploadError.message}` });
      return;
    }

    const { data: urlData } = supabase.storage.from("estate-staff-meetings").getPublicUrl(path);
    const { error: fileError } = await supabase.from("estate_staff_meeting_files").insert([{
      meeting_id: selectedId,
      file_type: fileType,
      file_name: file.name,
      file_path: path,
      public_url: urlData.publicUrl,
      content_type: file.type || null,
      file_size: file.size,
      uploaded_by: user?.name ?? null,
    }]);

    setUploading(null);
    if (fileError) {
      setMessage({ type: "error", text: `File uploaded, but record save failed: ${fileError.message}` });
      return;
    }
    await loadMeetings();
    setMessage({ type: "ok", text: "File uploaded." });
  };

  const selectedActions = selected?.estate_staff_meeting_actions ?? [];
  const selectedFiles = selected?.estate_staff_meeting_files ?? [];
  const canEdit = user?.role === "admin" || user?.role === "supervisor" || user?.role === "ceo";

  if (user && !canEdit) {
    return (
      <div className={css.panel}>
        <div className={css.empty}>Estate Staff Meetings is available to admin, supervisor and CEO users.</div>
      </div>
    );
  }

  return (
    <div className={css.page}>
      <section className={css.hero}>
        <div>
          <div className={css.eyebrow}>Governance Register</div>
          <h1 className={css.heroTitle}>Estate Staff Meetings</h1>
          <p className={css.heroCopy}>
            Record meeting dates, agenda, participants, minutes, signed copies, audio files, decisions,
            follow-up owners, due dates and next meeting bookings in one place.
          </p>
        </div>
        <div className={css.heroActions}>
          <button className={css.btn} onClick={loadMeetings} disabled={loading}>
            {loading ? <Loader2 size={15} /> : <CheckCircle2 size={15} />} Refresh
          </button>
          <button className={`${css.btn} ${css.btnGold}`} onClick={startNewMeeting}>
            <CalendarPlus size={15} /> New Meeting
          </button>
          <button className={`${css.btn} ${css.btnPrimary}`} onClick={saveMeeting} disabled={saving}>
            {saving ? <Loader2 size={15} /> : <Save size={15} />} Save
          </button>
          <MeetingPrintPreview
            registerName="Estate Staff Meetings"
            eyebrow="Governance Register"
            triggerClassName={css.btn}
            meeting={form}
            participants={participants}
            agenda={agenda}
            actions={selectedActions}
            files={selectedFiles}
          />
        </div>
      </section>

      {message && (
        <div className={`${css.message} ${message.type === "error" ? css.error : ""}`}>
          {message.text}
        </div>
      )}

      <section className={css.stats}>
        <div className={css.stat}>
          <div className={css.statLabel}>Meetings Recorded</div>
          <div className={css.statValue}>{stats.meetings}</div>
          <div className={css.statSub}>Estate staff and management records</div>
        </div>
        <div className={css.stat}>
          <div className={css.statLabel}>Minutes Pending</div>
          <div className={css.statValue}>{stats.pendingMinutes}</div>
          <div className={css.statSub}>Draft or in review</div>
        </div>
        <div className={css.stat}>
          <div className={css.statLabel}>Open Actions</div>
          <div className={css.statValue}>{stats.openActions}</div>
          <div className={css.statSub}>Across all meetings</div>
        </div>
        <div className={css.stat}>
          <div className={css.statLabel}>Overdue Actions</div>
          <div className={css.statValue}>{stats.overdue}</div>
          <div className={css.statSub}>Needs escalation</div>
        </div>
        <div className={css.stat}>
          <div className={css.statLabel}>Next Meeting</div>
          <div className={css.statValue}>{stats.nextMeeting?.next_meeting_date ? fmtDate(stats.nextMeeting.next_meeting_date).slice(0, 5) : "-"}</div>
          <div className={css.statSub}>{stats.nextMeeting?.next_meeting_location ?? "Not booked"}</div>
        </div>
      </section>

      <section className={css.mainGrid}>
        <div className={css.panel}>
          <div className={css.panelHead}>
            <div>
              <div className={css.panelTitle}>Meeting Register</div>
              <div className={css.panelSub}>Click any row to open the meeting workspace</div>
            </div>
            {loading && <Loader2 size={18} />}
          </div>
          <div className={css.filters}>
            <div className={css.field}>
              <label className={css.label}>Search</label>
              <input className={css.input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search agenda, participants, location" />
            </div>
            <div className={css.field}>
              <label className={css.label}>Status</label>
              <select className={css.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="in-review">In review</option>
                <option value="approved">Approved</option>
                <option value="signed">Signed</option>
              </select>
            </div>
            <div className={css.field}>
              <label className={css.label}>Type</label>
              <select className={css.select} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All meetings</option>
                {meetingTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
          </div>
          <div className={css.tableWrap}>
            <table className={css.table}>
              <thead>
                <tr>
                  <th>Date / Type</th>
                  <th>Agenda</th>
                  <th>Participants</th>
                  <th>Minutes</th>
                  <th>Files</th>
                  <th>Follow Up</th>
                  <th>Next Meeting</th>
                </tr>
              </thead>
              <tbody>
                {filteredMeetings.map((m) => {
                  const actions = m.estate_staff_meeting_actions ?? [];
                  const overdue = actions.filter(actionIsOverdue).length;
                  const files = m.estate_staff_meeting_files ?? [];
                  return (
                    <tr key={m.id} className={m.id === selectedId ? css.selectedRow : ""} onClick={() => setSelectedId(m.id)}>
                      <td>
                        <div className={css.recordTitle}>{fmtDate(m.meeting_date)}</div>
                        <div className={css.muted}>{m.meeting_type}</div>
                        <div className={css.muted}>Quorum: {m.quorum_status}</div>
                      </td>
                      <td>
                        {m.agenda_summary || "-"}
                        <div className={css.muted}>{m.estate_staff_meeting_agenda_items?.length ?? 0} agenda items</div>
                      </td>
                      <td>
                        {(m.estate_staff_meeting_participants ?? []).slice(0, 3).map((p) => p.name).join(", ") || "-"}
                        {(m.estate_staff_meeting_participants?.length ?? 0) > 3 && <div className={css.muted}>+{(m.estate_staff_meeting_participants?.length ?? 0) - 3} more</div>}
                      </td>
                      <td>
                        <span className={`${css.badge} ${statusClass(m.approval_status)}`}>{m.approval_status}</span>
                        <div className={css.muted}>Owner: {m.minute_owner || "-"}</div>
                      </td>
                      <td>
                        <div className={css.muted}>Signed: {fileFor(files, "signed-minutes") ? "yes" : "pending"}</div>
                        <div className={css.muted}>Audio: {fileFor(files, "audio") ? "yes" : "pending"}</div>
                      </td>
                      <td>
                        <span className={`${css.badge} ${overdue ? css.badgeRisk : css.badgeNeutral}`}>
                          {overdue ? `${overdue} overdue` : `${actions.filter((a) => a.status !== "completed").length} open`}
                        </span>
                      </td>
                      <td>
                        {fmtDate(m.next_meeting_date)}
                        <div className={css.muted}>{displayTime(m.next_meeting_time)} {m.next_meeting_location || ""}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!loading && filteredMeetings.length === 0 && <div className={css.empty}>No estate staff meetings found.</div>}
          </div>
        </div>

        <div className={css.panel}>
          <div className={css.panelHead}>
            <div>
              <div className={css.panelTitle}>{selectedId ? "Meeting Workspace" : "New Meeting"}</div>
              <div className={css.panelSub}>{selectedId ? "Edit minutes, files, approvals and next meeting" : "Save once before adding files or actions"}</div>
            </div>
          </div>
          <div className={css.detailBody}>
            <div className={css.section}>
              <div className={css.sectionHead}>
                <div className={css.sectionTitle}>Meeting Details</div>
                <span className={`${css.badge} ${statusClass(form.approval_status)}`}>{form.approval_status}</span>
              </div>
              <div className={css.formGrid}>
                <div className={css.field}><label className={css.label}>Date</label><input className={css.input} type="date" value={form.meeting_date} onChange={(e) => updateForm("meeting_date", e.target.value)} /></div>
                <div className={css.field}><label className={css.label}>Type</label><input className={css.input} value={form.meeting_type} onChange={(e) => updateForm("meeting_type", e.target.value)} /></div>
                <div className={`${css.field} ${css.full}`}><label className={css.label}>Title</label><input className={css.input} value={form.title} onChange={(e) => updateForm("title", e.target.value)} /></div>
                <div className={css.field}><label className={css.label}>Start Time</label><input className={css.input} type="time" value={form.start_time ?? ""} onChange={(e) => updateForm("start_time", e.target.value)} /></div>
                <div className={css.field}><label className={css.label}>End Time</label><input className={css.input} type="time" value={form.end_time ?? ""} onChange={(e) => updateForm("end_time", e.target.value)} /></div>
                <div className={`${css.field} ${css.full}`}><label className={css.label}>Location</label><input className={css.input} value={form.location ?? ""} onChange={(e) => updateForm("location", e.target.value)} /></div>
                <div className={css.field}>
                  <label className={css.label}>Quorum</label>
                  <select className={css.select} value={form.quorum_status} onChange={(e) => updateForm("quorum_status", e.target.value as Meeting["quorum_status"])}>
                    <option value="pending">Pending</option><option value="met">Met</option><option value="not-met">Not met</option><option value="not-required">Not required</option>
                  </select>
                </div>
                <div className={css.field}>
                  <label className={css.label}>Confidentiality</label>
                  <select className={css.select} value={form.confidentiality} onChange={(e) => updateForm("confidentiality", e.target.value as Meeting["confidentiality"])}>
                    <option value="open">Open</option><option value="internal">Internal</option><option value="restricted">Restricted</option><option value="confidential">Confidential</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={css.section}>
              <div className={css.sectionHead}>
                <div className={css.sectionTitle}>Participants</div>
                <button className={css.btn} onClick={() => setParticipants((rows) => [...rows, { name: "", role: "", attendance_status: "present", conflict_declared: false }])}><Plus size={14} /> Add</button>
              </div>
              <div className={css.inlineList}>
                {participants.map((p, idx) => (
                  <div className={css.listRow} key={idx}>
                    <div className={css.field}><label className={css.label}>Name</label><input className={css.input} value={p.name} onChange={(e) => setParticipants((rows) => rows.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))} /></div>
                    <div className={css.field}><label className={css.label}>Role</label><input className={css.input} value={p.role ?? ""} onChange={(e) => setParticipants((rows) => rows.map((r, i) => i === idx ? { ...r, role: e.target.value } : r))} /></div>
                    <div className={css.field}><label className={css.label}>Attendance</label><select className={css.select} value={p.attendance_status} onChange={(e) => setParticipants((rows) => rows.map((r, i) => i === idx ? { ...r, attendance_status: e.target.value as Participant["attendance_status"] } : r))}><option value="present">Present</option><option value="apology">Apology</option><option value="invitee">Invitee</option><option value="absent">Absent</option></select></div>
                  </div>
                ))}
              </div>
            </div>

            <div className={css.section}>
              <div className={css.sectionHead}>
                <div className={css.sectionTitle}>Agenda</div>
                <button className={css.btn} onClick={() => setAgenda((rows) => [...rows, { item_no: rows.length + 1, topic: "", presenter: "", time_minutes: 15, status: "pending", notes: "" }])}><Plus size={14} /> Add</button>
              </div>
              <div className={css.inlineList}>
                {agenda.map((a, idx) => (
                  <div className={css.agendaRow} key={idx}>
                    <div className={css.field}><label className={css.label}>No.</label><input className={css.input} type="number" value={idx + 1} disabled /></div>
                    <div className={css.field}><label className={css.label}>Topic</label><input className={css.input} value={a.topic} onChange={(e) => setAgenda((rows) => rows.map((r, i) => i === idx ? { ...r, topic: e.target.value } : r))} /></div>
                    <div className={css.field}><label className={css.label}>Presenter</label><input className={css.input} value={a.presenter ?? ""} onChange={(e) => setAgenda((rows) => rows.map((r, i) => i === idx ? { ...r, presenter: e.target.value } : r))} /></div>
                    <div className={css.field}><label className={css.label}>Minutes</label><input className={css.input} type="number" value={a.time_minutes ?? ""} onChange={(e) => setAgenda((rows) => rows.map((r, i) => i === idx ? { ...r, time_minutes: Number(e.target.value) || null } : r))} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className={css.section}>
              <div className={css.sectionTitle}>Minutes and Decisions</div>
              <div className={css.formGrid} style={{ marginTop: 10 }}>
                <div className={`${css.field} ${css.full}`}><label className={css.label}>Agenda Summary</label><textarea className={css.textarea} value={form.agenda_summary ?? ""} onChange={(e) => updateForm("agenda_summary", e.target.value)} /></div>
                <div className={`${css.field} ${css.full}`}><label className={css.label}>Minutes Draft To Be Passed</label><textarea className={css.textarea} value={form.minutes_draft ?? ""} onChange={(e) => updateForm("minutes_draft", e.target.value)} /></div>
                <div className={`${css.field} ${css.full}`}><label className={css.label}>Decision / Resolution Log</label><textarea className={css.textarea} value={form.decisions ?? ""} onChange={(e) => updateForm("decisions", e.target.value)} /></div>
                <div className={css.field}><label className={css.label}>Approval Status</label><select className={css.select} value={form.approval_status} onChange={(e) => updateForm("approval_status", e.target.value as Meeting["approval_status"])}><option value="draft">Draft</option><option value="in-review">In review</option><option value="approved">Approved</option><option value="signed">Signed</option></select></div>
                <div className={css.field}><label className={css.label}>Approval Date</label><input className={css.input} type="date" value={form.approval_date ?? ""} onChange={(e) => updateForm("approval_date", e.target.value)} /></div>
                <div className={css.field}><label className={css.label}>Minute Owner</label><input className={css.input} value={form.minute_owner ?? ""} onChange={(e) => updateForm("minute_owner", e.target.value)} /></div>
                <div className={css.field}><label className={css.label}>Approver</label><input className={css.input} value={form.approver ?? ""} onChange={(e) => updateForm("approver", e.target.value)} /></div>
              </div>
            </div>

            <div className={css.section}>
              <div className={css.sectionTitle}>Next Meeting</div>
              <div className={css.formGrid} style={{ marginTop: 10 }}>
                <div className={css.field}><label className={css.label}>Date</label><input className={css.input} type="date" value={form.next_meeting_date ?? ""} onChange={(e) => updateForm("next_meeting_date", e.target.value)} /></div>
                <div className={css.field}><label className={css.label}>Time</label><input className={css.input} type="time" value={form.next_meeting_time ?? ""} onChange={(e) => updateForm("next_meeting_time", e.target.value)} /></div>
                <div className={`${css.field} ${css.full}`}><label className={css.label}>Location</label><input className={css.input} value={form.next_meeting_location ?? ""} onChange={(e) => updateForm("next_meeting_location", e.target.value)} /></div>
                <div className={`${css.field} ${css.full}`}><label className={css.label}>Next Agenda</label><textarea className={css.textarea} value={form.next_meeting_agenda ?? ""} onChange={(e) => updateForm("next_meeting_agenda", e.target.value)} /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={css.mainGrid} style={{ marginTop: 16 }}>
        <div className={css.panel}>
          <div className={css.panelHead}>
            <div>
              <div className={css.panelTitle}>Files</div>
              <div className={css.panelSub}>Meeting pack, audio, draft minutes, signed minutes and attachments</div>
            </div>
          </div>
          <div className={css.detailBody}>
            <div className={css.fileGrid}>
              {([
                ["meeting-pack", "Meeting Pack", FileText],
                ["audio", "Audio File", FileAudio],
                ["minutes-draft", "Draft Minutes File", FileText],
                ["signed-minutes", "Signed Minutes", FileCheck2],
              ] as const).map(([type, label, Icon]) => {
                const existing = fileFor(selectedFiles, type);
                return (
                  <div className={css.fileBox} key={type}>
                    <div className={css.fileBoxTitle}><Icon size={14} /> {label}</div>
                    {existing?.public_url ? <a href={existing.public_url} target="_blank" rel="noreferrer">{existing.file_name}</a> : <div className={css.muted}>No file uploaded</div>}
                    <div style={{ marginTop: 8 }}>
                      <input className={css.fileInput} type="file" disabled={!selectedId || uploading === type} onChange={(e) => uploadFile(type, e.target.files?.[0] ?? null)} />
                      {uploading === type && <div className={css.muted}><Upload size={12} /> Uploading...</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={css.panel}>
          <div className={css.panelHead}>
            <div>
              <div className={css.panelTitle}>Follow-Up Actions</div>
              <div className={css.panelSub}>Track owner, due date, risk and closure</div>
            </div>
          </div>
          <div className={css.detailBody}>
            <div className={css.actionForm}>
              <div className={css.field}><label className={css.label}>Action</label><input className={css.input} value={newAction.action_text} onChange={(e) => setNewAction((a) => ({ ...a, action_text: e.target.value }))} /></div>
              <div className={css.field}><label className={css.label}>Assigned To</label><input className={css.input} value={newAction.assigned_to} onChange={(e) => setNewAction((a) => ({ ...a, assigned_to: e.target.value }))} /></div>
              <div className={css.field}><label className={css.label}>Due Date</label><input className={css.input} type="date" value={newAction.due_date} onChange={(e) => setNewAction((a) => ({ ...a, due_date: e.target.value }))} /></div>
              <button className={`${css.btn} ${css.btnPrimary}`} onClick={addAction}><Plus size={14} /> Add Action</button>
            </div>

            <div className={css.actions}>
              {selectedActions.map((action) => (
                <div className={css.actionCard} key={action.id}>
                  <div className={css.actionTop}>
                    <div className={css.actionText}>{action.action_text}</div>
                    <span className={`${css.badge} ${actionIsOverdue(action) ? css.badgeRisk : statusClass(action.status)}`}>
                      {actionIsOverdue(action) ? "overdue" : action.status}
                    </span>
                  </div>
                  <div className={css.progress}><span style={{ width: `${action.progress}%` }} /></div>
                  <div className={css.actionMeta}>
                    <span>Owner: {action.assigned_to}</span>
                    <span>Due: {fmtDate(action.due_date)}</span>
                    <span>Priority: {action.priority}</span>
                  </div>
                  <div className={css.heroActions} style={{ justifyContent: "flex-start", marginTop: 9 }}>
                    <button className={css.btn} onClick={() => updateActionStatus(action, "in-progress")}>In progress</button>
                    <button className={css.btn} onClick={() => updateActionStatus(action, "blocked")}>Blocked</button>
                    <button className={css.btn} onClick={() => updateActionStatus(action, "completed")}>Complete</button>
                  </div>
                </div>
              ))}
              {!selectedActions.length && <div className={css.empty}>No follow-up actions yet.</div>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
