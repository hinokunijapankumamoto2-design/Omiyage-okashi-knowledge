import { badRequest } from "../core/errors.js";
import { createTask, getTask, updateTask, type Stage } from "../domain/tasks.js";
import { listProjects, getProject } from "../domain/projects.js";
import { findDepartmentByCode } from "../domain/departments.js";
import { getPack } from "../domain/packs.js";
import { openMeeting } from "../domain/meetings.js";
import { postMessage } from "../domain/messages.js";
import { readSetting, writeSettings } from "../domain/settings.js";
import { DIRECTIVE_HELP, parseDirective, type Directive } from "./directives.js";
import { cancel, discardTask, enqueue, mergeTask } from "./dispatcher.js";

export interface DirectiveResult {
  ok: boolean;
  reply: string;
  taskId?: string;
}

function activePackKey(channel: string): string {
  const project = readSetting<string | null>(`channel.${channel}.projectId`, null);
  if (project) {
    try {
      return getProject(project).packKey;
    } catch {
      // fall through to the guild default
    }
  }
  return readSetting("guild.activePack", "software");
}

export function runDirective(input: string, channel = "lobby"): DirectiveResult {
  const directive = parseDirective(input);
  if (!directive) throw badRequest("not_a_directive", "directives start with $");

  switch (directive.verb) {
    case "help":
      return {
        ok: true,
        reply: DIRECTIVE_HELP.map((entry) => `${entry.usage}\n    ${entry.description}`).join("\n"),
      };
    case "task":
      return createFromDirective(directive, channel);
    case "plan":
      return queueDirective(directive, "plan");
    case "run":
      return queueDirective(directive, "work");
    case "review":
      return queueDirective(directive, "review");
    case "stop": {
      const taskId = requireId(directive);
      return { ok: cancel(taskId), reply: cancel(taskId) ? `stopping ${taskId}` : `nothing running for ${taskId}`, taskId };
    }
    case "assign": {
      const [taskId, staffId] = directive.text.split(/\s+/);
      if (!taskId || !staffId) throw badRequest("bad_args", "usage: $assign <taskId> <staffId>");
      updateTask(taskId, { assigneeId: staffId });
      return { ok: true, reply: `assigned ${taskId} to ${staffId}`, taskId };
    }
    case "stage": {
      const [taskId, stage] = directive.text.split(/\s+/);
      if (!taskId || !stage) throw badRequest("bad_args", "usage: $stage <taskId> <stage>");
      updateTask(taskId, { stage: stage as Stage });
      return { ok: true, reply: `moved ${taskId} to ${stage}`, taskId };
    }
    case "project": {
      const needle = directive.text.trim();
      const project =
        listProjects().find((entry) => entry.id === needle) ??
        listProjects().find((entry) => entry.name.toLowerCase() === needle.toLowerCase());
      if (!project) throw badRequest("unknown_project", `no project matching "${needle}"`);
      writeSettings({ [`channel.${channel}.projectId`]: project.id });
      return { ok: true, reply: `active project for #${channel} is now ${project.name} (${project.rootPath})` };
    }
    case "meet": {
      const [kind, ...rest] = directive.text.split(/\s+/);
      const topic = rest.join(" ") || "untitled";
      const meeting = openMeeting({
        topic,
        kind: (["kickoff", "standup", "review", "retro", "adhoc"].includes(kind) ? kind : "adhoc") as never,
        taskId: directive.flags.task ?? null,
      });
      return { ok: true, reply: `opened meeting ${meeting.id}: ${topic}` };
    }
    case "merge": {
      const taskId = requireId(directive);
      const sha = mergeTask(taskId);
      return { ok: true, reply: `merged ${taskId} as ${sha}`, taskId };
    }
    case "discard": {
      const taskId = requireId(directive);
      discardTask(taskId);
      return { ok: true, reply: `discarded the workspace for ${taskId}`, taskId };
    }
    default:
      throw badRequest("unknown_directive", `unknown directive "$${directive.verb}" — try $help`);
  }
}

function requireId(directive: Directive): string {
  const id = directive.text.split(/\s+/)[0];
  if (!id) throw badRequest("bad_args", `usage: $${directive.verb} <taskId>`);
  return id;
}

function queueDirective(directive: Directive, mode: "work" | "review" | "plan"): DirectiveResult {
  const taskId = requireId(directive);
  getTask(taskId);
  enqueue(taskId, mode);
  return { ok: true, reply: `queued ${mode} for ${taskId}`, taskId };
}

function createFromDirective(directive: Directive, channel: string): DirectiveResult {
  const title = directive.text.trim();
  if (!title) throw badRequest("bad_args", "usage: $task <title> [--brief ...] [--accept ...] [--dept code]");

  const projectId = directive.flags.project ?? readSetting<string | null>(`channel.${channel}.projectId`, null);
  const packKey = activePackKey(channel);
  const departmentCode = directive.flags.dept ?? getPack(packKey).coordinatorCode;
  const department = findDepartmentByCode(packKey, departmentCode);

  const task = createTask({
    projectId,
    title,
    brief: directive.flags.brief ?? "",
    acceptance: directive.flags.accept ?? "",
    priority: Number(directive.flags.prio ?? 2),
    departmentId: department?.id ?? null,
    stage: "planning",
  });

  postMessage({
    channel,
    taskId: task.id,
    authorKind: "system",
    body: `Work order ${task.id} filed: ${task.title}`,
    directive: directive.raw,
  });

  if (directive.flags.plan !== undefined) enqueue(task.id, "plan");
  else if (directive.flags.run !== undefined) enqueue(task.id, "work");

  return { ok: true, reply: `filed ${task.id}: ${task.title}`, taskId: task.id };
}
