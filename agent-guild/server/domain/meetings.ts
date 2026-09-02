import { all, one, run } from "../db/index.js";
import { ids } from "../core/ids.js";
import { bus } from "../core/events.js";
import { notFound } from "../core/errors.js";

export interface MeetingNote {
  id: string;
  meetingId: string;
  staffId: string | null;
  staffName?: string | null;
  roleLabel: string;
  body: string;
  createdAt: number;
}

export interface Meeting {
  id: string;
  taskId: string | null;
  projectId: string | null;
  topic: string;
  kind: "kickoff" | "standup" | "review" | "retro" | "adhoc";
  state: "open" | "closed";
  summary: string;
  decisions: string;
  createdAt: number;
  closedAt: number | null;
  notes?: MeetingNote[];
}

const SELECT = `
  SELECT id, task_id AS taskId, project_id AS projectId, topic, kind, state, summary, decisions,
         created_at AS createdAt, closed_at AS closedAt
  FROM meetings`;

export function listMeetings(filter: { taskId?: string; projectId?: string } = {}): Meeting[] {
  if (filter.taskId) return all<Meeting>(`${SELECT} WHERE task_id = ? ORDER BY created_at DESC`, filter.taskId);
  if (filter.projectId)
    return all<Meeting>(`${SELECT} WHERE project_id = ? ORDER BY created_at DESC`, filter.projectId);
  return all<Meeting>(`${SELECT} ORDER BY created_at DESC LIMIT 100`);
}

export function getMeeting(id: string): Meeting {
  const row = one<Meeting>(`${SELECT} WHERE id = ?`, id);
  if (!row) throw notFound("meeting");
  row.notes = all<MeetingNote>(
    `SELECT n.id, n.meeting_id AS meetingId, n.staff_id AS staffId, s.display_name AS staffName,
            n.role_label AS roleLabel, n.body, n.created_at AS createdAt
     FROM meeting_notes n LEFT JOIN staff s ON s.id = n.staff_id
     WHERE n.meeting_id = ? ORDER BY n.created_at`,
    id,
  );
  return row;
}

export function openMeeting(input: {
  taskId?: string | null;
  projectId?: string | null;
  topic: string;
  kind?: Meeting["kind"];
}): Meeting {
  const id = ids.meeting();
  run(
    "INSERT INTO meetings (id, task_id, project_id, topic, kind) VALUES (?, ?, ?, ?, ?)",
    id,
    input.taskId ?? null,
    input.projectId ?? null,
    input.topic,
    input.kind ?? "kickoff",
  );
  bus.publish({ type: "meeting.updated", meetingId: id, taskId: input.taskId ?? null });
  return getMeeting(id);
}

export function addNote(meetingId: string, note: { staffId?: string | null; roleLabel?: string; body: string }): void {
  const meeting = getMeeting(meetingId);
  run(
    "INSERT INTO meeting_notes (id, meeting_id, staff_id, role_label, body) VALUES (?, ?, ?, ?, ?)",
    ids.report(),
    meetingId,
    note.staffId ?? null,
    note.roleLabel ?? "",
    note.body,
  );
  bus.publish({ type: "meeting.updated", meetingId, taskId: meeting.taskId });
}

export function closeMeeting(meetingId: string, summary: string, decisions: string[]): Meeting {
  run(
    `UPDATE meetings SET state = 'closed', summary = ?, decisions = ?, closed_at = unixepoch() * 1000
     WHERE id = ?`,
    summary,
    JSON.stringify(decisions),
    meetingId,
  );
  const meeting = getMeeting(meetingId);
  bus.publish({ type: "meeting.updated", meetingId, taskId: meeting.taskId });
  return meeting;
}

/** Renders minutes as Markdown — the shape the PPTX exporter consumes. */
export function minutesMarkdown(meetingId: string): string {
  const meeting = getMeeting(meetingId);
  const decisions: string[] = (() => {
    try {
      return JSON.parse(meeting.decisions === "" ? "[]" : meeting.decisions);
    } catch {
      return [];
    }
  })();
  const lines = [
    `# ${meeting.topic}`,
    "",
    `- Kind: ${meeting.kind}`,
    `- Opened: ${new Date(meeting.createdAt).toISOString()}`,
    meeting.closedAt ? `- Closed: ${new Date(meeting.closedAt).toISOString()}` : "- Status: open",
    "",
    "## Discussion",
    "",
  ];
  for (const note of meeting.notes ?? []) {
    lines.push(`**${note.staffName ?? (note.roleLabel || "member")}** — ${note.body}`, "");
  }
  if (meeting.summary) lines.push("## Summary", "", meeting.summary, "");
  if (decisions.length) {
    lines.push("## Decisions", "");
    decisions.forEach((decision, index) => lines.push(`${index + 1}. ${decision}`));
  }
  return lines.join("\n");
}
