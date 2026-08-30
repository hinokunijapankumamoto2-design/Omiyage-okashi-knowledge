import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeRepository, liveAttemptLog } from '../src/repository/analyzer.js';
import { extractWithGates } from '../src/capability/extractor.js';
import { assessHealth } from '../src/health/engine.js';

/**
 * LIVE_REPOSITORY_TEST.
 *
 * Real network, real public repositories. Opt-in via OSS_LIVE_TEST=1 so the
 * default suite stays offline and deterministic; skipping is reported as
 * skipped, never as passed.
 *
 * These assertions deliberately do NOT pin version numbers or finding counts,
 * because those change upstream. They assert the properties that must hold for
 * the live path to be trustworthy: that real artifacts were fetched, that the
 * licence came from a licence file rather than a guess, and that the security
 * gate actually had something to scan.
 */

const LIVE = process.env.OSS_LIVE_TEST === '1';

const REPOS = [
  { id: 'dequelabs/axe-core', expectLicense: 'MPL-2.0' },
  { id: 'americanexpress/jest-image-snapshot', expectLicense: 'Apache-2.0' },
  { id: 'GoogleChrome/lighthouse', expectLicense: 'Apache-2.0' },
];

for (const repo of REPOS) {
  test(`LIVE: ${repo.id} is analysed from real artifacts`, { skip: LIVE ? false : 'set OSS_LIVE_TEST=1 to run live tests' }, async () => {
    const profile = await analyzeRepository(repo.id, { live: true });

    assert.equal(profile.source, 'live-github', `expected a live profile, got ${profile.source}`);
    assert.ok(profile.inspected.includes('README'), 'no README was fetched');
    assert.ok(profile.inspected.includes('license-file'), 'no licence file was fetched');
    assert.ok(profile.inspected.includes('source'), 'no source was fetched, so nothing real was scanned');

    // Licence identified from the shipped licence text, not from a claim.
    assert.equal(profile.licenseSpdx, repo.expectLicense);
    assert.equal(profile.licenseEvidence.class, 'SUPPORTED');

    // Real release and activity data, not UNKNOWN.
    assert.notEqual(profile.latestRelease, 'UNKNOWN');
    assert.match(profile.lastMeaningfulUpdate, /^\d{4}-\d{2}-\d{2}$/);

    const health = assessHealth(profile);
    assert.ok(health.score !== null, 'live data should be enough to score health');

    const { security, capabilities } = extractWithGates(profile, { commercialUse: 'UNKNOWN' });
    assert.ok(security.scanned.length > 3, `only ${security.scanned.length} artifacts were scanned`);
    assert.notEqual(security.status, 'UNKNOWN', 'a live run must not leave the security gate UNKNOWN');

    // The whole point of the live path: capabilities stop being unscanned.
    assert.ok(capabilities.length > 0);
    for (const c of capabilities) {
      assert.notEqual(c.securityStatus, 'UNKNOWN');
    }

    const attempts = liveAttemptLog.get(repo.id) ?? [];
    assert.ok(attempts.length > 0, 'fetch attempts must be recorded for the live report');
  });
}

test('LIVE: a repository that does not exist stays UNKNOWN rather than being invented', { skip: LIVE ? false : 'set OSS_LIVE_TEST=1 to run live tests' }, async () => {
  const profile = await analyzeRepository('oss-integration-test/definitely-does-not-exist-9f3a', { live: true });
  assert.equal(profile.licenseSpdx, 'UNKNOWN');
  assert.equal(profile.primaryCapability, 'UNKNOWN');
  assert.deepEqual(profile.inspected, []);
});
