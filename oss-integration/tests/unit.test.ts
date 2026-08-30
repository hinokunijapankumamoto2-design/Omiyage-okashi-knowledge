import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyEvidence, meetsStandard, confidenceFromEvidence } from '../src/evidence/engine.js';
import { assessLicense, mayCopyCode, downgrade, knownLicenses } from '../src/license/gate.js';
import { scanSecurity, coveredRisks } from '../src/security/gate.js';
import { assessHealth } from '../src/health/engine.js';
import { CapabilityGraph } from '../src/graph/capability-graph.js';
import { computeGap } from '../src/gap/engine.js';
import { normalizeGoal, decomposeCapabilities } from '../src/goal/engine.js';
import { parseRepoRef, analyzeRepository } from '../src/repository/analyzer.js';
import { detectConflicts, detectDuplicates } from '../src/compatibility/detector.js';
import { derivePluginName } from '../src/cli.js';
import { emptySurface } from '../src/types.js';

test('evidence: popularity alone never rises above UNKNOWN', () => {
  assert.equal(classifyEvidence(['social-popularity']).class, 'UNKNOWN');
  assert.equal(classifyEvidence([]).class, 'UNKNOWN');
});

test('evidence: an executable test outranks a README claim', () => {
  assert.equal(classifyEvidence(['readme-claim']).class, 'CLAIMED');
  assert.equal(classifyEvidence(['readme-claim', 'executable-test']).class, 'VERIFIED');
  assert.ok(confidenceFromEvidence('VERIFIED') > confidenceFromEvidence('CLAIMED'));
  assert.ok(meetsStandard('VERIFIED', 'SUPPORTED'));
  assert.ok(!meetsStandard('CLAIMED', 'SUPPORTED'));
});

test('licence: an unknown licence never permits copying code', () => {
  const a = assessLicense({
    spdx: 'UNKNOWN',
    evidence: classifyEvidence([]),
    commercialUse: 'UNKNOWN',
  });
  assert.equal(a.policy, 'REFERENCE_ONLY');
  assert.equal(mayCopyCode(a.policy), false);
});

test('licence: copyleft with linking obligations goes to legal review, not through', () => {
  const lgpl = assessLicense({
    spdx: 'LGPL-3.0-only',
    evidence: classifyEvidence(['official-documentation']),
    commercialUse: 'UNKNOWN',
  });
  assert.equal(lgpl.status, 'REVIEW_REQUIRED');
  assert.equal(lgpl.policy, 'LEGAL_REVIEW');
  assert.equal(mayCopyCode(lgpl.policy), false);
});

test('licence: a permissive licence backed only by a claim is downgraded', () => {
  const strong = assessLicense({
    spdx: 'MIT',
    evidence: classifyEvidence(['source-inspection']),
    commercialUse: 'YES',
  });
  const weak = assessLicense({
    spdx: 'MIT',
    evidence: classifyEvidence(['readme-claim']),
    commercialUse: 'YES',
  });
  assert.equal(strong.policy, 'REUSE_WITH_CONDITIONS');
  assert.equal(weak.policy, 'REFERENCE_ONLY');
  assert.equal(weak.status, 'REVIEW_REQUIRED');
});

test('licence: downgrade always returns the less permissive policy', () => {
  assert.equal(downgrade('REUSE_OK', 'REFERENCE_ONLY'), 'REFERENCE_ONLY');
  assert.equal(downgrade('BLOCK', 'REUSE_OK'), 'BLOCK');
});

test('security: scanning nothing is UNKNOWN, never PASS', () => {
  const r = scanSecurity({ artifacts: {} });
  assert.equal(r.status, 'UNKNOWN');
  assert.match(r.reasons.join(' '), /not evidence of safety/i);
});

test('security: a pipe-to-shell installer is a BLOCK', () => {
  const r = scanSecurity({
    artifacts: { 'README.md': 'Install: curl -sL https://x.example.com/i.sh | sudo bash' },
  });
  assert.equal(r.status, 'BLOCK');
  assert.ok(r.findings.some((f) => f.risk === 'untrusted-install-script' && f.severity === 'critical'));
});

test('security: clean artifacts pass but the reason says the scan is static only', () => {
  const r = scanSecurity({ artifacts: { 'a.ts': 'export const x = 1;\n' } });
  assert.equal(r.status, 'PASS');
  assert.match(r.reasons.join(' '), /does not prove the code is safe/i);
});

test('graph: prerequisites close transitively', () => {
  const g = new CapabilityGraph();
  const closed = g.prerequisiteClosure(['visual-regression']);
  assert.ok(closed.includes('screenshot-capture'));
  assert.ok(closed.includes('image-comparison'));
  assert.ok(closed.includes('browser-automation'), 'screenshot-capture requires browser-automation transitively');
});

test('graph: near-miss finds the one capability that unlocks visual regression', () => {
  const g = new CapabilityGraph();
  const misses = g.nearMisses(['browser-automation', 'screenshot-capture']);
  const vr = misses.find((m) => m.unlocks === 'visual-regression');
  assert.ok(vr, 'expected a near miss for visual-regression');
  assert.deepEqual(vr.missing, ['image-comparison']);
  assert.equal(vr.distance, 1);
});

test('graph: a complete combination unlocks, and is then no longer a near miss', () => {
  const g = new CapabilityGraph();
  const have = ['browser-automation', 'screenshot-capture', 'image-comparison'];
  assert.ok(g.unlocked(have).includes('visual-regression'));
  assert.ok(!g.nearMisses(have).some((m) => m.unlocks === 'visual-regression'));
});

test('gap: an unlocked capability is covered by combination, not reported missing', () => {
  const gap = computeGap(
    ['visual-regression'],
    ['browser-automation', 'screenshot-capture', 'image-comparison'],
  );
  assert.ok(gap.coveredByUnlock.includes('visual-regression'));
  assert.ok(!gap.missing.includes('visual-regression'));
});

test('goal: nothing the user did not state is invented', () => {
  const spec = normalizeGoal({ goal: 'build something' });
  assert.equal(spec.targetEnvironment, 'UNKNOWN');
  assert.equal(spec.commercialUse, 'UNKNOWN');
  assert.deepEqual(spec.constraints, []);
  assert.ok(spec.unknowns.some((u) => u.startsWith('CONSTRAINTS')));
  assert.ok(spec.unknowns.some((u) => u.startsWith('COMMERCIAL USE')));
});

test('goal: archetype expansion is recorded so it can be audited', () => {
  const spec = normalizeGoal({ goal: 'Claude Codeで最高品質のWebサイトを作れるPluginを作って' });
  assert.equal(spec.targetEnvironment, 'Claude Code');
  assert.ok(spec.derivedFrom.some((d) => d.archetype === 'high-quality-website'));
  for (const cap of ['accessibility-audit', 'performance-audit', 'browser-automation', 'visual-review']) {
    assert.ok(spec.requiredCapabilities.includes(cap), `expected ${cap} in required capabilities`);
  }
});

test('goal: decomposition yields capabilities, never repository names', () => {
  const { required } = decomposeCapabilities('I need a website with accessibility');
  assert.ok(required.length > 0);
  for (const r of required) assert.ok(!r.includes('/'), `"${r}" looks like a repository id`);
});

test('repository: refs parse from both URL and slug, and junk is rejected', () => {
  assert.equal(parseRepoRef('https://github.com/foo/bar')?.id, 'foo/bar');
  assert.equal(parseRepoRef('https://github.com/foo/bar.git')?.id, 'foo/bar');
  assert.equal(parseRepoRef('foo/bar')?.id, 'foo/bar');
  assert.equal(parseRepoRef('not a repo'), null);
});

test('repository: an unresolvable repo offline becomes an explicit UNKNOWN, not a guess', async () => {
  const p = await analyzeRepository('some-owner/definitely-not-seeded', { live: false });
  assert.equal(p.licenseSpdx, 'UNKNOWN');
  assert.equal(p.primaryCapability, 'UNKNOWN');
  assert.deepEqual(p.inspected, []);
});

test('repository: a seeded registry entry carries its research provenance', async () => {
  const p = await analyzeRepository('https://github.com/microsoft/playwright', { live: false });
  assert.equal(p.licenseSpdx, 'Apache-2.0');
  assert.equal(p.source, 'registry-seed');
  assert.ok(p.dataProvenance.join(' ').includes('github.com/microsoft/playwright'));
});

test('conflicts: colliding command namespaces across sources are detected', async () => {
  const repos = await Promise.all([
    analyzeRepository('fixture-org/frontend-craft-plugin'),
    analyzeRepository('fixture-org/browser-qa-plugin'),
    analyzeRepository('fixture-org/a11y-guard-plugin'),
  ]);
  const conflicts = detectConflicts(repos);
  const review = conflicts.find((c) => c.kind === 'command-namespace' && c.subject === 'review');
  assert.ok(review, 'all three fixtures declare a "review" command');
  assert.equal(review.parties.length, 3);
  assert.ok(conflicts.some((c) => c.kind === 'filesystem-conflict' && c.subject === '.qa/'));
  assert.ok(conflicts.some((c) => c.kind === 'duplicate-hook'));
});

test('duplicates: one winner per capability, decided on a named axis', () => {
  const mk = (repositoryId: string, cls: 'VERIFIED' | 'CLAIMED', score: number) => ({
    repositoryId,
    score,
    blocked: false,
    capability: {
      capabilityId: 'browser-automation',
      name: 'x',
      description: 'x',
      category: 'automation' as const,
      sourceRepository: repositoryId,
      sourceVersion: 'UNKNOWN' as const,
      sourceCommit: 'UNKNOWN' as const,
      evidence: classifyEvidence(cls === 'VERIFIED' ? ['executable-test'] : ['readme-claim']),
      strength: [],
      limitations: [],
      dependencies: [],
      compatibility: { runtime: ['node'], conflictsWith: [], notes: [] },
      licenseStatus: 'REUSE_WITH_CONDITIONS' as const,
      securityStatus: 'PASS' as const,
      confidence: 0.9,
    },
  });
  const groups = detectDuplicates([mk('a/one', 'CLAIMED', 4.9), mk('b/two', 'VERIFIED', 1.0)]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.winner, 'b/two', 'evidence must beat a higher score');
  assert.equal(groups[0]?.axis, 'BEST_EVIDENCE');
});

test('cli: plugin names are safe kebab-case even from non-latin goals', () => {
  assert.match(derivePluginName('Claude Codeで最高品質のWebサイトを作りたい'), /^[a-z0-9-]+$/);
  assert.match(derivePluginName('Build a great website'), /^[a-z0-9-]+$/);
});

test('licence: the gate covers permissive, weak-copyleft and strong-copyleft families', () => {
  const known = knownLicenses();
  for (const spdx of ['MIT', 'Apache-2.0', 'MPL-2.0', 'LGPL-3.0-only', 'GPL-3.0-only', 'AGPL-3.0-only', 'NONE']) {
    assert.ok(known.includes(spdx), `licence gate has no rule for ${spdx}`);
  }
  // An explicit "no licence granted" is a BLOCK, not merely reference-only.
  const none = assessLicense({ spdx: 'NONE', evidence: classifyEvidence(['source-inspection']), commercialUse: 'YES' });
  assert.equal(none.status, 'BLOCK');
});

test('security: every risk category named in the specification is detectable', () => {
  const covered = new Set(coveredRisks());
  for (const risk of [
    'arbitrary-command-execution',
    'unsafe-shell-execution',
    'credential-exposure',
    'secret-collection',
    'unexpected-network-access',
    'destructive-file-operations',
    'excessive-permissions',
    'untrusted-install-script',
    'suspicious-dependency',
    'known-critical-vulnerability',
  ] as const) {
    assert.ok(covered.has(risk) || risk === 'known-critical-vulnerability', `no detection path for ${risk}`);
  }
  // The advisory category is driven by a caller-supplied list rather than a
  // pattern, so it is asserted through behaviour instead.
  const advisory = scanSecurity({
    artifacts: { 'package.json': '{}' },
    dependencies: ['bad-pkg'],
    knownVulnerable: ['bad-pkg'],
  });
  assert.ok(advisory.findings.some((f) => f.risk === 'known-critical-vulnerability'));
  assert.equal(advisory.status, 'BLOCK');
});

test('health: an unparseable date is UNKNOWN, not silently scored', () => {
  const base = {
    id: 'x/y', url: '', owner: 'x', name: 'y', description: 'UNKNOWN' as const, kind: 'unknown' as const,
    licenseSpdx: 'UNKNOWN' as const, licenseEvidence: classifyEvidence([]), latestRelease: 'UNKNOWN' as const,
    documentation: 'PRESENT' as const, tests: 'PRESENT' as const, dependencies: [], architecture: 'UNKNOWN' as const,
    installation: 'UNKNOWN' as const, primaryCapability: 'UNKNOWN' as const, secondaryCapabilities: [],
    stars: null, inspected: [], artifacts: {}, surface: emptySurface(), source: 'fixture' as const,
    capturedAt: 'UNKNOWN' as const, dataProvenance: [],
  };
  const bad = assessHealth({ ...base, lastMeaningfulUpdate: 'last tuesday' });
  assert.ok(bad.unknowns.some((u) => /not a parseable date/.test(u)));
  assert.ok(bad.score === null || Number.isFinite(bad.score), 'score must never be NaN');

  const good = assessHealth({ ...base, lastMeaningfulUpdate: '2026-08-01' }, new Date('2026-08-30'));
  assert.ok(good.score !== null && good.score > 0);
});

test('scoring: differentiation reflects the real candidate field, not a constant', async () => {
  const { runScout } = await import('../src/pipeline.js');
  const scout = await runScout({
    goal: 'Claude Codeで最高品質のWebサイトを作れるPluginを作って',
    repos: ['https://github.com/fixture-org/browser-qa-plugin'],
  });
  const all = [...scout.supplied, ...scout.discovered];
  const diffs = all.map((r) => r.score.breakdown.differentiation.raw);
  assert.ok(new Set(diffs).size > 1, 'every candidate scored identically on differentiation, so the axis is inert');
  const contested = all.find((r) => r.profile.primaryCapability === 'accessibility-audit');
  const sole = all.find((r) => r.profile.primaryCapability === 'image-comparison');
  assert.ok(contested && sole);
  assert.ok(
    sole.score.breakdown.differentiation.raw > contested.score.breakdown.differentiation.raw,
    'a sole supplier must out-score one of several suppliers of the same capability',
  );
});

test('conflicts: a runtime floor is resolved, a library major clash is not', async () => {
  const { emptySurface } = await import('../src/types.js');
  const mk = (id: string, deps: string[]) => ({
    id, url: '', owner: id.split('/')[0] as string, name: id.split('/')[1] as string,
    description: 'UNKNOWN' as const, kind: 'library' as const, licenseSpdx: 'MIT',
    licenseEvidence: classifyEvidence(['source-inspection']), latestRelease: 'UNKNOWN' as const,
    lastMeaningfulUpdate: 'UNKNOWN' as const, documentation: 'UNKNOWN' as const, tests: 'UNKNOWN' as const,
    dependencies: deps, architecture: 'UNKNOWN' as const, installation: 'UNKNOWN' as const,
    primaryCapability: 'testing', secondaryCapabilities: [], stars: null, inspected: [],
    artifacts: {}, surface: emptySurface(), source: 'fixture' as const, capturedAt: 'UNKNOWN' as const,
    dataProvenance: [],
  });

  const engine = detectConflicts([mk('a/one', ['node@20']), mk('b/two', ['node@18'])]);
  const nodeConflict = engine.find((c) => c.subject === 'node');
  assert.ok(nodeConflict, 'differing engine floors should still be reported');
  assert.equal(nodeConflict.resolved, true, 'node 20 satisfies a node 18 floor, so this is resolvable');
  assert.match(nodeConflict.resolution, />= 20/);

  const library = detectConflicts([mk('a/one', ['react@17']), mk('b/two', ['react@18'])]);
  const reactConflict = library.find((c) => c.subject === 'react');
  assert.ok(reactConflict, 'a genuine library major clash must still be detected');
  assert.equal(reactConflict.resolved, false, 'react 17 and 18 cannot both be satisfied');
});

test('conflicts: the architect does not re-open a conflict the detector resolved', async () => {
  const { resolveConflicts } = await import('../src/integration/architect.js');
  const stack = {
    goal: normalizeGoal({ goal: 'test' }),
    entries: [], decisions: [], duplicates: [], conflicts: [],
    gaps: { required: [], current: [], missing: [], coveredByUnlock: [], nearMisses: [] },
    rejected: [],
  };
  const already = {
    kind: 'incompatible-dependency' as const,
    subject: 'node',
    parties: ['a/one', 'b/two'],
    detail: 'runtime floors',
    resolution: 'Resolved: require node >= 20.',
    resolved: true,
  };
  const [out] = resolveConflicts([already], stack);
  assert.equal(out?.resolved, true, 'a resolved conflict must not be re-opened');
  assert.match(out?.resolution ?? '', />= 20/);
});
