import type { GuildPack } from "../domain/packs.js";
import type { Task } from "../domain/tasks.js";
import type { Staff } from "../domain/staff.js";
import type { Project } from "../domain/projects.js";
import { skillsForStaff } from "../domain/skills.js";

interface PromptParts {
  pack: GuildPack;
  task: Task;
  staff: Staff;
  project?: Project;
  workspacePath: string;
  /** Extra context threaded in by the CEO or a previous round. */
  notes?: string[];
}

function section(title: string, lines: Array<string | undefined>): string {
  const kept = lines.filter((line): line is string => Boolean(line && line.trim()));
  if (!kept.length) return "";
  return [`## ${title}`, "", ...kept, ""].join("\n");
}

function bullets(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

/**
 * The whole prompt is assembled here so that every runner — CLI or HTTP — is
 * given exactly the same instructions, and so a single place governs what an
 * agent is told it may do.
 */
export function buildWorkerPrompt(parts: PromptParts): string {
  const { pack, task, staff, project, workspacePath } = parts;
  const skills = skillsForStaff(staff.id);

  return [
    `You are ${staff.displayName}, a ${staff.seniority} in the ${pack.nameEn}.`,
    staff.temperament ? `Working style: ${staff.temperament}` : "",
    "",
    section("Assignment", [`**${task.title}**`, "", task.brief]),
    section("Acceptance criteria", [
      task.acceptance || "_None stated — infer the minimum verifiable outcome and state your assumption._",
    ]),
    section("Workspace", [
      `Absolute path: \`${workspacePath}\``,
      project ? `Project: ${project.name}${project.objective ? ` — ${project.objective}` : ""}` : "",
      "Everything you create or modify must live under that path.",
    ]),
    section("House rules", [bullets(pack.executionRules)]),
    skills.length
      ? section(
          "Active skills",
          skills.map((skill) => `### ${skill.name}\n${skill.body.split("\n").slice(2).join("\n").trim()}`),
        )
      : "",
    parts.notes?.length ? section("Additional context", [bullets(parts.notes)]) : "",
    section("Expected deliverable", [pack.deliverable]),
    section("Report format", [
      "End your response with a block in exactly this shape so the office can parse it:",
      "",
      "```",
      "GUILD-REPORT",
      "status: done | blocked",
      "summary: <one or two sentences>",
      "changed: <comma separated paths, or none>",
      "verified: <the command or check you ran, or none>",
      "blocker: <only when status is blocked>",
      "```",
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildReviewPrompt(parts: {
  pack: GuildPack;
  task: Task;
  reviewer: Staff;
  workerReport: string;
  diff: string;
  round: number;
}): string {
  const { pack, task, reviewer, workerReport, diff, round } = parts;
  return [
    `You are ${reviewer.displayName}, reviewing work for the ${pack.nameEn}. This is review round ${round}.`,
    "",
    section("Task", [`**${task.title}**`, "", task.brief]),
    section("Acceptance criteria", [task.acceptance || "_none stated_"]),
    section("What the worker reported", ["```", workerReport.slice(0, 12_000), "```"]),
    diff ? section("Diff under review", ["```diff", diff.slice(0, 20_000), "```"]) : "",
    section("Checklist", [bullets(pack.reviewChecklist)]),
    section("Verdict format", [
      "Answer with this block and nothing after it:",
      "",
      "```",
      "GUILD-REVIEW",
      "verdict: accept | revise | reject",
      "reasons: <one line per finding>",
      "required_changes: <numbered list, only when verdict is revise>",
      "```",
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPlanningPrompt(parts: {
  pack: GuildPack;
  task: Task;
  coordinator: Staff;
  departments: Array<{ code: string; nameEn: string; mission: string }>;
}): string {
  const { pack, task, coordinator, departments } = parts;
  return [
    `You are ${coordinator.displayName}, planning lead of the ${pack.nameEn}.`,
    "Break the CEO's request into work orders that a single agent can finish in one focused run.",
    "",
    section("Request", [`**${task.title}**`, "", task.brief]),
    section("Acceptance criteria", [task.acceptance || "_none stated — propose some_"]),
    section("Departments you may assign to", [
      bullets(departments.map((department) => `\`${department.code}\` — ${department.nameEn}: ${department.mission}`)),
    ]),
    section("Routing order", [pack.pipeline.join(" → ")]),
    section("Output format", [
      "Reply with a single JSON object and nothing else:",
      "",
      "```json",
      JSON.stringify(
        {
          plan_summary: "one paragraph",
          subtasks: [
            {
              title: "short imperative title",
              brief: "what to do and why",
              acceptance: "how a reviewer decides this is done",
              department: departments[0]?.code ?? "strategy",
              priority: 2,
            },
          ],
        },
        null,
        2,
      ),
      "```",
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}
