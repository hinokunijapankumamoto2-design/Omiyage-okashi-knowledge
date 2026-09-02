import { all, one, run, transact } from "../db/index.js";
import { ids } from "../core/ids.js";
import { bus } from "../core/events.js";
import { notFound } from "../core/errors.js";

export interface Department {
  id: string;
  packKey: string;
  code: string;
  nameEn: string;
  nameJa: string;
  nameKo: string;
  nameZh: string;
  mission: string;
  accent: string;
  sortOrder: number;
  headcount?: number;
}

const SELECT = `
  SELECT d.id, d.pack_key AS packKey, d.code, d.name_en AS nameEn, d.name_ja AS nameJa,
         d.name_ko AS nameKo, d.name_zh AS nameZh, d.mission, d.accent, d.sort_order AS sortOrder,
         (SELECT COUNT(*) FROM staff s WHERE s.department_id = d.id) AS headcount
  FROM departments d`;

export function listDepartments(packKey?: string): Department[] {
  return packKey
    ? all<Department>(`${SELECT} WHERE d.pack_key = ? ORDER BY d.sort_order, d.code`, packKey)
    : all<Department>(`${SELECT} ORDER BY d.pack_key, d.sort_order, d.code`);
}

export function getDepartment(id: string): Department {
  const row = one<Department>(`${SELECT} WHERE d.id = ?`, id);
  if (!row) throw notFound("department");
  return row;
}

export function findDepartmentByCode(packKey: string, code: string): Department | undefined {
  return one<Department>(`${SELECT} WHERE d.pack_key = ? AND d.code = ?`, packKey, code);
}

export function createDepartment(input: Partial<Department> & { code: string; nameEn: string }): Department {
  const id = ids.department();
  const nextOrder =
    (one<{ n: number }>("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM departments WHERE pack_key = ?",
      input.packKey ?? "software")?.n) ?? 0;
  run(
    `INSERT INTO departments (id, pack_key, code, name_en, name_ja, name_ko, name_zh, mission, accent, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.packKey ?? "software",
    input.code,
    input.nameEn,
    input.nameJa ?? "",
    input.nameKo ?? "",
    input.nameZh ?? "",
    input.mission ?? "",
    input.accent ?? "#6c8cff",
    nextOrder,
  );
  bus.publish({ type: "department.updated" });
  return getDepartment(id);
}

const EDITABLE: Record<string, string> = {
  nameEn: "name_en",
  nameJa: "name_ja",
  nameKo: "name_ko",
  nameZh: "name_zh",
  mission: "mission",
  accent: "accent",
};

export function updateDepartment(id: string, patch: Record<string, unknown>): Department {
  getDepartment(id);
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(EDITABLE)) {
    if (patch[key] === undefined) continue;
    sets.push(`${column} = ?`);
    params.push(String(patch[key]));
  }
  if (sets.length) run(`UPDATE departments SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  bus.publish({ type: "department.updated" });
  return getDepartment(id);
}

export function deleteDepartment(id: string): void {
  getDepartment(id);
  run("DELETE FROM departments WHERE id = ?", id);
  bus.publish({ type: "department.updated" });
}

export function reorderDepartments(orderedIds: string[]): void {
  transact(() => {
    orderedIds.forEach((id, index) => run("UPDATE departments SET sort_order = ? WHERE id = ?", index, id));
  });
  bus.publish({ type: "department.updated" });
}
