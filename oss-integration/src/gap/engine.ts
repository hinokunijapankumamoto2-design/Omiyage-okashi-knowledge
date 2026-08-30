import type { GapReport } from '../types.js';
import { CapabilityGraph } from '../graph/capability-graph.js';

/**
 * Gap Engine: REQUIRED - CURRENT = MISSING, plus unlock accounting.
 *
 * `current` must only contain capabilities that survived the hard gates. A
 * capability whose source was BLOCKed does not count as held.
 *
 * A required capability that no single source supplies is not automatically a
 * gap: the graph may say the combination already held UNLOCKS it. Those are
 * reported separately as `coveredByUnlock`, because closing them by shopping
 * for another repository would be the wrong move - they are the payoff of
 * integrating what is already there.
 */
export function computeGap(required: string[], current: string[], graph = new CapabilityGraph()): GapReport {
  const requiredClosed = graph.prerequisiteClosure(required);
  const held = new Set(current);
  const unlocked = new Set(graph.unlocked(current));

  const missing: string[] = [];
  const coveredByUnlock: string[] = [];
  for (const r of requiredClosed) {
    if (held.has(r)) continue;
    if (unlocked.has(r)) coveredByUnlock.push(r);
    else missing.push(r);
  }

  return {
    required: requiredClosed,
    current: [...held],
    missing,
    coveredByUnlock,
    nearMisses: graph.nearMisses(current),
  };
}
