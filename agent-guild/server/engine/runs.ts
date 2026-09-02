import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { all, one, run as exec } from "../db/index.js";
import { ids } from "../core/ids.js";
import { env } from "../env.js";
import { bus } from "../core/events.js";

export interface TaskRun {
  id: string;
  taskId: string;
  staffId: string | null;
  runnerKind: string;
  runnerId: string;
  model: string;
  attempt: number;
  state: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "timeout";
  pid: number | null;
  exitCode: number | null;
  prompt: string;
  outputTail: string;
  logFile: string;
  startedAt: number | null;
  finishedAt: number | null;
  createdAt: number;
}

const SELECT = `
  SELECT id, task_id AS taskId, staff_id AS staffId, runner_kind AS runnerKind, runner_id AS runnerId,
         model, attempt, state, pid, exit_code AS exitCode, prompt, output_tail AS outputTail,
         log_file AS logFile, started_at AS startedAt, finished_at AS finishedAt, created_at AS createdAt
  FROM task_runs`;

export function listRuns(taskId: string): TaskRun[] {
  return all<TaskRun>(`${SELECT} WHERE task_id = ? ORDER BY created_at`, taskId);
}

export function getRun(id: string): TaskRun | undefined {
  return one<TaskRun>(`${SELECT} WHERE id = ?`, id);
}

export function activeRuns(): TaskRun[] {
  return all<TaskRun>(`${SELECT} WHERE state IN ('queued', 'running') ORDER BY created_at`);
}

export function createRun(input: {
  taskId: string;
  staffId: string | null;
  runnerKind: string;
  runnerId: string;
  model: string;
  prompt: string;
}): TaskRun {
  const id = ids.run();
  const attempt =
    (one<{ n: number }>("SELECT COUNT(*) + 1 AS n FROM task_runs WHERE task_id = ?", input.taskId)?.n) ?? 1;
  const logFile = path.join(env.logDir, input.taskId, `${id}.log`);
  mkdirSync(path.dirname(logFile), { recursive: true });
  exec(
    `INSERT INTO task_runs (id, task_id, staff_id, runner_kind, runner_id, model, attempt, prompt, log_file)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.taskId,
    input.staffId,
    input.runnerKind,
    input.runnerId,
    input.model,
    attempt,
    input.prompt,
    logFile,
  );
  appendFileSync(logFile, `# run ${id} for task ${input.taskId}\n# prompt\n${input.prompt}\n\n# output\n`, "utf8");
  return getRun(id)!;
}

export function markRunning(id: string, pid?: number): void {
  exec("UPDATE task_runs SET state = 'running', pid = ?, started_at = unixepoch() * 1000 WHERE id = ?", pid ?? null, id);
}

const TAIL = 8_000;

export function appendOutput(runId: string, taskId: string, stream: "stdout" | "stderr", chunk: string): void {
  const record = getRun(runId);
  if (!record) return;
  try {
    appendFileSync(record.logFile, chunk, "utf8");
  } catch {
    // A full disk must not take the run down; the DB tail still carries context.
  }
  const tail = (record.outputTail + chunk).slice(-TAIL);
  exec("UPDATE task_runs SET output_tail = ? WHERE id = ?", tail, runId);
  bus.publish({ type: "task.log", taskId, stream, chunk });
}

export function finishRun(
  id: string,
  state: TaskRun["state"],
  exitCode: number | null,
  finalTail?: string,
): void {
  exec(
    `UPDATE task_runs SET state = ?, exit_code = ?, finished_at = unixepoch() * 1000,
            output_tail = COALESCE(?, output_tail)
      WHERE id = ?`,
    state,
    exitCode,
    finalTail ? finalTail.slice(-TAIL) : null,
    id,
  );
}

/** Reconciles rows left `running` by a crash or a restart. */
export function reconcileOrphanRuns(): number {
  const orphans = activeRuns();
  for (const orphan of orphans) {
    exec(
      "UPDATE task_runs SET state = 'cancelled', finished_at = unixepoch() * 1000 WHERE id = ?",
      orphan.id,
    );
  }
  return orphans.length;
}
