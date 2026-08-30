import type {
  Capability,
  GateResult,
  GoalSpec,
  HealthAssessment,
  LicenseAssessment,
  RepositoryProfile,
  ScoutAxis,
  ScoutScore,
  SecurityAssessment,
} from '../types.js';
import { evidenceRank } from '../evidence/engine.js';

/**
 * Scout Score - 0..5, weighted per rule 14.
 *
 * Popularity is capped at 5% of the total and can never, by itself, lift a
 * candidate. Hard gates are reported alongside the score and a BLOCK wins
 * regardless of the number.
 */
export const WEIGHTS: Record<ScoutAxis, number> = {
  taskFit: 0.25,
  evidence: 0.2,
  maintenance: 0.1,
  architecture: 0.1,
  compatibility: 0.1,
  differentiation: 0.1,
  integrationValue: 0.1,
  popularity: 0.05,
};

export interface ScoreInput {
  goal: GoalSpec;
  repo: RepositoryProfile;
  capabilities: Capability[];
  license: LicenseAssessment;
  security: SecurityAssessment;
  health: HealthAssessment;
  /** How many other candidates also supply this repository's primary capability. */
  competitorCount: number;
  /** Capabilities this repository would unlock in combination with the rest of the stack. */
  unlocks: string[];
}

export function scoutScore(input: ScoreInput): ScoutScore {
  const { goal, repo, capabilities, license, security, health } = input;

  const required = new Set(goal.requiredCapabilities);
  const optional = new Set(goal.optionalCapabilities);
  const matchedRequired = capabilities.filter((c) => required.has(c.capabilityId)).length;
  const matchedOptional = capabilities.filter((c) => optional.has(c.capabilityId)).length;

  const taskFit =
    required.size === 0
      ? 0
      : clamp5(((matchedRequired + matchedOptional * 0.5) / Math.max(1, Math.min(required.size, 3))) * 5);

  const bestEvidence = capabilities.reduce((acc, c) => Math.max(acc, evidenceRank(c.evidence.class)), 0);
  const evidence = clamp5((bestEvidence / 4) * 5);

  const maintenance = health.score ?? 0;

  // Architecture is scored from observable structure, not from prose.
  let architecturePts = 0;
  let architecturePossible = 0;
  architecturePossible += 2;
  if (repo.tests === 'PRESENT') architecturePts += 2;
  else if (repo.tests === 'UNKNOWN') architecturePossible -= 2;
  architecturePossible += 1;
  if (repo.documentation === 'PRESENT') architecturePts += 1;
  else if (repo.documentation === 'UNKNOWN') architecturePossible -= 1;
  architecturePossible += 2;
  if (repo.architecture !== 'UNKNOWN') architecturePts += 2;
  else architecturePossible -= 2;
  const architecture = architecturePossible > 0 ? clamp5((architecturePts / architecturePossible) * 5) : 0;

  const runtimes = new Set(capabilities.flatMap((c) => c.compatibility.runtime));
  const compatibility =
    runtimes.size === 0
      ? 0
      : clamp5(
          5 -
            (license.status === 'REVIEW_REQUIRED' ? 2 : 0) -
            (security.status === 'REVIEW_REQUIRED' ? 1 : 0) -
            (runtimes.has('node') ? 0 : 1),
        );

  // Differentiation: how alone this candidate is in supplying its capability.
  const differentiation = clamp5(5 - Math.min(4, input.competitorCount));

  const integrationValue = clamp5(
    Math.min(5, capabilities.length + input.unlocks.length * 2 + (repo.kind === 'mcp-server' ? 1 : 0)),
  );

  // Popularity: honest zero when stars were never observed.
  const popularity = repo.stars === null ? 0 : clamp5(Math.log10(Math.max(1, repo.stars)) * 1.2);

  const raws: Record<ScoutAxis, { raw: number; why: string }> = {
    taskFit: {
      raw: taskFit,
      why: `${matchedRequired} required + ${matchedOptional} optional capability match(es) against the goal.`,
    },
    evidence: {
      raw: evidence,
      why: `Strongest capability evidence class present: ${
        capabilities.map((c) => c.evidence.class).sort()[0] ?? 'UNKNOWN'
      }.`,
    },
    maintenance: {
      raw: maintenance,
      why: health.score === null ? 'Not enough signal to score health; counted as 0, not assumed healthy.' : health.signals.join(' '),
    },
    architecture: {
      raw: architecture,
      why: architecturePossible > 0 ? `Scored from ${architecturePossible} observable structural signal(s).` : 'No structural signal observed.',
    },
    compatibility: {
      raw: compatibility,
      why: runtimes.size === 0 ? 'No runtime declared.' : `Runtimes: ${[...runtimes].join(', ')}.`,
    },
    differentiation: {
      raw: differentiation,
      why: `${input.competitorCount} other candidate(s) supply the same primary capability.`,
    },
    integrationValue: {
      raw: integrationValue,
      why: `${capabilities.length} capability/ies, unlocks: ${input.unlocks.join(', ') || 'none'}.`,
    },
    popularity: {
      raw: popularity,
      why: repo.stars === null ? 'Stars not observed. Popularity is capped at 5% weight regardless.' : `${repo.stars} stars.`,
    },
  };

  const breakdown = {} as ScoutScore['breakdown'];
  let total = 0;
  for (const axis of Object.keys(WEIGHTS) as ScoutAxis[]) {
    const weight = WEIGHTS[axis];
    const entry = raws[axis];
    const weighted = round2(entry.raw * weight);
    breakdown[axis] = { raw: round2(entry.raw), weight, weighted, why: entry.why };
    total += weighted;
  }

  const gates: GateResult[] = [
    { gate: 'LICENSE', status: license.status, reasons: license.reasons },
    { gate: 'SECURITY', status: security.status, reasons: security.reasons },
    {
      gate: 'SOURCE_INTEGRITY',
      status: repo.dataProvenance.length > 0 ? 'PASS' : 'UNKNOWN',
      reasons:
        repo.dataProvenance.length > 0
          ? [`Data provenance recorded: ${repo.dataProvenance.join('; ')}`]
          : ['No provenance recorded for the repository data itself.'],
    },
    {
      gate: 'REPRODUCIBILITY',
      status: repo.source === 'fixture' ? 'PASS' : repo.latestRelease === 'UNKNOWN' ? 'REVIEW_REQUIRED' : 'CONDITIONAL',
      reasons:
        repo.source === 'fixture'
          ? ['Pinned local fixture: this run is byte-for-byte reproducible.']
          : repo.latestRelease === 'UNKNOWN'
            ? ['No pinned version or commit observed, so a rerun may not analyse the same code.']
            : [`Pinned to ${repo.latestRelease}.`],
    },
  ];

  const blocked = gates.some((g) => g.status === 'BLOCK');
  return { total: round2(total), breakdown, gates, blocked };
}

function clamp5(n: number): number {
  return Math.max(0, Math.min(5, n));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
