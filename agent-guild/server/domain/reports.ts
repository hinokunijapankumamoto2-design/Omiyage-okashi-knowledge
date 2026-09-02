import { all, one, run } from "../db/index.js";
import { ids } from "../core/ids.js";
import { notFound } from "../core/errors.js";

export interface Report {
  id: string;
  taskId: string | null;
  staffId: string | null;
  staffName?: string | null;
  taskTitle?: string | null;
  title: string;
  body: string;
  artifacts: string;
  archived: number;
  createdAt: number;
}

const SELECT = `
  SELECT r.id, r.task_id AS taskId, r.staff_id AS staffId, s.display_name AS staffName,
         t.title AS taskTitle, r.title, r.body, r.artifacts, r.archived, r.created_at AS createdAt
  FROM reports r
  LEFT JOIN staff s ON s.id = r.staff_id
  LEFT JOIN tasks t ON t.id = r.task_id`;

export function listReports(filter: { taskId?: string; archived?: boolean } = {}): Report[] {
  if (filter.taskId) return all<Report>(`${SELECT} WHERE r.task_id = ? ORDER BY r.created_at DESC`, filter.taskId);
  return all<Report>(
    `${SELECT} WHERE r.archived = ? ORDER BY r.created_at DESC LIMIT 200`,
    filter.archived ? 1 : 0,
  );
}

export function getReport(id: string): Report {
  const row = one<Report>(`${SELECT} WHERE r.id = ?`, id);
  if (!row) throw notFound("report");
  return row;
}

export function fileReport(input: {
  taskId?: string | null;
  staffId?: string | null;
  title: string;
  body: string;
  artifacts?: string[];
}): Report {
  const id = ids.report();
  run(
    "INSERT INTO reports (id, task_id, staff_id, title, body, artifacts) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    input.taskId ?? null,
    input.staffId ?? null,
    input.title,
    input.body,
    JSON.stringify(input.artifacts ?? []),
  );
  return getReport(id);
}

export function archiveReport(id: string, archived: boolean): Report {
  getReport(id);
  run("UPDATE reports SET archived = ? WHERE id = ?", archived ? 1 : 0, id);
  return getReport(id);
}
