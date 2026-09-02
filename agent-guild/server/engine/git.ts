import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { createLogger } from "../core/logger.js";

const log = createLogger("git");

function git(cwd: string, args: string[], allowFailure = false): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (allowFailure) return "";
    const stderr = (error as { stderr?: string }).stderr ?? "";
    throw new Error(`git ${args.join(" ")} failed: ${stderr.trim() || String(error)}`);
  }
}

export function detectGitRepo(root: string): boolean {
  if (!existsSync(path.join(root, ".git"))) {
    return git(root, ["rev-parse", "--is-inside-work-tree"], true) === "true";
  }
  return true;
}

export function currentBranch(root: string): string {
  return git(root, ["rev-parse", "--abbrev-ref", "HEAD"], true) || "main";
}

export function branchNameFor(taskId: string, slug: string): string {
  const safe = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return `guild/${safe || "task"}-${taskId.split("_")[1]?.slice(0, 6) ?? "wip"}`;
}

export interface Workspace {
  path: string;
  branch: string;
  isolated: boolean;
}

/**
 * Each task gets its own git worktree so concurrent agents never fight over the
 * same checkout, and so a bad run can be discarded without touching the repo.
 */
export function openWorkspace(
  root: string,
  taskId: string,
  slug: string,
  isolation: "worktree" | "inplace",
  baseBranch: string,
): Workspace {
  if (isolation === "inplace" || !detectGitRepo(root)) {
    return { path: root, branch: currentBranch(root), isolated: false };
  }
  const branch = branchNameFor(taskId, slug);
  const worktreePath = path.join(root, ".guild-worktrees", taskId);
  if (existsSync(worktreePath)) return { path: worktreePath, branch, isolated: true };

  const base = baseBranch || currentBranch(root);
  const exists = git(root, ["rev-parse", "--verify", branch], true) !== "";
  const args = exists
    ? ["worktree", "add", worktreePath, branch]
    : ["worktree", "add", "-b", branch, worktreePath, base];
  git(root, args);
  log.info(`worktree ready for ${taskId}`, { worktreePath, branch });
  return { path: worktreePath, branch, isolated: true };
}

export function workspaceDiff(root: string, workspace: Workspace): string {
  const cwd = workspace.path;
  const staged = git(cwd, ["add", "-A", "--dry-run"], true);
  void staged;
  const diff = git(cwd, ["diff", "HEAD", "--stat"], true);
  const full = git(cwd, ["diff", "HEAD"], true);
  void root;
  return [diff, "", full].join("\n").trim();
}

export function hasChanges(workspace: Workspace): boolean {
  return git(workspace.path, ["status", "--porcelain"], true).length > 0;
}

export function commitWorkspace(workspace: Workspace, message: string): string {
  git(workspace.path, ["add", "-A"]);
  if (!git(workspace.path, ["diff", "--cached", "--name-only"], true)) return "";
  git(workspace.path, ["commit", "-m", message]);
  return git(workspace.path, ["rev-parse", "HEAD"], true);
}

export function mergeWorkspace(root: string, workspace: Workspace, targetBranch: string): string {
  const target = targetBranch || currentBranch(root);
  git(root, ["checkout", target]);
  git(root, ["merge", "--no-ff", "-m", `guild: merge ${workspace.branch}`, workspace.branch]);
  return git(root, ["rev-parse", "HEAD"], true);
}

export function discardWorkspace(root: string, workspace: Workspace): void {
  if (!workspace.isolated) return;
  git(root, ["worktree", "remove", "--force", workspace.path], true);
  if (existsSync(workspace.path)) rmSync(workspace.path, { recursive: true, force: true });
  git(root, ["branch", "-D", workspace.branch], true);
}

export function listBranches(root: string): string[] {
  const output = git(root, ["branch", "--format=%(refname:short)"], true);
  return output ? output.split("\n").map((line) => line.trim()).filter(Boolean) : [];
}
