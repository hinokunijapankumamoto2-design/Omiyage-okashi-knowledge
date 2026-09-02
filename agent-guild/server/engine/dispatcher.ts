import { env } from "../env.js";
import { createLogger } from "../core/logger.js";
import { bus } from "../core/events.js";
import { badRequest } from "../core/errors.js";
import { getPack } from "../domain/packs.js";
import { listDepartments, findDepartmentByCode } from "../domain/departments.js";
import { awardXp, getStaff, listStaff, setStatus, type Staff } from "../domain/staff.js";
import { getProject, touchProject, type Project } from "../domain/projects.js";
import { getTask, updateTask, createTask, type Task } from "../domain/tasks.js";
import { fileReport } from "../domain/reports.js";
import { postMessage } from "../domain/messages.js";
import { resolveCredential } from "../domain/credentials.js";
import { readSetting } from "../domain/settings.js";
import { getRunner } from "../providers/registry.js";
import { runCli } from "../providers/cli-runner.js";
import { runHttp } from "../providers/http-runner.js";
import type { RunOutcome } from "../providers/types.js";
import { buildPlanningPrompt, buildReviewPrompt, buildWorkerPrompt } from "./prompt.js";
import { parsePlanJson, parseReviewVerdict, parseWorkerReport } from "./report-parser.js";
import * as runs from "./runs.js";
import { commitWorkspace, discardWorkspace, hasChanges, mergeWorkspace, openWorkspace, workspaceDiff } from "./git.js";

const log = createLogger("dispatcher");

interface QueueEntry {
  taskId: string;
  mode: "work" | "review" | "plan";
  notes: string[];
}

const queue: QueueEntry[] = [];
const inFlight = new Map<string, { controller: AbortController; runId: string }>();

export function queueDepth(): number {
  return queue.length;
}

export function runningTaskIds(): string[] {
  return [...inFlight.keys()];
}

export function enqueue(taskId: string, mode: QueueEntry["mode"] = "work", notes: string[] = []): void {
  if (inFlight.has(taskId)) throw badRequest("already_running", "that task already has a run in flight");
  if (queue.some((entry) => entry.taskId === taskId)) return;
  queue.push({ taskId, mode, notes });
  bus.publish({ type: "notice", level: "info", text: `queued ${mode} for ${taskId}` });
  void pump();
}

export function cancel(taskId: string): boolean {
  const index = queue.findIndex((entry) => entry.taskId === taskId);
  if (index >= 0) {
    queue.splice(index, 1);
    return true;
  }
  const active = inFlight.get(taskId);
  if (!active) return false;
  active.controller.abort();
  return true;
}

let pumping = false;

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length && inFlight.size < env.maxConcurrentRuns) {
      const entry = queue.shift()!;
      void execute(entry).catch((error) => {
        log.error(`run failed for ${entry.taskId}`, error instanceof Error ? error.message : String(error));
      });
    }
  } finally {
    pumping = false;
  }
}

function packForTask(task: Task): ReturnType<typeof getPack> {
  const project = task.projectId ? safeProject(task.projectId) : undefined;
  return getPack(project?.packKey ?? readSetting("guild.activePack", "software"));
}

function safeProject(id: string): Project | undefined {
  try {
    return getProject(id);
  } catch {
    return undefined;
  }
}

/** Picks the least-loaded idle member of the target department. */
export function pickAssignee(task: Task, prefer: "worker" | "reviewer" | "coordinator"): Staff | undefined {
  const pack = packForTask(task);
  const project = task.projectId ? safeProject(task.projectId) : undefined;
  const roster = listStaff().filter((staff) => staff.runnerKind !== "manual");
  const pool = project?.members?.length
    ? roster.filter((staff) => project.members!.includes(staff.id))
    : roster;

  const wantedCode =
    prefer === "reviewer" ? pack.reviewerCode : prefer === "coordinator" ? pack.coordinatorCode : undefined;

  let candidates = pool;
  if (prefer === "worker" && task.departmentId) {
    candidates = pool.filter((staff) => staff.departmentId === task.departmentId);
  } else if (wantedCode) {
    const department = findDepartmentByCode(pack.key, wantedCode);
    candidates = department ? pool.filter((staff) => staff.departmentId === department.id) : pool;
  }
  if (!candidates.length) candidates = pool;

  const idle = candidates.filter((staff) => staff.status === "idle");
  const ranked = (idle.length ? idle : candidates).sort((a, b) => {
    if (prefer !== "worker") {
      const rank = (staff: Staff) => (staff.seniority === "lead" ? 0 : staff.seniority === "senior" ? 1 : 2);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
    }
    return a.completedTasks - b.completedTasks;
  });
  return ranked[0];
}

async function invokeRunner(
  staff: Staff,
  prompt: string,
  cwd: string,
  runId: string,
  taskId: string,
  controller: AbortController,
): Promise<RunOutcome> {
  const runner = getRunner(staff.runnerId);
  if (!runner) return { ok: false, text: "", exitCode: null, error: `unknown runner ${staff.runnerId}` };

  if (!env.executionEnabled) {
    const simulated = [
      "[simulation] AG_ENABLE_EXECUTION is off, so no agent process was started.",
      "",
      "GUILD-REPORT",
      "status: done",
      "summary: Simulated run — execution is disabled in this environment.",
      "changed: none",
      "verified: none",
    ].join("\n");
    runs.appendOutput(runId, taskId, "stdout", simulated);
    return { ok: true, text: simulated, exitCode: 0 };
  }

  const context = {
    prompt,
    cwd,
    model: staff.model || undefined,
    timeoutMs: env.runTimeoutMs,
    signal: controller.signal,
    onChunk: (stream: "stdout" | "stderr", chunk: string) => runs.appendOutput(runId, taskId, stream, chunk),
    credential: resolveCredential(staff.credentialId),
  };

  if (runner.kind === "cli" && runner.cli) return runCli(runner.cli, context);
  if (runner.kind === "http" && runner.http) return runHttp(runner.http, context);
  return { ok: false, text: "", exitCode: null, error: `runner ${runner.id} cannot execute work` };
}

async function execute(entry: QueueEntry): Promise<void> {
  const task = getTask(entry.taskId);
  const pack = packForTask(task);
  const project = task.projectId ? safeProject(task.projectId) : undefined;

  const prefer = entry.mode === "review" ? "reviewer" : entry.mode === "plan" ? "coordinator" : "worker";
  const staff = task.assigneeId && entry.mode === "work" ? getStaff(task.assigneeId) : pickAssignee(task, prefer);
  if (!staff) {
    updateTask(task.id, { stage: "blocked", failureReason: "no eligible staff member is available" });
    return;
  }

  const workspace = project
    ? openWorkspace(project.rootPath, task.id, task.title, project.isolation, project.baseBranch)
    : { path: process.cwd(), branch: "", isolated: false };

  const prompt =
    entry.mode === "plan"
      ? buildPlanningPrompt({
          pack,
          task,
          coordinator: staff,
          departments: listDepartments(pack.key).map((department) => ({
            code: department.code,
            nameEn: department.nameEn,
            mission: department.mission,
          })),
        })
      : entry.mode === "review"
        ? buildReviewPrompt({
            pack,
            task,
            reviewer: staff,
            workerReport: task.resultSummary,
            diff: project ? workspaceDiff(project.rootPath, workspace) : "",
            round: task.reviewRound + 1,
          })
        : buildWorkerPrompt({ pack, task, staff, project, workspacePath: workspace.path, notes: entry.notes });

  const record = runs.createRun({
    taskId: task.id,
    staffId: staff.id,
    runnerKind: staff.runnerKind,
    runnerId: staff.runnerId,
    model: staff.model,
    prompt,
  });

  const controller = new AbortController();
  inFlight.set(task.id, { controller, runId: record.id });
  runs.markRunning(record.id);
  setStatus(staff.id, entry.mode === "plan" ? "meeting" : "working", task.id);
  updateTask(task.id, {
    stage: entry.mode === "work" ? "running" : task.stage,
    assigneeId: entry.mode === "work" ? staff.id : task.assigneeId,
    workspacePath: workspace.path,
    branch: workspace.branch,
  });
  if (project) touchProject(project.id);

  let outcome: RunOutcome;
  try {
    outcome = await invokeRunner(staff, prompt, workspace.path, record.id, task.id, controller);
  } catch (error) {
    outcome = { ok: false, text: "", exitCode: null, error: error instanceof Error ? error.message : String(error) };
  } finally {
    inFlight.delete(task.id);
    setStatus(staff.id, "idle", null);
  }

  runs.finishRun(
    record.id,
    outcome.timedOut ? "timeout" : outcome.ok ? "succeeded" : controller.signal.aborted ? "cancelled" : "failed",
    outcome.exitCode,
    outcome.text,
  );

  if (entry.mode === "plan") await settlePlan(task, staff, outcome, pack);
  else if (entry.mode === "review") await settleReview(task, staff, outcome, project, workspace);
  else await settleWork(task, staff, outcome, project, workspace);

  void pump();
}

async function settleWork(
  task: Task,
  staff: Staff,
  outcome: RunOutcome,
  project: Project | undefined,
  workspace: { path: string; branch: string; isolated: boolean },
): Promise<void> {
  if (!outcome.ok) {
    updateTask(task.id, { stage: "blocked", failureReason: outcome.error ?? "run failed" });
    awardXp(staff.id, 2, false);
    bus.publish({ type: "task.finished", taskId: task.id, outcome: "failed" });
    postMessage({
      channel: "lobby",
      taskId: task.id,
      authorKind: "system",
      body: `${staff.displayName} could not finish "${task.title}": ${outcome.error ?? "unknown error"}`,
    });
    return;
  }

  const report = parseWorkerReport(outcome.text);
  fileReport({
    taskId: task.id,
    staffId: staff.id,
    title: `${task.title} — run report`,
    body: outcome.text.slice(-40_000),
    artifacts: report.changed,
  });

  if (report.status === "blocked") {
    updateTask(task.id, { stage: "blocked", failureReason: report.blocker || report.summary });
    awardXp(staff.id, 4, false);
    bus.publish({ type: "task.finished", taskId: task.id, outcome: "failed" });
    return;
  }

  if (project && workspace.isolated && hasChanges(workspace)) {
    commitWorkspace(workspace, `guild: ${task.title}`);
  }

  updateTask(task.id, { stage: "review", resultSummary: report.summary, failureReason: "" });
  awardXp(staff.id, 12, true);
  postMessage({
    channel: "lobby",
    taskId: task.id,
    authorKind: "staff",
    authorId: staff.id,
    body: `Finished "${task.title}". ${report.summary}`,
  });

  if (readSetting("engine.autoDispatch", true)) enqueue(task.id, "review");
}

async function settleReview(
  task: Task,
  reviewer: Staff,
  outcome: RunOutcome,
  project: Project | undefined,
  workspace: { path: string; branch: string; isolated: boolean },
): Promise<void> {
  const maxRounds = Number(readSetting("engine.reviewRounds", 2));
  const round = task.reviewRound + 1;

  if (!outcome.ok) {
    updateTask(task.id, { reviewRound: round, reviewVerdict: "error", failureReason: outcome.error ?? "review failed" });
    return;
  }

  const verdict = parseReviewVerdict(outcome.text);
  fileReport({
    taskId: task.id,
    staffId: reviewer.id,
    title: `${task.title} — review round ${round}`,
    body: outcome.text.slice(-20_000),
  });

  if (verdict.verdict === "unknown") {
    // Never pass work on a reply we could not read — park it for a human call.
    updateTask(task.id, { reviewRound: round, reviewVerdict: "unclear" });
    postMessage({
      channel: "lobby",
      taskId: task.id,
      authorKind: "system",
      body: `Review of "${task.title}" came back without a readable verdict. It is waiting for your decision.`,
    });
    return;
  }

  if (verdict.verdict === "accept") {
    updateTask(task.id, { stage: "done", reviewRound: round, reviewVerdict: verdict.verdict });
    awardXp(reviewer.id, 6, true);
    bus.publish({ type: "task.finished", taskId: task.id, outcome: "done" });
    postMessage({
      channel: "lobby",
      taskId: task.id,
      authorKind: "staff",
      authorId: reviewer.id,
      body: `Accepted "${task.title}".${verdict.reasons ? ` ${verdict.reasons}` : ""}`,
    });
    return;
  }

  if (verdict.verdict === "reject" || round >= maxRounds) {
    updateTask(task.id, {
      stage: "blocked",
      reviewRound: round,
      reviewVerdict: verdict.verdict,
      failureReason: verdict.reasons || "rejected in review",
    });
    if (project && workspace.isolated && verdict.verdict === "reject") {
      // Keep the branch; the CEO decides whether to discard it.
      log.info(`review rejected ${task.id}; worktree kept at ${workspace.path}`);
    }
    bus.publish({ type: "task.finished", taskId: task.id, outcome: "failed" });
    return;
  }

  updateTask(task.id, { stage: "running", reviewRound: round, reviewVerdict: "revise" });
  enqueue(task.id, "work", [
    `Review round ${round} asked for changes: ${verdict.reasons}`,
    ...verdict.requiredChanges.map((change, index) => `Required change ${index + 1}: ${change}`),
  ]);
}

async function settlePlan(
  task: Task,
  coordinator: Staff,
  outcome: RunOutcome,
  pack: ReturnType<typeof getPack>,
): Promise<void> {
  if (!outcome.ok) {
    updateTask(task.id, { stage: "blocked", failureReason: outcome.error ?? "planning failed" });
    return;
  }
  const plan = parsePlanJson(outcome.text);
  const departments = listDepartments(pack.key);
  let created = 0;

  for (const raw of plan.subtasks.slice(0, 20)) {
    const title = String(raw.title ?? "").trim();
    if (!title) continue;
    const code = String(raw.department ?? "");
    const department = departments.find((entry) => entry.code === code);
    createTask({
      projectId: task.projectId,
      parentTaskId: task.id,
      title,
      brief: String(raw.brief ?? ""),
      acceptance: String(raw.acceptance ?? ""),
      priority: Number(raw.priority ?? 2),
      departmentId: department?.id ?? null,
      stage: "planning",
      requestedBy: coordinator.id,
    });
    created += 1;
  }

  updateTask(task.id, {
    stage: created ? "aligning" : "blocked",
    resultSummary: plan.planSummary,
    failureReason: created ? "" : "the coordinator returned no usable subtasks",
  });
  postMessage({
    channel: "lobby",
    taskId: task.id,
    authorKind: "staff",
    authorId: coordinator.id,
    body: `Planned "${task.title}" into ${created} work order(s). ${plan.planSummary}`.slice(0, 2000),
  });
}

export function mergeTask(taskId: string): string {
  const task = getTask(taskId);
  if (!task.projectId) throw badRequest("no_project", "the task is not attached to a project");
  const project = getProject(task.projectId);
  if (!task.branch) throw badRequest("no_branch", "the task has no isolated branch to merge");
  const sha = mergeWorkspace(project.rootPath, { path: task.workspacePath, branch: task.branch, isolated: true },
    project.baseBranch);
  updateTask(taskId, { resultSummary: `${task.resultSummary}\nMerged as ${sha}`.trim() });
  return sha;
}

export function discardTask(taskId: string): void {
  const task = getTask(taskId);
  if (!task.projectId || !task.branch) return;
  const project = getProject(task.projectId);
  discardWorkspace(project.rootPath, { path: task.workspacePath, branch: task.branch, isolated: true });
  updateTask(taskId, { workspacePath: "", branch: "" });
}

export function taskDiff(taskId: string): string {
  const task = getTask(taskId);
  if (!task.projectId || !task.workspacePath) return "";
  const project = getProject(task.projectId);
  return workspaceDiff(project.rootPath, {
    path: task.workspacePath,
    branch: task.branch,
    isolated: Boolean(task.branch),
  });
}
