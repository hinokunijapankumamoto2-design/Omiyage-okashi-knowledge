/**
 * CEO directives are the `$` mini-language typed into the chat box:
 *
 *   $task Add rate limiting -- brief text --accept "429 after 10 req/s" --dept build
 *   $run tsk_abc123
 *   $project my-app
 *   $meet kickoff Ship v2
 *   $assign tsk_abc123 stf_def456
 *   $stage tsk_abc123 review
 *
 * Parsing them here — rather than in a route — keeps the chat, the messenger
 * bridges and the API on one grammar.
 */
export interface Directive {
  verb: string;
  /** Positional text after the verb, flags removed. */
  text: string;
  flags: Record<string, string>;
  raw: string;
}

const FLAG_RE = /--([a-zA-Z][\w-]*)(?:[= ]("[^"]*"|'[^']*'|[^\s]+))?/g;

export function isDirective(input: string): boolean {
  return input.trimStart().startsWith("$");
}

export function parseDirective(input: string): Directive | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("$")) return null;

  const withoutSigil = trimmed.slice(1);
  const firstSpace = withoutSigil.search(/\s/);
  const verb = (firstSpace < 0 ? withoutSigil : withoutSigil.slice(0, firstSpace)).toLowerCase();
  const rest = firstSpace < 0 ? "" : withoutSigil.slice(firstSpace + 1);

  const flags: Record<string, string> = {};
  let match: RegExpExecArray | null;
  FLAG_RE.lastIndex = 0;
  while ((match = FLAG_RE.exec(rest))) {
    const value = (match[2] ?? "true").replace(/^["']|["']$/g, "");
    flags[match[1].toLowerCase()] = value;
  }
  const text = rest.replace(FLAG_RE, "").replace(/\s+/g, " ").trim();
  return { verb, text, flags, raw: trimmed };
}

export const DIRECTIVE_HELP: Array<{ verb: string; usage: string; description: string }> = [
  { verb: "task", usage: "$task <title> --brief <text> --accept <text> --dept <code> --prio 0-4", description: "File a new work order." },
  { verb: "plan", usage: "$plan <taskId>", description: "Have the coordinator decompose a task into subtasks." },
  { verb: "run", usage: "$run <taskId>", description: "Queue a task for execution." },
  { verb: "stop", usage: "$stop <taskId>", description: "Terminate the running process for a task." },
  { verb: "assign", usage: "$assign <taskId> <staffId>", description: "Assign a task to a specific member." },
  { verb: "stage", usage: "$stage <taskId> <stage>", description: "Move a task to another board column." },
  { verb: "project", usage: "$project <name or id>", description: "Set the active project for this channel." },
  { verb: "meet", usage: "$meet <kind> <topic> --task <taskId>", description: "Open a meeting." },
  { verb: "review", usage: "$review <taskId>", description: "Send a finished task to the reviewer." },
  { verb: "merge", usage: "$merge <taskId>", description: "Merge an accepted task's worktree back." },
  { verb: "discard", usage: "$discard <taskId>", description: "Throw away a task's worktree and branch." },
  { verb: "help", usage: "$help", description: "List directives." },
];
