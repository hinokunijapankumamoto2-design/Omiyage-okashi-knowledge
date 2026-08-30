import type { Evidence, GateStatus, LicenseAssessment, ReusePolicy, TriState } from '../types.js';
import { classifyEvidence } from '../evidence/engine.js';

/**
 * License Gate.
 *
 * Rule 16: "public on GitHub" is never treated as permission. A licence that
 * was not observed is UNKNOWN, and UNKNOWN never permits copying code.
 */

interface LicenseRule {
  policy: ReusePolicy;
  status: GateStatus;
  conditions: string[];
  note: string;
}

const RULES: Record<string, LicenseRule> = {
  'MIT': {
    policy: 'REUSE_WITH_CONDITIONS',
    status: 'PASS',
    conditions: ['Retain copyright notice and licence text with any copied code.'],
    note: 'Permissive.',
  },
  'Apache-2.0': {
    policy: 'REUSE_WITH_CONDITIONS',
    status: 'PASS',
    conditions: [
      'Retain copyright, licence and NOTICE file.',
      'State significant changes made to copied files.',
    ],
    note: 'Permissive with attribution and patent grant.',
  },
  'BSD-3-Clause': {
    policy: 'REUSE_WITH_CONDITIONS',
    status: 'PASS',
    conditions: ['Retain copyright notice.', 'Do not use contributor names to endorse.'],
    note: 'Permissive.',
  },
  'BSD-2-Clause': {
    policy: 'REUSE_WITH_CONDITIONS',
    status: 'PASS',
    conditions: ['Retain copyright notice.'],
    note: 'Permissive.',
  },
  'ISC': {
    policy: 'REUSE_WITH_CONDITIONS',
    status: 'PASS',
    conditions: ['Retain copyright notice.'],
    note: 'Permissive.',
  },
  'MPL-2.0': {
    policy: 'REUSE_WITH_CONDITIONS',
    status: 'CONDITIONAL',
    conditions: [
      'File-level copyleft: any copied or modified file stays MPL-2.0 and its source must be offered.',
      'Keeping the dependency at arm’s length (invoke, do not vendor) avoids the obligation entirely.',
    ],
    note: 'Weak copyleft at file granularity.',
  },
  'LGPL-3.0-only': {
    policy: 'LEGAL_REVIEW',
    status: 'REVIEW_REQUIRED',
    conditions: [
      'Linking obligations apply; relinking rights must be preserved for recipients.',
      'Bundling into a distributed plugin needs a human legal decision.',
    ],
    note: 'Copyleft with linking obligations.',
  },
  'LGPL-3.0-or-later': {
    policy: 'LEGAL_REVIEW',
    status: 'REVIEW_REQUIRED',
    conditions: ['Linking obligations apply.', 'Bundling needs a human legal decision.'],
    note: 'Copyleft with linking obligations.',
  },
  'GPL-3.0-only': {
    policy: 'LEGAL_REVIEW',
    status: 'REVIEW_REQUIRED',
    conditions: ['Strong copyleft: the combined work would have to be GPL-3.0.'],
    note: 'Strong copyleft.',
  },
  'AGPL-3.0-only': {
    policy: 'LEGAL_REVIEW',
    status: 'REVIEW_REQUIRED',
    conditions: ['Network-use copyleft: even hosted use triggers source obligations.'],
    note: 'Strong network copyleft.',
  },
  'NOASSERTION': {
    policy: 'BLOCK',
    status: 'BLOCK',
    conditions: [],
    note: 'A licence file exists but no recognised licence could be asserted.',
  },
  'NONE': {
    policy: 'BLOCK',
    status: 'BLOCK',
    conditions: [],
    note: 'No licence granted. Default copyright applies: no reuse rights.',
  },
};

export interface LicenseGateInput {
  spdx: string | 'UNKNOWN';
  evidence: Evidence;
  commercialUse: TriState;
  /** Set when project policy forbids reuse regardless of licence. */
  policyReferenceOnly?: boolean;
}

export function assessLicense(input: LicenseGateInput): LicenseAssessment {
  const reasons: string[] = [];
  const spdx = input.spdx;

  if (spdx === 'UNKNOWN') {
    return {
      spdx: 'UNKNOWN',
      evidence: input.evidence,
      policy: 'REFERENCE_ONLY',
      status: 'UNKNOWN',
      conditions: [
        'No licence was observed. Do not copy code.',
        'Public specifications, ideas, general method and architecture concepts may be referenced and independently implemented.',
      ],
      reasons: [
        'No licence observed for this repository. "Public on GitHub" does not grant reuse rights.',
      ],
    };
  }

  const rule = RULES[spdx];
  if (!rule) {
    return {
      spdx,
      evidence: input.evidence,
      policy: 'LEGAL_REVIEW',
      status: 'REVIEW_REQUIRED',
      conditions: ['Unrecognised licence identifier; a human must classify it before any reuse.'],
      reasons: [`Licence "${spdx}" is not in the gate's rule table.`],
    };
  }

  reasons.push(`${spdx}: ${rule.note}`);

  // The licence string is only as trustworthy as the evidence behind it.
  let status = rule.status;
  let policy = rule.policy;
  if (input.evidence.class === 'CLAIMED' || input.evidence.class === 'UNKNOWN') {
    status = worst(status, 'REVIEW_REQUIRED');
    policy = downgrade(policy, 'REFERENCE_ONLY');
    reasons.push(
      `Licence evidence is ${input.evidence.class}; the identifier was not confirmed against the repository's licence file in this run.`,
    );
  }

  if (input.commercialUse === 'UNKNOWN' && (policy === 'LEGAL_REVIEW' || status === 'REVIEW_REQUIRED')) {
    reasons.push('Commercial use is UNKNOWN, so the gate stays conservative rather than assuming internal-only use.');
  }

  if (input.policyReferenceOnly) {
    policy = downgrade(policy, 'REFERENCE_ONLY');
    reasons.push('Project policy pins this source to concept reference only, independent of its licence.');
  }

  return { spdx, evidence: input.evidence, policy, status, conditions: rule.conditions, reasons };
}

const STATUS_SEVERITY: Record<GateStatus, number> = {
  PASS: 0,
  CONDITIONAL: 1,
  UNKNOWN: 2,
  REVIEW_REQUIRED: 3,
  BLOCK: 4,
};

export function worst(a: GateStatus, b: GateStatus): GateStatus {
  return STATUS_SEVERITY[a] >= STATUS_SEVERITY[b] ? a : b;
}

const POLICY_PERMISSIVENESS: Record<ReusePolicy, number> = {
  REUSE_OK: 4,
  REUSE_WITH_CONDITIONS: 3,
  REFERENCE_ONLY: 2,
  LEGAL_REVIEW: 1,
  BLOCK: 0,
};

/** Returns whichever of the two is *less* permissive. */
export function downgrade(a: ReusePolicy, b: ReusePolicy): ReusePolicy {
  return POLICY_PERMISSIVENESS[a] <= POLICY_PERMISSIVENESS[b] ? a : b;
}

/** May third-party source be copied under this policy? */
export function mayCopyCode(policy: ReusePolicy): boolean {
  return policy === 'REUSE_OK' || policy === 'REUSE_WITH_CONDITIONS';
}

/** Registry of licences the gate understands, for documentation and tests. */
export function knownLicenses(): string[] {
  return Object.keys(RULES);
}
