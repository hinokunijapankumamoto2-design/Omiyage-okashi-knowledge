import { all, one, run } from "../db/index.js";
import { ids } from "../core/ids.js";
import { bus } from "../core/events.js";
import { badRequest, notFound } from "../core/errors.js";
import { getRunner } from "../providers/registry.js";

export type Seniority = "lead" | "senior" | "associate" | "trainee";
export type StaffStatus = "idle" | "working" | "meeting" | "break" | "offline";

export interface Staff {
  id: string;
  departmentId: string | null;
  departmentCode?: string | null;
  departmentAccent?: string | null;
  displayName: string;
  nameJa: string;
  nameKo: string;
  nameZh: string;
  seniority: Seniority;
  isCoordinator: number;
  runnerKind: "cli" | "http" | "manual";
  runnerId: string;
  model: string;
  credentialId: string | null;
  temperament: string;
  avatarSeed: number;
  status: StaffStatus;
  activeTaskId: string | null;
  xp: number;
  completedTasks: number;
  failedTasks: number;
  hiredAt: number;
  skills?: string[];
}

const SELECT = `
  SELECT s.id, s.department_id AS departmentId, d.code AS departmentCode, d.accent AS departmentAccent,
         s.display_name AS displayName, s.name_ja AS nameJa, s.name_ko AS nameKo, s.name_zh AS nameZh,
         s.seniority, s.is_coordinator AS isCoordinator, s.runner_kind AS runnerKind, s.runner_id AS runnerId,
         s.model, s.credential_id AS credentialId, s.temperament, s.avatar_seed AS avatarSeed,
         s.status, s.active_task_id AS activeTaskId, s.xp, s.completed_tasks AS completedTasks,
         s.failed_tasks AS failedTasks, s.hired_at AS hiredAt
  FROM staff s LEFT JOIN departments d ON d.id = s.department_id`;

export function listStaff(filter: { departmentId?: string; status?: string } = {}): Staff[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.departmentId) {
    where.push("s.department_id = ?");
    params.push(filter.departmentId);
  }
  if (filter.status) {
    where.push("s.status = ?");
    params.push(filter.status);
  }
  const sql = `${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY d.sort_order, s.seniority, s.display_name`;
  return all<Staff>(sql, ...params);
}

export function getStaff(id: string): Staff {
  const row = one<Staff>(`${SELECT} WHERE s.id = ?`, id);
  if (!row) throw notFound("staff member");
  return row;
}

export function getStaffWithSkills(id: string): Staff {
  const staff = getStaff(id);
  staff.skills = all<{ slug: string }>(
    `SELECT sk.slug FROM staff_skills ss JOIN skills sk ON sk.id = ss.skill_id WHERE ss.staff_id = ? ORDER BY sk.slug`,
    id,
  ).map((row) => row.slug);
  return staff;
}

export interface StaffInput {
  departmentId?: string | null;
  displayName: string;
  nameJa?: string;
  nameKo?: string;
  nameZh?: string;
  seniority?: Seniority;
  isCoordinator?: boolean;
  runnerKind?: "cli" | "http" | "manual";
  runnerId?: string;
  model?: string;
  credentialId?: string | null;
  temperament?: string;
  avatarSeed?: number;
}

function assertRunner(kind: string, runnerId: string): void {
  const runner = getRunner(runnerId);
  if (!runner) throw badRequest("unknown_runner", `no runner registered with id "${runnerId}"`);
  if (runner.kind !== kind) {
    throw badRequest("runner_kind_mismatch", `runner "${runnerId}" is of kind "${runner.kind}", not "${kind}"`);
  }
}

export function hireStaff(input: StaffInput): Staff {
  const runnerKind = input.runnerKind ?? "cli";
  const runnerId = input.runnerId ?? (runnerKind === "http" ? "openai-compatible" : "claude-code");
  assertRunner(runnerKind, runnerId);
  const id = ids.staff();
  const seedCount = one<{ n: number }>("SELECT COUNT(*) AS n FROM staff")?.n ?? 0;
  run(
    `INSERT INTO staff (id, department_id, display_name, name_ja, name_ko, name_zh, seniority,
                        is_coordinator, runner_kind, runner_id, model, credential_id, temperament, avatar_seed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.departmentId ?? null,
    input.displayName,
    input.nameJa ?? "",
    input.nameKo ?? "",
    input.nameZh ?? "",
    input.seniority ?? "associate",
    input.isCoordinator ? 1 : 0,
    runnerKind,
    runnerId,
    input.model ?? "",
    input.credentialId ?? null,
    input.temperament ?? "",
    input.avatarSeed ?? seedCount + 1,
  );
  bus.publish({ type: "staff.updated", staffId: id });
  return getStaff(id);
}

const EDITABLE: Record<string, string> = {
  departmentId: "department_id",
  displayName: "display_name",
  nameJa: "name_ja",
  nameKo: "name_ko",
  nameZh: "name_zh",
  seniority: "seniority",
  runnerKind: "runner_kind",
  runnerId: "runner_id",
  model: "model",
  credentialId: "credential_id",
  temperament: "temperament",
  avatarSeed: "avatar_seed",
  status: "status",
};

export function updateStaff(id: string, patch: Record<string, unknown>): Staff {
  const current = getStaff(id);
  if (patch.runnerKind || patch.runnerId) {
    assertRunner(String(patch.runnerKind ?? current.runnerKind), String(patch.runnerId ?? current.runnerId));
  }
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(EDITABLE)) {
    if (patch[key] === undefined) continue;
    sets.push(`${column} = ?`);
    params.push(patch[key] === null ? null : (patch[key] as never));
  }
  if (patch.isCoordinator !== undefined) {
    sets.push("is_coordinator = ?");
    params.push(patch.isCoordinator ? 1 : 0);
  }
  if (sets.length) {
    sets.push("updated_at = unixepoch() * 1000");
    run(`UPDATE staff SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  }
  bus.publish({ type: "staff.updated", staffId: id });
  return getStaff(id);
}

export function dismissStaff(id: string): void {
  const staff = getStaff(id);
  if (staff.status === "working") {
    throw badRequest("staff_busy", "stop the member's current run before removing them");
  }
  run("DELETE FROM staff WHERE id = ?", id);
  bus.publish({ type: "staff.updated", staffId: id });
}

export function setStatus(id: string, status: StaffStatus, taskId: string | null = null): void {
  run(
    "UPDATE staff SET status = ?, active_task_id = ?, updated_at = unixepoch() * 1000 WHERE id = ?",
    status,
    taskId,
    id,
  );
  bus.publish({ type: "staff.status", staffId: id, status, taskId });
}

/** XP curve: each level costs 15% more than the previous one. */
export function levelFromXp(xp: number): { level: number; into: number; span: number } {
  let level = 1;
  let span = 100;
  let remaining = xp;
  while (remaining >= span) {
    remaining -= span;
    level += 1;
    span = Math.round(span * 1.15);
  }
  return { level, into: remaining, span };
}

export function awardXp(id: string, amount: number, succeeded: boolean): void {
  run(
    `UPDATE staff
        SET xp = MAX(0, xp + ?),
            completed_tasks = completed_tasks + ?,
            failed_tasks = failed_tasks + ?,
            updated_at = unixepoch() * 1000
      WHERE id = ?`,
    amount,
    succeeded ? 1 : 0,
    succeeded ? 0 : 1,
    id,
  );
  bus.publish({ type: "staff.updated", staffId: id });
}

export function leaderboard(limit = 10): Array<Staff & { level: number }> {
  return listStaff()
    .sort((a, b) => b.xp - a.xp || b.completedTasks - a.completedTasks)
    .slice(0, limit)
    .map((staff) => ({ ...staff, level: levelFromXp(staff.xp).level }));
}
