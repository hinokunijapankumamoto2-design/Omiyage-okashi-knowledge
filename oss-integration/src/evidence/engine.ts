import type { Evidence, EvidenceBasis, EvidenceClass } from '../types.js';

/**
 * Evidence Engine.
 *
 * The rule this file exists to enforce: an evidence class is *derived* from
 * what was actually inspected. Nothing may declare itself VERIFIED.
 *
 * Priority (strongest first):
 *   executable test > source / reproducible example > official documentation
 *   > independent evidence > maintainer activity > README claim > popularity
 */
const BASIS_RANK: Record<EvidenceBasis, EvidenceClass> = {
  'executable-test': 'VERIFIED',
  'source-inspection': 'SUPPORTED',
  'reproducible-example': 'SUPPORTED',
  'official-documentation': 'SUPPORTED',
  'independent-evidence': 'INFERRED',
  'maintainer-activity': 'INFERRED',
  'readme-claim': 'CLAIMED',
  'social-popularity': 'UNKNOWN',
};

const CLASS_RANK: Record<EvidenceClass, number> = {
  VERIFIED: 4,
  SUPPORTED: 3,
  INFERRED: 2,
  CLAIMED: 1,
  UNKNOWN: 0,
};

export function classifyEvidence(basis: EvidenceBasis[], notes: string[] = []): Evidence {
  if (basis.length === 0) {
    return { class: 'UNKNOWN', basis: [], notes: [...notes, 'No inspected artifact was recorded.'] };
  }
  // Social popularity on its own can never lift a claim above UNKNOWN.
  const meaningful = basis.filter((b) => b !== 'social-popularity');
  if (meaningful.length === 0) {
    return {
      class: 'UNKNOWN',
      basis,
      notes: [...notes, 'Only popularity signals were available; popularity is not evidence.'],
    };
  }
  let best: EvidenceClass = 'UNKNOWN';
  for (const b of meaningful) {
    const cls = BASIS_RANK[b];
    if (CLASS_RANK[cls] > CLASS_RANK[best]) best = cls;
  }
  return { class: best, basis, notes };
}

export function evidenceRank(cls: EvidenceClass): number {
  return CLASS_RANK[cls];
}

export function meetsStandard(actual: EvidenceClass, required: EvidenceClass): boolean {
  return CLASS_RANK[actual] >= CLASS_RANK[required];
}

/** Confidence is a function of evidence, never a free-floating opinion. */
export function confidenceFromEvidence(cls: EvidenceClass): number {
  return { VERIFIED: 0.95, SUPPORTED: 0.75, INFERRED: 0.5, CLAIMED: 0.3, UNKNOWN: 0.1 }[cls];
}

export function weakest(a: Evidence, b: Evidence): Evidence {
  return CLASS_RANK[a.class] <= CLASS_RANK[b.class] ? a : b;
}
