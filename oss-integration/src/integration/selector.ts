import type {
  CapabilityDecision,
  CapabilityStack,
  Conflict,
  DuplicateGroup,
  GapReport,
  GoalSpec,
  StackEntry,
} from '../types.js';
import type { CandidateView } from '../compatibility/detector.js';
import { meetsStandard } from '../evidence/engine.js';
import { capabilityById, capabilityName } from '../capability/taxonomy.js';
import { CapabilityGraph } from '../graph/capability-graph.js';

/** Capabilities whose combination unlocks `capabilityId`, per the graph. */
function graphContributors(capabilityId: string): string[] {
  return new CapabilityGraph()
    .of('UNLOCKS')
    .filter((r) => r.to === capabilityId)
    .flatMap((r) => r.from);
}

/**
 * Capability Selector.
 *
 * Decides KEEP / REPLACE / ADD / REMOVE / WATCH / REJECT / UNKNOWN for every
 * candidate, and assembles the Best Capability Stack. Every decision carries a
 * reason (rule 19).
 */

export interface SelectionInput {
  goal: GoalSpec;
  /** Candidates derived from repositories the user supplied. */
  supplied: CandidateView[];
  /** Candidates found by the discovery engine to close a gap. */
  discovered: CandidateView[];
  duplicates: DuplicateGroup[];
  conflicts: Conflict[];
  gaps: GapReport;
}

export function selectStack(input: SelectionInput): CapabilityStack {
  const { goal, supplied, discovered, duplicates, conflicts, gaps } = input;
  const suppliedIds = new Set(supplied.map((c) => c.repositoryId));
  const winnerByCapability = new Map(duplicates.map((d) => [d.capabilityId, d.winner]));

  const decisions: CapabilityDecision[] = [];
  const rejected: CapabilityStack['rejected'] = [];
  const entries: StackEntry[] = [];
  const all = [...supplied, ...discovered];
  const required = new Set(goal.requiredCapabilities);
  const optional = new Set(goal.optionalCapabilities);

  // Index of usable alternatives per capability, used to justify REPLACE.
  const usableByCapability = new Map<string, CandidateView[]>();
  for (const c of all) {
    if (c.blocked) continue;
    const list = usableByCapability.get(c.capability.capabilityId) ?? [];
    list.push(c);
    usableByCapability.set(c.capability.capabilityId, list);
  }

  const takenCapabilities = new Set<string>();

  for (const cand of all) {
    const capId = cand.capability.capabilityId;
    const fromUser = suppliedIds.has(cand.repositoryId);
    const wanted = required.has(capId) || optional.has(capId);

    // 1. Hard gates beat everything.
    if (cand.blocked) {
      const replacement = (usableByCapability.get(capId) ?? []).find((c) => c.repositoryId !== cand.repositoryId);
      if (replacement) {
        decisions.push({
          capabilityId: capId,
          candidate: cand.repositoryId,
          decision: 'REPLACE',
          reason: `Hard gate BLOCK on ${cand.repositoryId} (licence: ${cand.capability.licenseStatus}, security: ${cand.capability.securityStatus}). A gated-clean source supplies the same capability.`,
          replacedBy: replacement.repositoryId,
        });
      } else {
        decisions.push({
          capabilityId: capId,
          candidate: cand.repositoryId,
          decision: 'REJECT',
          reason: `Hard gate BLOCK (licence: ${cand.capability.licenseStatus}, security: ${cand.capability.securityStatus}). A BLOCK outranks any score, and no clean alternative was found.`,
        });
      }
      rejected.push({
        capabilityId: capId,
        candidate: cand.repositoryId,
        reason: `licence=${cand.capability.licenseStatus}, security=${cand.capability.securityStatus}`,
      });
      continue;
    }

    // 2. Capability the goal never asked for.
    if (!wanted) {
      decisions.push({
        capabilityId: capId,
        candidate: cand.repositoryId,
        decision: 'REMOVE',
        reason: `"${capId}" is outside the goal's required and optional capability set. Carrying it would be bundling, not integration.`,
      });
      continue;
    }

    // 3. Duplicate resolution.
    const winner = winnerByCapability.get(capId);
    if (winner && winner !== cand.repositoryId) {
      decisions.push({
        capabilityId: capId,
        candidate: cand.repositoryId,
        decision: 'REMOVE',
        reason: `Duplicate of "${capId}"; ${winner} won the comparison. Only one implementation per capability enters the stack.`,
        replacedBy: winner,
      });
      continue;
    }

    // 4. Evidence floor.
    if (!meetsStandard(cand.capability.evidence.class, goal.evidenceStandard)) {
      decisions.push({
        capabilityId: capId,
        candidate: cand.repositoryId,
        decision: 'WATCH',
        reason: `Evidence is ${cand.capability.evidence.class}, below the goal's ${goal.evidenceStandard} standard. Kept on the watch list rather than promoted on optimism.`,
      });
      continue;
    }

    if (takenCapabilities.has(capId)) {
      decisions.push({
        capabilityId: capId,
        candidate: cand.repositoryId,
        decision: 'REMOVE',
        reason: `"${capId}" is already supplied by a selected source.`,
      });
      continue;
    }

    // 5. Selected.
    takenCapabilities.add(capId);
    const dup = duplicates.find((d) => d.capabilityId === capId);
    entries.push({
      capabilityId: capId,
      capability: cand.capability,
      origin: fromUser ? 'user-supplied' : 'discovered',
      selectionAxis: dup?.axis ?? 'BEST_EVIDENCE',
      rejectedAlternatives: (usableByCapability.get(capId) ?? [])
        .filter((c) => c.repositoryId !== cand.repositoryId)
        .map((c) => ({
          candidate: c.repositoryId,
          reason: dup?.reason ?? `Lost to ${cand.repositoryId} on ${dup?.axis ?? 'evidence'}.`,
        })),
    });
    decisions.push({
      capabilityId: capId,
      candidate: cand.repositoryId,
      decision: fromUser ? 'KEEP' : 'ADD',
      reason: fromUser
        ? `Supplied by the user, passes the gates, and is the strongest source for "${capId}" (${dup?.axis ?? 'sole candidate'}).`
        : `Added by discovery to close the "${capId}" gap; ${dup?.reason ?? 'sole gated-clean candidate found'}.`,
    });
  }

  // Capabilities no single source supplies, but which the combination already
  // selected unlocks. These are delivered by the plugin itself - that is what
  // integrating is for - so they enter the stack as original contributions
  // rather than being shopped for.
  for (const capId of gaps.coveredByUnlock) {
    if (takenCapabilities.has(capId)) continue;
    const contributors = entries
      .filter((e) => graphContributors(capId).includes(e.capabilityId))
      .map((e) => e.capability.sourceRepository);
    takenCapabilities.add(capId);
    entries.push({
      capabilityId: capId,
      capability: {
        capabilityId: capId,
        name: capabilityName(capId),
        description: capabilityById(capId)?.description ?? capId,
        category: capabilityById(capId)?.category ?? 'unknown',
        sourceRepository: '(combination)',
        sourceVersion: 'UNKNOWN',
        sourceCommit: 'UNKNOWN',
        evidence: {
          class: 'INFERRED',
          basis: ['source-inspection'],
          notes: [
            `Not supplied by any single source. The capability graph says it is unlocked by the combination already selected (${contributors.join(', ') || 'selected stack'}). Class is INFERRED because the combination was reasoned about, not executed.`,
          ],
        },
        strength: ['Emerges from the integration itself, so it costs no additional install source.'],
        limitations: [
          'Unlocked by combination rather than supplied by a verified implementation. It cannot report VERIFIED until it is executed.',
        ],
        dependencies: [],
        compatibility: { runtime: [], conflictsWith: [], notes: ['Delivered by this plugin’s own orchestration.'] },
        licenseStatus: 'REUSE_OK',
        securityStatus: 'PASS',
        confidence: 0.5,
      },
      origin: 'original',
      selectionAxis: 'ORIGINAL',
      rejectedAlternatives: [],
    });
    decisions.push({
      capabilityId: capId,
      candidate: '(combination)',
      decision: 'ADD',
      reason: `Unlocked by the selected combination (${contributors.join(' + ') || 'selected stack'}). Adding another repository for it would be buying something the stack already produces.`,
    });
  }

  // Capabilities the goal needs that nothing supplied.
  for (const missing of gaps.missing) {
    if (takenCapabilities.has(missing)) continue;
    decisions.push({
      capabilityId: missing,
      candidate: '(none found)',
      decision: 'UNKNOWN',
      reason: `Required capability "${missing}" has no candidate in the seed registry or the supplied repositories. Recorded as UNKNOWN rather than substituted with something adjacent.`,
    });
  }

  return { goal, entries, decisions, duplicates, conflicts, gaps, rejected };
}
