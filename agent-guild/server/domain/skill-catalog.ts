/**
 * Built-in skill catalogue. A "skill" here is a short operating instruction that
 * gets folded into a worker's prompt when the assigned staff member has learned
 * it — deliberately small and text-only so operators can read, edit or replace
 * any of them, and so custom uploads use exactly the same shape.
 */
export interface SkillSeed {
  slug: string;
  name: string;
  category: string;
  summary: string;
  body: string;
}

interface SkillSpec {
  slug: string;
  name: string;
  summary: string;
  /** Concrete rules the agent must follow when this skill is active. */
  rules: string[];
}

function expand(category: string, specs: SkillSpec[]): SkillSeed[] {
  return specs.map((spec) => ({
    slug: spec.slug,
    name: spec.name,
    category,
    summary: spec.summary,
    body: [`# ${spec.name}`, "", spec.summary, "", "## Rules", ...spec.rules.map((rule) => `- ${rule}`)].join("\n"),
  }));
}

const ENGINEERING = expand("engineering", [
  {
    slug: "scoped-diff",
    name: "Scoped Diff",
    summary: "Keep a change limited to what the acceptance criteria require.",
    rules: [
      "List the files you intend to touch before editing, and stop if the list grows.",
      "Do not reformat, rename or reorganise code that the task did not ask about.",
      "If a fix needs a wider change, report it as a follow-up instead of doing it.",
    ],
  },
  {
    slug: "reproduce-first",
    name: "Reproduce First",
    summary: "Never fix a defect you have not first observed.",
    rules: [
      "Write or run the smallest command that shows the failure, and record its output.",
      "Only then change code; re-run the same command to prove the failure is gone.",
      "If you cannot reproduce it, say so and report what you tried.",
    ],
  },
  {
    slug: "test-with-the-change",
    name: "Test With The Change",
    summary: "Every behavioural change arrives with a check that would have caught it.",
    rules: [
      "Add or extend a test that fails before your change and passes after it.",
      "Never delete, skip or weaken an existing test to reach green.",
      "Report the exact command a reviewer can run to see it pass.",
    ],
  },
  {
    slug: "error-paths",
    name: "Error Paths",
    summary: "Handle the unhappy path explicitly.",
    rules: [
      "For every new external call, decide what happens on failure and on timeout.",
      "Never swallow an error without either handling or surfacing it.",
      "Prefer a precise error message naming the input that failed.",
    ],
  },
  {
    slug: "dependency-restraint",
    name: "Dependency Restraint",
    summary: "Adding a dependency is a decision, not a shortcut.",
    rules: [
      "Do not add a package without stating the problem it solves and its licence.",
      "Reject any dependency that is not permissively licensed for commercial use.",
      "Prefer the platform standard library when it covers the need.",
    ],
  },
  {
    slug: "migration-safety",
    name: "Migration Safety",
    summary: "Schema and data changes must be reversible and additive first.",
    rules: [
      "Add new columns as nullable or defaulted; never rewrite existing rows in place without a backup path.",
      "Ship the read path for both shapes before removing the old one.",
      "State explicitly how to roll the migration back.",
    ],
  },
]);

const DESIGN = expand("design", [
  {
    slug: "state-coverage",
    name: "State Coverage",
    summary: "Design every state, not just the populated one.",
    rules: [
      "Specify empty, loading, error, partial and over-full states for each view.",
      "Give each state a concrete copy string, not a placeholder.",
    ],
  },
  {
    slug: "contrast-discipline",
    name: "Contrast Discipline",
    summary: "Readable in both themes, at real sizes.",
    rules: [
      "Body text holds at least 4.5:1 contrast against its background in both light and dark.",
      "Never encode meaning in hue alone; pair it with a shape, weight or label.",
    ],
  },
  {
    slug: "layout-budget",
    name: "Layout Budget",
    summary: "Fix the spacing scale before placing anything.",
    rules: [
      "Use one spacing scale throughout; no arbitrary one-off pixel values.",
      "Wide content scrolls inside its own container rather than widening the page.",
    ],
  },
]);

const QUALITY = expand("quality", [
  {
    slug: "acceptance-literalism",
    name: "Acceptance Literalism",
    summary: "Judge the work against the written criteria, word by word.",
    rules: [
      "Quote each acceptance criterion and mark it met, unmet, or not verifiable.",
      "Do not pass a criterion on intent; pass it on observed behaviour.",
    ],
  },
  {
    slug: "regression-sweep",
    name: "Regression Sweep",
    summary: "Look for what the change might have broken nearby.",
    rules: [
      "Identify callers of every changed function and check their assumptions still hold.",
      "Re-run the full check suite, not only the tests the author added.",
    ],
  },
  {
    slug: "failure-narrative",
    name: "Failure Narrative",
    summary: "A rejection must be actionable.",
    rules: [
      "State the input, the expected result and the observed result for every rejection.",
      "Point at the specific file and line where the behaviour originates.",
    ],
  },
]);

const RESEARCH = expand("research", [
  {
    slug: "citation-trail",
    name: "Citation Trail",
    summary: "Every claim carries its source.",
    rules: [
      "Attach a retrievable source to each factual statement as you write it.",
      "Mark inference as inference and separate it from what a source states.",
      "Record the date you consulted a source that can change.",
    ],
  },
  {
    slug: "conflict-surfacing",
    name: "Conflict Surfacing",
    summary: "Disagreeing sources are a finding, not noise.",
    rules: [
      "When sources conflict, present both and say which you weighted and why.",
      "Never average conflicting numbers into a single unattributed figure.",
    ],
  },
  {
    slug: "confidence-labels",
    name: "Confidence Labels",
    summary: "State how sure you are, and why.",
    rules: [
      "Label each finding high, medium or low confidence with a one-line reason.",
      "Low-confidence findings must name what evidence would raise them.",
    ],
  },
]);

const WRITING = expand("writing", [
  {
    slug: "outline-fidelity",
    name: "Outline Fidelity",
    summary: "Write the agreed structure, not a new one.",
    rules: [
      "Keep every heading from the approved outline, in order.",
      "If a section turns out to be wrong, flag it rather than silently dropping it.",
    ],
  },
  {
    slug: "register-lock",
    name: "Register Lock",
    summary: "One voice across the whole document.",
    rules: [
      "Fix the audience, formality and person at the start and hold them.",
      "Match the brief's language; do not mix languages inside a section.",
    ],
  },
  {
    slug: "claim-density",
    name: "Claim Density",
    summary: "Cut sentences that assert nothing.",
    rules: [
      "Delete filler that restates the heading.",
      "Prefer a concrete number or example over an adjective.",
    ],
  },
]);

const PLATFORM = expand("platform", [
  {
    slug: "secret-hygiene",
    name: "Secret Hygiene",
    summary: "Credentials never reach logs, prompts or the repository.",
    rules: [
      "Read secrets from the environment or the credential store; never inline them.",
      "Redact token-shaped strings before writing anything to a log or a report.",
      "Never commit a file matched by the repository's ignore rules for secrets.",
    ],
  },
  {
    slug: "workspace-boundary",
    name: "Workspace Boundary",
    summary: "Stay inside the sandbox you were handed.",
    rules: [
      "Resolve every path and refuse anything outside the assigned workspace root.",
      "Do not install global tooling or modify the operator's machine state.",
    ],
  },
  {
    slug: "reproducible-run",
    name: "Reproducible Run",
    summary: "Someone else must be able to re-run what you ran.",
    rules: [
      "Record the exact commands and their working directory in your report.",
      "Pin versions when you introduce a build step.",
    ],
  },
]);

const COORDINATION = expand("coordination", [
  {
    slug: "work-order-shape",
    name: "Work Order Shape",
    summary: "A task is not ready until it can be judged.",
    rules: [
      "Every delegated task carries a title, a brief, and acceptance criteria that are checkable.",
      "Name the single department accountable for the outcome.",
      "Split anything that cannot be finished in one focused run.",
    ],
  },
  {
    slug: "blocker-escalation",
    name: "Blocker Escalation",
    summary: "Surface an obstacle early instead of burning a run on it.",
    rules: [
      "Stop after the second failed approach and report what you tried.",
      "State precisely what decision or access you need to continue.",
    ],
  },
  {
    slug: "handoff-note",
    name: "Handoff Note",
    summary: "The next agent should not have to reconstruct your context.",
    rules: [
      "Summarise what is done, what is left, and what you deliberately did not touch.",
      "Link to the artefacts you produced by path.",
    ],
  },
]);

export const BUILTIN_SKILLS: SkillSeed[] = [
  ...ENGINEERING,
  ...DESIGN,
  ...QUALITY,
  ...RESEARCH,
  ...WRITING,
  ...PLATFORM,
  ...COORDINATION,
];

export const SKILL_CATEGORIES = Array.from(new Set(BUILTIN_SKILLS.map((skill) => skill.category)));
