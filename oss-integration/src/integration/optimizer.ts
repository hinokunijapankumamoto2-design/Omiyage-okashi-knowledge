import type { CapabilityDecision, CapabilityStack, StackEntry } from '../types.js';
import type { CandidateView } from '../compatibility/detector.js';
import { evidenceRank, meetsStandard } from '../evidence/engine.js';

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
  while (changed && guard++ < 20) {
    changed = false;
    const counts = sourceUseCounts(entries);

    for (const entry of entries) {
      if (entry.origin === 'original') continue;
      const currentSource = entry.capability.sourceRepository;
      // Only worth moving when this source exists in the stack solely for this
      // one capability; otherwise consolidating saves no install.
      if ((counts.get(currentSource) ?? 0) !== 1) continue;

      const alternatives = usable.filter(
        (c) =>
          c.capability.capabilityId === entry.capabilityId &&
          c.repositoryId !== currentSource &&
          (counts.get(c.repositoryId) ?? 0) > 0,
      );
      if (alternatives.length === 0) continue;

      // Prefer the already-present source with the strongest evidence.
      const best = alternatives.sort(
        (a, b) =>
          evidenceRank(b.capability.evidence.class) - evidenceRank(a.capability.evidence.class) ||
          b.capability.confidence - a.capability.confidence ||
          a.repositoryId.localeCompare(b.repositoryId),
      )[0];
      if (!best) continue;

      // Never trade evidence away for tidiness.
      if (evidenceRank(best.capability.evidence.class) < evidenceRank(entry.capability.evidence.class)) continue;

      consolidations.push({
        capabilityId: entry.capabilityId,
        from: currentSource,
        to: best.repositoryId,
        reason: `${best.repositoryId} is already in the stack and supplies "${entry.capabilityId}" at evidence ${best.capability.evidence.class} (not weaker than ${entry.capability.evidence.class} from ${currentSource}). Consolidating removes one install source without weakening the claim.`,
      });
      entry.capability = best.capability;
      entry.rejectedAlternatives = [
        ...entry.rejectedAlternatives.filter((r) => r.candidate !== best.repositoryId),
        { candidate: currentSource, reason: 'Dropped by the stack optimizer: it was carried for this capability alone.' },
      ];
      changed = true;
      break; // recompute counts before the next move
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
