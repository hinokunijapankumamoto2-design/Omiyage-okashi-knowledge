import { all, one, run, transact } from "../db/index.js";
import { ids } from "../core/ids.js";
import { bus } from "../core/events.js";
import { badRequest, notFound } from "../core/errors.js";

export type Stage =
  | "inbox"
  | "planning"
  | "aligning"
  | "running"
  | "review"
  | "done"
  | "blocked"
  | "cancelled";

export const STAGES: Stage[] = [
  "inbox",
  "planning",
  "aligning",
  "running",
  "review",
  "done",
  "blocked",
  "cancelled",
];

/**
 * Legal stage transitions. Keeping them in one table means the API, the UI drag
 * handler and the engine all agree on what is possible.
 */
const TRANSITIONS: Record<Stage, Stage[]> = {
  inbox: ["planning", "cancelled"],
  planning: ["aligning", "running", "blocked", "cancelled", "inbox"],
  aligning: ["running", "planning", "blocked", "cancelled"],
  running: ["review", "blocked", "cancelled", "done"],
  review: ["done", "running", "blocked", "cancelled"],
  blocked: ["planning", "running", "cancelled"],
  done: ["review"],
  cancelled: ["inbox"],
};

export function canTransition(from: Stage, to: Stage): boolean {
  return from === to || (TRANSITIONS[from] ?? []).includes(to);
}

export interface Task {
  id: string;
  projectId: string | null;
  parentTaskId: string | null;
  title: string;
  brief: string;
  acceptance: string;
  stage: Stage;
  priority: number;
  departmentId: string | null;
  assigneeId: string | null;
  requestedBy: string;
  workspacePath: string;
  branch: string;
  reviewRound: number;
  reviewVerdict: string;
  resultSummary: string;
  failureReason: string;
  hidden: number;
  sortOrder: number;
  startedAt: number | null;
  finishedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

const SELECT = `
  SELECT id, project_id AS projectId, parent_task_id AS parentTaskId, title, brief, acceptance, stage,
         priority, department_id AS departmentId, assignee_id AS assigneeId, requested_by AS requestedBy,
         workspace_path AS workspacePath, branch, review_round AS reviewRound, review_verdict AS reviewVerdict,
         result_summary AS resultSummary, failure_reason AS failureReason, hidden, sort_order AS sortOrder,
         started_at AS startedAt, finished_at AS finishedAt, created_at AS createdAt, updated_at AS updatedAt
  FROM tasks`;

export interface TaskFilter {
  projectId?: string;
  stage?: Stage;
  assigneeId?: string;
  departmentId?: string;
  parentTaskId?: string | null;
  includeHidden?: boolean;
}

export function listTasks(filter: TaskFilter = {}): Task[] {
  const where: string[] = [];
  const params: unknown[] = [];
  const clause = (sql: string, value: unknown) => {
    where.push(sql);
    params.push(value);
  };
  if (filter.projectId) clause("project_id = ?", filter.projectId);
  if (filter.stage) clause("stage = ?", filter.stage);
  if (filter.assigneeId) clause("assignee_id = ?", filter.assigneeId);
  if (filter.departmentId) clause("department_id = ?", filter.departmentId);
  if (filter.parentTaskId === null) where.push("parent_task_id IS NULL");
  else if (filter.parentTaskId) clause("parent_task_id = ?", filter.parentTaskId);
  if (!filter.includeHidden) where.push("hidden = 0");
  const sql = `${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
               ORDER BY sort_order, priority DESC, created_at DESC`;
  return all<Task>(sql, ...params);
}

export function getTask(id: string): Task {
  const row = one<Task>(`${SELECT} WHERE id = ?`, id);
  if (!row) throw notFound("task");
  return row;
}

export interface TaskInput {
  projectId?: string | null;
  parentTaskId?: string | null;
  title: string;
  brief?: string;
  acceptance?: string;
  priority?: number;
  departmentId?: string | null;
  assigneeId?: string | null;
  requestedBy?: string;
  stage?: Stage;
}

export function createTask(input: TaskInput): Task {
  if (!input.title.trim()) throw badRequest("title_required", "a task needs a title");
  const id = ids.task();
  const nextOrder = one<{ n: number }>("SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM tasks")?.n ?? 0;
  run(
    `INSERT INTO tasks (id, project_id, parent_task_id, title, brief, acceptance, stage, priority,
                        department_id, assignee_id, requested_by, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.projectId ?? null,
    input.parentTaskId ?? null,
    input.title.trim(),
    input.brief ?? "",
    input.acceptance ?? "",
    input.stage ?? "inbox",
    input.priority ?? 2,
    input.departmentId ?? null,
    input.assigneeId ?? null,
    input.requestedBy ?? "ceo",
    nextOrder,
  );
  bus.publish({ type: "task.created", taskId: id });
  return getTask(id);
}

const EDITABLE: Record<string, string> = {
  title: "title",
  brief: "brief",
  acceptance: "acceptance",
  priority: "priority",
  departmentId: "department_id",
  assigneeId: "assignee_id",
  projectId: "project_id",
  workspacePath: "workspace_path",
  branch: "branch",
  reviewRound: "review_round",
  reviewVerdict: "review_verdict",
  resultSummary: "result_summary",
  failureReason: "failure_reason",
  sortOrder: "sort_order",
};

export function updateTask(id: string, patch: Record<string, unknown>): Task {
  const current = getTask(id);
  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.stage !== undefined) {
    const next = patch.stage as Stage;
    if (!STAGES.includes(next)) throw badRequest("unknown_stage", `unknown stage "${next}"`);
    if (!canTransition(current.stage, next)) {
      throw badRequest("illegal_transition", `cannot move a task from ${current.stage} to ${next}`);
    }
    sets.push("stage = ?");
    params.push(next);
    if (next === "running" && !current.startedAt) sets.push("started_at = unixepoch() * 1000");
    if (next === "done" || next === "cancelled") sets.push("finished_at = unixepoch() * 1000");
  }
  for (const [key, column] of Object.entries(EDITABLE)) {
    if (patch[key] === undefined) continue;
    sets.push(`${column} = ?`);
    params.push(patch[key] === null ? null : (patch[key] as never));
  }
  if (patch.hidden !== undefined) {
    sets.push("hidden = ?");
    params.push(patch.hidden ? 1 : 0);
  }
  if (sets.length) {
    sets.push("updated_at = unixepoch() * 1000");
    run(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  }
  const updated = getTask(id);
  bus.publish({ type: "task.updated", taskId: id, stage: updated.stage });
  return updated;
}

export function reorderTasks(stage: Stage, orderedIds: string[]): void {
  transact(() => {
    orderedIds.forEach((id, index) => run("UPDATE tasks SET sort_order = ? WHERE id = ?", index, id));
  });
  bus.publish({ type: "task.updated", taskId: orderedIds[0] ?? "", stage });
}

export function deleteTask(id: string): void {
  getTask(id);
  run("DELETE FROM tasks WHERE id = ?", id);
  bus.publish({ type: "task.updated", taskId: id, stage: "cancelled" });
}

export function subtasksOf(taskId: string): Task[] {
  return listTasks({ parentTaskId: taskId, includeHidden: true });
}

export function boardSnapshot(projectId?: string): Record<Stage, Task[]> {
  const board = Object.fromEntries(STAGES.map((stage) => [stage, [] as Task[]])) as Record<Stage, Task[]>;
  for (const task of listTasks({ projectId, parentTaskId: null })) board[task.stage].push(task);
  return board;
}
