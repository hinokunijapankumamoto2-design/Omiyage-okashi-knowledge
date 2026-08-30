import type { GoalSpec, TriState } from '../types.js';
import { goalArchetypes, loadTaxonomy } from '../capability/taxonomy.js';

/**
 * Goal Engine.
 *
 * Normalizes a natural-language goal into a GoalSpec. The hard rule here is
 * rule 6: anything the user did not state becomes UNKNOWN and is listed in
 * `unknowns`. We never invent a constraint, a licence stance, or a deadline.
 */

const ENV_PATTERNS: { pattern: RegExp; env: string }[] = [
  { pattern: /claude\s*code/i, env: 'Claude Code' },
  { pattern: /クロードコード/i, env: 'Claude Code' },
  { pattern: /\bcursor\b/i, env: 'Cursor' },
  { pattern: /\bvs\s*code\b|vscode/i, env: 'VS Code' },
  { pattern: /\bcli\b|コマンドライン/i, env: 'CLI' },
];

const COMMERCIAL_YES = /commercial|商用|業務利用|社内利用|クライアント向け/i;
const COMMERCIAL_NO = /non-?commercial|個人利用のみ|非商用/i;

/**
 * Constraints are only recorded when the user actually expressed one. The
 * patterns below match explicit statements, not vibes.
 */
const CONSTRAINT_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /オフライン|offline/i, label: 'Must work offline' },
  { pattern: /無料|free only|no paid/i, label: 'No paid dependencies' },
  { pattern: /mit\s*(license|ライセンス)?\s*(のみ|only)/i, label: 'MIT-licensed dependencies only' },
  { pattern: /node\s*\d+|node\.js\s*\d+/i, label: 'Pinned Node.js runtime stated in goal' },
  { pattern: /typescript|型安全/i, label: 'TypeScript / type-safety expected' },
];

export interface GoalInput {
  goal: string;
  repos?: string[];
  /** Only set when the user actually said so. */
  commercialUse?: TriState;
}

export function normalizeGoal(input: GoalInput): GoalSpec {
  const raw = input.goal.trim();
  const unknowns: string[] = [];

  const env = ENV_PATTERNS.find((p) => p.pattern.test(raw))?.env;
  if (!env) unknowns.push('TARGET ENVIRONMENT: not stated in the goal.');

  const { required, optional, derivedFrom } = decomposeCapabilities(raw);
  if (required.length === 0) {
    unknowns.push('REQUIRED CAPABILITIES: no capability vocabulary matched the goal text.');
  }

  const constraints = CONSTRAINT_PATTERNS.filter((c) => c.pattern.test(raw)).map((c) => c.label);
  if (constraints.length === 0) unknowns.push('CONSTRAINTS: none stated.');

  let commercial: TriState = input.commercialUse ?? 'UNKNOWN';
  if (commercial === 'UNKNOWN') {
    if (COMMERCIAL_NO.test(raw)) commercial = 'NO';
    else if (COMMERCIAL_YES.test(raw)) commercial = 'YES';
  }
  if (commercial === 'UNKNOWN') {
    unknowns.push('COMMERCIAL USE: not stated. Licence gate will assume nothing and stay conservative.');
  }

  const repos = input.repos ?? [];
  if (repos.length === 0) unknowns.push('USER-SUPPLIED OSS: none provided.');

  return {
    raw,
    goal: raw,
    targetEnvironment: env ?? 'UNKNOWN',
    requiredCapabilities: required,
    optionalCapabilities: optional,
    constraints,
    userSuppliedOss: repos,
    commercialUse: commercial,
    // v0.1 default, recorded in ASSUMPTIONS.md rather than silently applied.
    evidenceStandard: 'SUPPORTED',
    derivedFrom,
    unknowns,
  };
}

/**
 * Capability Decomposition (rule 7): the goal is broken into capability ids,
 * never into repository names.
 */
export function decomposeCapabilities(text: string): {
  required: string[];
  optional: string[];
  derivedFrom: { archetype: string; rationale: string }[];
} {
  const lower = text.toLowerCase();
  const required: string[] = [];
  for (const cap of loadTaxonomy().capabilities) {
    const hit = cap.aliases.some((a) => lower.includes(a.toLowerCase()));
    if (hit) required.push(cap.id);
  }

  // Goal archetypes. A literal keyword match cannot see that "a high-quality
  // web site" means design AND responsiveness AND accessibility AND
  // performance. Archetypes make that expansion explicit and data-driven: the
  // matched archetype and its rationale are recorded on the GoalSpec so the
  // user can see exactly what was added on their behalf, and reject it.
  const derivedFrom: { archetype: string; rationale: string }[] = [];
  const archetypeOptional: string[] = [];
  for (const arch of goalArchetypes()) {
    if (!arch.match.some((m) => lower.includes(m.toLowerCase()))) continue;
    derivedFrom.push({ archetype: arch.id, rationale: arch.rationale });
    for (const cap of arch.required) if (!required.includes(cap)) required.push(cap);
    for (const cap of arch.optional) if (!archetypeOptional.includes(cap)) archetypeOptional.push(cap);
  }

  // Closure: if a matched capability REQUIRES another, that prerequisite is
  // required too. This is derivation from the graph, not invention.
  const { relations } = loadTaxonomy();
  let grew = true;
  while (grew) {
    grew = false;
    for (const rel of relations) {
      if (rel.kind !== 'REQUIRES') continue;
      if (rel.from.some((f) => required.includes(f)) && !required.includes(rel.to)) {
        required.push(rel.to);
        grew = true;
      }
    }
  }

  // Capabilities that the graph says COMPLEMENT a required one are surfaced as
  // optional - useful, but not something the user asked for.
  const optional: string[] = [...archetypeOptional.filter((c) => !required.includes(c))];
  for (const rel of relations) {
    if (rel.kind !== 'COMPLEMENTS') continue;
    if (rel.from.some((f) => required.includes(f)) && !required.includes(rel.to) && !optional.includes(rel.to)) {
      optional.push(rel.to);
    }
  }

  return { required, optional, derivedFrom };
}

export function renderGoalSpec(spec: GoalSpec): string {
  const lines: string[] = [];
  lines.push('GOAL                 : ' + spec.goal);
  lines.push('TARGET ENVIRONMENT   : ' + spec.targetEnvironment);
  lines.push('REQUIRED CAPABILITIES: ' + (spec.requiredCapabilities.join(', ') || '(none matched)'));
  lines.push('OPTIONAL CAPABILITIES: ' + (spec.optionalCapabilities.join(', ') || '(none)'));
  lines.push('CONSTRAINTS          : ' + (spec.constraints.join('; ') || 'UNKNOWN'));
  lines.push('USER-SUPPLIED OSS    : ' + (spec.userSuppliedOss.join(', ') || 'UNKNOWN'));
  lines.push('COMMERCIAL USE       : ' + spec.commercialUse);
  lines.push('EVIDENCE STANDARD    : ' + spec.evidenceStandard);
  if (spec.derivedFrom.length > 0) {
    lines.push('EXPANDED BY ARCHETYPE:');
    for (const d of spec.derivedFrom) lines.push(`  - ${d.archetype}: ${d.rationale}`);
  }
  lines.push('UNKNOWN              :');
  for (const u of spec.unknowns) lines.push('  - ' + u);
  return lines.join('\n');
}
