import type { CapabilityDecision, CapabilityStack, StackEntry } from '../types.js';
import type { CandidateView } from '../compatibility/detector.js';
import { evidenceRank, meetsStandard } from '../evidence/engine.js';
import type { GateStatus } from '../types.js';

/**
 * How clean a gate result is. Consolidation may never move a capability onto a
 * source with a worse gate result than the one it already had: trading a clean
 * security gate for a degraded one to reduce the project count would be buying
 * tidiness with safety.
 */
const GATE_CLEANLINESS: Record<GateStatus, number> = {
  PASS: 4,
  CONDITIONAL: 3,
  UNKNOWN: 2,
  REVIEW_REQUIRED: 1,
  BLOCK: 0,
};

/**
 * Stack Optimizer.
 *
 * Selection picks the strongest source per capability in isolation. That is
 * the right call for one capability and the wrong call for a stack: it can end
 * up with five capabilities spread across five projects when three of them are
 * already available from a project the stack has committed to.
 *
 * This pass consolidates capabilities onto sources the stack already carries,
 * whenever the alternative source is not weaker than the goal's evidence
 * standard. Every consolidation is recorded as a decision with its reason -
 * nothing moves silently.
 */
export interface OptimizeResult {
  stack: CapabilityStack;
  consolidations: {
    capabilityId: string;
    from: string;
    to: string;
    reason: string;
  }[];
  sourceCountBefore: number;
  sourceCountAfter: number;
}

export function optimizeStack(stack: CapabilityStack, pool: CandidateView[]): OptimizeResult {
  const consolidations: OptimizeResult['consolidations'] = [];
  const entries: StackEntry[] = stack.entries.map((e) => ({ ...e }));
  const sourceCountBefore = distinctSources(entries);

  // Candidates that are usable at all: gates clean and evidence at or above the
  // goal's standard. A consolidation must never buy simplicity with evidence.
  const usable = pool.filter(
    (c) => !c.blocked && c.capability.confidence > 0 && meetsStandard(c.capability.evidence.class, stack.goal.evidenceStandard),
  );

  let changed = true;
  let guard = 0;
  while (changed && guard++ < 40) {
    changed = false;
    const counts = sourceUseCounts(entries);

    // Pass 1: a source carried for exactly one capability, where another source
    // already in the stack supplies that same capability at least as well.
    for (const entry of entries) {
      if (entry.origin === 'original') continue;
      const currentSource = entry.capability.sourceRepository;
      if ((counts.get(currentSource) ?? 0) !== 1) continue;

      const best = bestAlternative(usable, entry, currentSource, (id) => (counts.get(id) ?? 0) > 0);
      if (!best) continue;

      consolidations.push({
        capabilityId: entry.capabilityId,
        from: currentSource,
        to: best.repositoryId,
        reason: `${best.repositoryId} is already in the stack and supplies "${entry.capabilityId}" at evidence ${best.capability.evidence.class} (not weaker than ${entry.capability.evidence.class} from ${currentSource}). Consolidating removes one install source without weakening the claim.`,
      });
      applyMove(entry, currentSource, best);
      changed = true;
      break;
    }
    if (changed) continue;

    // Pass 2: drop a whole source when EVERY capability it supplies is also
    // available from other sources the stack is keeping anyway.
    //
    // Pass 1 alone cannot find this. It only ever considers sources carried for
    // a single capability, so a source supplying three capabilities survives
    // even when two other sources already in the stack cover all three between
    // them. That left real stacks carrying both a tool and a wrapper around it.
    const bySource = new Map<string, StackEntry[]>();
    for (const e of entries) {
      if (e.origin === 'original') continue;
      const list = bySource.get(e.capability.sourceRepository) ?? [];
      list.push(e);
      bySource.set(e.capability.sourceRepository, list);
    }

    // Try the source covering the fewest capabilities first: dropping it is the
    // least disruptive reassignment.
    const ordered = [...bySource.entries()].sort(
      (a, b) => a[1].length - b[1].length || a[0].localeCompare(b[0]),
    );

    for (const [candidateSource, owned] of ordered) {
      const survivors = new Set([...bySource.keys()].filter((id) => id !== candidateSource));
      const moves: { entry: StackEntry; to: CandidateView }[] = [];
      let coverable = true;
      for (const entry of owned) {
        const alt = bestAlternative(usable, entry, candidateSource, (id) => survivors.has(id));
        if (!alt) {
          coverable = false;
          break;
        }
        moves.push({ entry, to: alt });
      }
      if (!coverable) continue;

      for (const { entry, to } of moves) {
        consolidations.push({
          capabilityId: entry.capabilityId,
          from: candidateSource,
          to: to.repositoryId,
          reason: `Source elimination: every capability ${candidateSource} supplied is also available from sources the stack keeps anyway. "${entry.capabilityId}" moves to ${to.repositoryId} at evidence ${to.capability.evidence.class} (not weaker than ${entry.capability.evidence.class}), so the whole project drops out of the supply chain for free.`,
        });
        applyMove(entry, candidateSource, to);
      }
      changed = true;
      break;
    }
  }

  const decisions: CapabilityDecision[] = [...stack.decisions];
  for (const c of consolidations) {
    decisions.push({
      capabilityId: c.capabilityId,
      candidate: c.from,
      decision: 'REPLACE',
      reason: `Stack optimization. ${c.reason}`,
      replacedBy: c.to,
    });
  }

  return {
    stack: { ...stack, entries, decisions },
    consolidations,
    sourceCountBefore,
    sourceCountAfter: distinctSources(entries),
  };
}

/**
 * The strongest already-present alternative for a capability, or null when
 * moving would weaken the evidence. Tidiness never buys itself with evidence.
 */
function bestAlternative(
  usable: CandidateView[],
  entry: StackEntry,
  excludeSource: string,
  isPresent: (repositoryId: string) => boolean,
): CandidateView | null {
  const alternatives = usable
    .filter(
      (c) =>
        c.capability.capabilityId === entry.capabilityId &&
        c.repositoryId !== excludeSource &&
        isPresent(c.repositoryId),
    )
    .sort(
      (a, b) =>
        GATE_CLEANLINESS[b.capability.securityStatus] - GATE_CLEANLINESS[a.capability.securityStatus] ||
        evidenceRank(b.capability.evidence.class) - evidenceRank(a.capability.evidence.class) ||
        b.capability.confidence - a.capability.confidence ||
        a.repositoryId.localeCompare(b.repositoryId),
    );
  const best = alternatives[0];
  if (!best) return null;
  if (evidenceRank(best.capability.evidence.class) < evidenceRank(entry.capability.evidence.class)) return null;
  if (GATE_CLEANLINESS[best.capability.securityStatus] < GATE_CLEANLINESS[entry.capability.securityStatus]) {
    return null;
  }
  return best;
}

function applyMove(entry: StackEntry, from: string, to: CandidateView): void {
  entry.capability = to.capability;
  entry.rejectedAlternatives = [
    ...entry.rejectedAlternatives.filter((r) => r.candidate !== to.repositoryId),
    { candidate: from, reason: 'Dropped by the stack optimizer; its capabilities were covered by sources the stack keeps anyway.' },
  ];
}

function distinctSources(entries: StackEntry[]): number {
  return new Set(entries.filter((e) => e.origin !== 'original').map((e) => e.capability.sourceRepository)).size;
}

function sourceUseCounts(entries: StackEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.origin === 'original') continue;
    const s = e.capability.sourceRepository;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return counts;
}
