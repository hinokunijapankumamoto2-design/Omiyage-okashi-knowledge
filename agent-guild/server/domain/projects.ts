import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { all, one, run, transact } from "../db/index.js";
import { ids } from "../core/ids.js";
import { bus } from "../core/events.js";
import { badRequest, notFound } from "../core/errors.js";
import { env } from "../env.js";
import { DEFAULT_PACK_KEY, packKeys } from "./packs.js";
import { detectGitRepo, currentBranch } from "../engine/git.js";

export interface Project {
  id: string;
  name: string;
  rootPath: string;
  objective: string;
  packKey: string;
  vcs: "git" | "none";
  baseBranch: string;
  isolation: "worktree" | "inplace";
  archived: number;
  lastUsedAt: number | null;
  createdAt: number;
  members?: string[];
}

const SELECT = `
  SELECT id, name, root_path AS rootPath, objective, pack_key AS packKey, vcs,
         base_branch AS baseBranch, isolation, archived, last_used_at AS lastUsedAt, created_at AS createdAt
  FROM projects`;

export function listProjects(includeArchived = false): Project[] {
  const rows = includeArchived
    ? all<Project>(`${SELECT} ORDER BY COALESCE(last_used_at, created_at) DESC`)
    : all<Project>(`${SELECT} WHERE archived = 0 ORDER BY COALESCE(last_used_at, created_at) DESC`);
  for (const project of rows) project.members = memberIds(project.id);
  return rows;
}

export function getProject(id: string): Project {
  const row = one<Project>(`${SELECT} WHERE id = ?`, id);
  if (!row) throw notFound("project");
  row.members = memberIds(id);
  return row;
}

function memberIds(projectId: string): string[] {
  return all<{ staff_id: string }>("SELECT staff_id FROM project_members WHERE project_id = ?", projectId).map(
    (row) => row.staff_id,
  );
}

/**
 * A project root is the only place agents are allowed to write. Validate it
 * once, here, rather than trusting a path that arrives with each run request.
 */
export function assertUsableRoot(rootPath: string): string {
  const resolved = path.resolve(rootPath);
  if (!existsSync(resolved)) throw badRequest("path_missing", `no such directory: ${resolved}`);
  if (!statSync(resolved).isDirectory()) throw badRequest("path_not_dir", `${resolved} is not a directory`);
  if (env.allowedRoots.length) {
    const permitted = env.allowedRoots.some(
      (root) => resolved === root || resolved.startsWith(root + path.sep),
    );
    if (!permitted) throw badRequest("path_not_allowed", `${resolved} is outside AG_ALLOWED_ROOTS`);
  }
  return resolved;
}

export interface ProjectInput {
  name: string;
  rootPath: string;
  objective?: string;
  packKey?: string;
  isolation?: "worktree" | "inplace";
  members?: string[];
}

export function createProject(input: ProjectInput): Project {
  const resolved = assertUsableRoot(input.rootPath);
  const packKey = input.packKey ?? DEFAULT_PACK_KEY;
  if (!packKeys().includes(packKey)) throw badRequest("unknown_pack", `unknown pack "${packKey}"`);
  const isRepo = detectGitRepo(resolved);
  const id = ids.project();
  transact(() => {
    run(
      `INSERT INTO projects (id, name, root_path, objective, pack_key, vcs, base_branch, isolation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.name,
      resolved,
      input.objective ?? "",
      packKey,
      isRepo ? "git" : "none",
      isRepo ? currentBranch(resolved) : "",
      isRepo ? (input.isolation ?? "worktree") : "inplace",
    );
    setMembers(id, input.members ?? []);
  });
  bus.publish({ type: "project.updated", projectId: id });
  return getProject(id);
}

export function setMembers(projectId: string, staffIds: string[]): void {
  run("DELETE FROM project_members WHERE project_id = ?", projectId);
  for (const staffId of staffIds) {
    run("INSERT OR IGNORE INTO project_members (project_id, staff_id) VALUES (?, ?)", projectId, staffId);
  }
}

export function updateProject(id: string, patch: Record<string, unknown>): Project {
  getProject(id);
  const sets: string[] = [];
  const params: unknown[] = [];
  const map: Record<string, string> = {
    name: "name",
    objective: "objective",
    packKey: "pack_key",
    isolation: "isolation",
    baseBranch: "base_branch",
  };
  for (const [key, column] of Object.entries(map)) {
    if (patch[key] === undefined) continue;
    sets.push(`${column} = ?`);
    params.push(String(patch[key]));
  }
  if (patch.rootPath !== undefined) {
    const resolved = assertUsableRoot(String(patch.rootPath));
    sets.push("root_path = ?", "vcs = ?");
    params.push(resolved, detectGitRepo(resolved) ? "git" : "none");
  }
  if (patch.archived !== undefined) {
    sets.push("archived = ?");
    params.push(patch.archived ? 1 : 0);
  }
  if (sets.length) {
    sets.push("updated_at = unixepoch() * 1000");
    run(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  }
  if (Array.isArray(patch.members)) setMembers(id, (patch.members as string[]).map(String));
  bus.publish({ type: "project.updated", projectId: id });
  return getProject(id);
}

export function touchProject(id: string): void {
  run("UPDATE projects SET last_used_at = unixepoch() * 1000 WHERE id = ?", id);
}

export function deleteProject(id: string): void {
  getProject(id);
  run("DELETE FROM projects WHERE id = ?", id);
  bus.publish({ type: "project.updated", projectId: id });
}
