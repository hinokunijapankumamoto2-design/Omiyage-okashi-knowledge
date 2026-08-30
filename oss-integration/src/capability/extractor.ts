import type { Capability, EvidenceBasis, RepositoryProfile, TriState } from '../types.js';
import { classifyEvidence, confidenceFromEvidence } from '../evidence/engine.js';
import { assessLicense } from '../license/gate.js';
import { scanSecurity } from '../security/gate.js';
import { capabilityById } from './taxonomy.js';
import { loadOssRegistry, profileEvidence } from '../repository/analyzer.js';

/**
 * Capability Extractor.
 *
 * Turns one repository into zero or more Capability records. Both hard gates
 * run here so that a capability carries its own licence and security status -
 * downstream selection never has to go back to the repository to find out
 * whether it is usable.
 */

export interface ExtractOptions {
  commercialUse: TriState;
  knownVulnerable?: string[];
}

export function extractCapabilities(repo: RepositoryProfile, opts: ExtractOptions): Capability[] {
  const regEntry = loadOssRegistry().entries.find((e) => e.id === repo.id);

  const license = assessLicense({
    spdx: repo.licenseSpdx,
    evidence: repo.licenseEvidence,
    commercialUse: opts.commercialUse,
    policyReferenceOnly: regEntry?.referenceOnlyByPolicy ?? false,
  });

  const security = scanSecurity({
    artifacts: repo.artifacts,
    dependencies: repo.dependencies,
    knownVulnerable: opts.knownVulnerable ?? [],
  });

  const baseEvidence = profileEvidence(repo);

  const ids: { id: string; primary: boolean }[] = [];
  if (repo.primaryCapability !== 'UNKNOWN') ids.push({ id: repo.primaryCapability, primary: true });
  for (const s of repo.secondaryCapabilities) ids.push({ id: s, primary: false });

  return ids.map(({ id, primary }) => {
    const tax = capabilityById(id);
    // A secondary capability is, by construction, less directly evidenced than
    // the repository's headline capability.
    const basis: EvidenceBasis[] = primary
      ? baseEvidence.basis
      : baseEvidence.basis.filter((b) => b !== 'executable-test');
    const evidence = classifyEvidence(basis, [
      ...baseEvidence.notes,
      primary
        ? 'Declared as the repository’s primary capability.'
        : 'Declared as a secondary capability; treated as weaker evidence than the primary.',
    ]);

    const strength = primary ? (regEntry?.strength ?? []) : [];
    const limitations = [...(primary ? (regEntry?.limitations ?? []) : [])];
    if (!repo.inspected.includes('source')) {
      limitations.push('Source was not inspected in this run, so no claim here is class VERIFIED.');
    }

    return {
      capabilityId: id,
      name: tax?.name ?? id,
      description: tax?.description ?? (repo.description === 'UNKNOWN' ? 'UNKNOWN' : repo.description),
      category: tax?.category ?? 'unknown',
      sourceRepository: repo.id,
      sourceVersion: repo.latestRelease,
      sourceCommit: 'UNKNOWN',
      evidence,
      strength,
      limitations,
      dependencies: repo.dependencies,
      compatibility: {
        runtime: regEntry?.runtime ?? [],
        conflictsWith: [],
        notes: repo.architecture === 'UNKNOWN' ? ['Architecture not inspected.'] : [repo.architecture],
      },
      licenseStatus: license.policy,
      securityStatus: security.status,
      confidence: gateAdjustedConfidence(confidenceFromEvidence(evidence.class), license.policy, security.status),
    } satisfies Capability;
  });
}

function gateAdjustedConfidence(
  base: number,
  license: Capability['licenseStatus'],
  security: Capability['securityStatus'],
): number {
  let c = base;
  if (license === 'BLOCK' || security === 'BLOCK') return 0;
  if (license === 'LEGAL_REVIEW' || security === 'REVIEW_REQUIRED') c *= 0.6;
  if (license === 'REFERENCE_ONLY') c *= 0.8;
  if (security === 'UNKNOWN') c *= 0.8;
  return Math.round(c * 100) / 100;
}

/** Convenience: run the gates once and return them alongside the capabilities. */
export function extractWithGates(repo: RepositoryProfile, opts: ExtractOptions) {
  const regEntry = loadOssRegistry().entries.find((e) => e.id === repo.id);
  const license = assessLicense({
    spdx: repo.licenseSpdx,
    evidence: repo.licenseEvidence,
    commercialUse: opts.commercialUse,
    policyReferenceOnly: regEntry?.referenceOnlyByPolicy ?? false,
  });
  const security = scanSecurity({
    artifacts: repo.artifacts,
    dependencies: repo.dependencies,
    knownVulnerable: opts.knownVulnerable ?? [],
  });
  return { capabilities: extractCapabilities(repo, opts), license, security };
}
