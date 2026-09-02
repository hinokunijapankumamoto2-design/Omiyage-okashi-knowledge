import { randomUUID } from "node:crypto";

/**
 * Prefixed, sortable-ish identifiers: `<prefix>_<base36 time><random>`.
 * Readable in logs and stable as a SQLite TEXT primary key.
 */
export function newId(prefix: string): string {
  const time = Date.now().toString(36);
  const rand = randomUUID().replace(/-/g, "").slice(0, 10);
  return `${prefix}_${time}${rand}`;
}

export const ids = {
  department: () => newId("dep"),
  staff: () => newId("stf"),
  project: () => newId("prj"),
  task: () => newId("tsk"),
  subtask: () => newId("sub"),
  message: () => newId("msg"),
  meeting: () => newId("mtg"),
  report: () => newId("rpt"),
  run: () => newId("run"),
  credential: () => newId("cred"),
  skill: () => newId("skl"),
};
