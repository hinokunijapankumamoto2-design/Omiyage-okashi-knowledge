import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';

import { runScout } from '../src/pipeline.js';
import { designArchitecture } from '../src/integration/architect.js';
import { buildPlugin } from '../src/builder/plugin-builder.js';
import { validatePluginPackage } from '../src/validation/package-validator.js';
import { runBenchmark, type BenchmarkTask } from '../src/validation/benchmark.js';
import { buildSubjects } from '../src/validation/reports.js';
import { projectRoot, readJson } from '../src/util/io.js';
import { runBuild } from '../src/cli.js';

const GOAL = 'Claude Codeで最高品質のWebサイトを作れるPluginを作って';
const REPOS = [
  'https://github.com/fixture-org/frontend-craft-plugin',
  'https://github.com/fixture-org/browser-qa-plugin',
  'https://github.com/fixture-org/a11y-guard-plugin',
];

function tasks(): BenchmarkTask[] {
  return readJson<{ tasks: BenchmarkTask[] }>(resolve(projectRoot(), 'tests', 'benchmark', 'tasks.json')).tasks;
}

// ---------------------------------------------------------------------------
// MVP ACCEPTANCE TEST 1 — goal to generated plugin, one pass through the flow
// ---------------------------------------------------------------------------

test('ACCEPTANCE 1: a goal alone runs the whole flow and produces a plugin', async (t) => {
  const scout = await runScout({ goal: GOAL });

  await t.test('goal decomposes into the capability map the goal implies', () => {
    for (const cap of [
      'visual-design',
      'frontend-implementation',
      'responsive-design',
      'accessibility-audit',
      'browser-automation',
      'screenshot-capture',
      'visual-review',
      'performance-audit',
      'testing',
      'security-review',
    ]) {
      assert.ok(scout.goal.requiredCapabilities.includes(cap), `missing required capability: ${cap}`);
    }
  });

  await t.test('discovery finds OSS for capabilities the user supplied nothing for', () => {
    assert.ok(scout.discovered.length > 0, 'expected discovery to return candidates');
    assert.ok(scout.discovered.every((d) => d.capabilities.length > 0));
  });

  await t.test('capabilities are extracted with an evidence class and both gate results', () => {
    for (const d of scout.discovered) {
      for (const c of d.capabilities) {
        assert.ok(['VERIFIED', 'SUPPORTED', 'INFERRED', 'CLAIMED', 'UNKNOWN'].includes(c.evidence.class));
        assert.ok(c.licenseStatus);
        assert.ok(c.securityStatus);
      }
    }
  });

  await t.test('a best capability stack is selected', () => {
    assert.ok(scout.stack.entries.length > 0);
  });

  const dir = mkdtempSync(resolve(tmpdir(), 'oss-acc1-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const plan = designArchitecture(scout.stack, { pluginName: 'goal-only-plugin' });
  const built = buildPlugin(plan, { outputRoot: dir });

  await t.test('a real plugin is written, not just a report', () => {
    assert.ok(existsSync(resolve(built.outputDir, '.claude-plugin', 'plugin.json')));
    assert.ok(built.files.some((f) => f.startsWith('skills/') && f.endsWith('SKILL.md')));
  });

  await t.test('the generated package validates as a Claude Code plugin', () => {
    const v = validatePluginPackage(built.outputDir);
    assert.equal(v.ok, true, v.issues.map((i) => `${i.severity}: ${i.message}`).join('\n'));
  });
});

// ---------------------------------------------------------------------------
// MVP ACCEPTANCE TEST 2 — BYOT: three supplied repositories
// ---------------------------------------------------------------------------

test('ACCEPTANCE 2: three supplied repositories produce every decision class and a plugin', async (t) => {
  const scout = await runScout({ goal: GOAL, repos: REPOS });
  const decisions = scout.stack.decisions;
  const kinds = new Set(decisions.map((d) => d.decision));

  await t.test('KEEP, REPLACE, ADD and REMOVE are all produced', () => {
    for (const k of ['KEEP', 'ADD', 'REMOVE', 'REPLACE']) {
      assert.ok(kinds.has(k as never), `expected at least one ${k} decision, got: ${[...kinds].join(', ')}`);
    }
  });

  await t.test('every decision carries a reason', () => {
    for (const d of decisions) assert.ok(d.reason.length > 20, `decision for ${d.capabilityId} has no real reason`);
  });

  await t.test('MISSING capabilities are computed and sent back to discovery', () => {
    assert.ok(scout.discovered.length > 0);
    const added = decisions.filter((d) => d.decision === 'ADD');
    assert.ok(added.length > 0);
  });

  await t.test('DUPLICATE capabilities are detected and resolved to one winner', () => {
    assert.ok(scout.stack.duplicates.length > 0, 'expected duplicate capabilities across the three repos');
    for (const d of scout.stack.duplicates) {
      assert.ok(d.members.includes(d.winner));
      assert.ok(d.axis, 'a duplicate must be resolved on a named axis');
    }
    // One implementation per capability in the final stack.
    const ids = scout.stack.entries.map((e) => e.capabilityId);
    assert.equal(new Set(ids).size, ids.length, 'a capability appears twice in the stack');
  });

  await t.test('CONFLICTs across the supplied plugins are detected', () => {
    const kindsFound = new Set(scout.stack.conflicts.map((c) => c.kind));
    assert.ok(kindsFound.has('command-namespace'));
    assert.ok(kindsFound.has('filesystem-conflict'));
    assert.ok(scout.stack.conflicts.length >= 3);
  });

  await t.test('the unsafe, unlicensed repository is blocked by the hard gates', () => {
    const bad = scout.supplied.find((s) => s.profile.id === 'fixture-org/a11y-guard-plugin');
    assert.ok(bad);
    assert.equal(bad.security.status, 'BLOCK');
    assert.equal(bad.license.policy, 'REFERENCE_ONLY');
    assert.equal(bad.score.blocked, true);
    // A BLOCK outranks the score: it has the most stars of the three.
    assert.ok(bad.profile.stars !== null && bad.profile.stars > 4000);
    assert.ok(!scout.stack.entries.some((e) => e.capability.sourceRepository === bad.profile.id));
  });

  await t.test('near-miss detection reports what one more capability would unlock', () => {
    const suppliedOnly = ['browser-automation', 'screenshot-capture'];
    const misses = scout.graph.nearMisses(suppliedOnly);
    assert.ok(misses.some((m) => m.unlocks === 'visual-regression' && m.missing.includes('image-comparison')));
  });

  const dir = mkdtempSync(resolve(tmpdir(), 'oss-acc2-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const plan = designArchitecture(scout.stack, { pluginName: 'byot-plugin' });
  const built = buildPlugin(plan, { outputRoot: dir });

  await t.test('an integrated plugin is actually generated', () => {
    const v = validatePluginPackage(built.outputDir);
    assert.equal(v.ok, true, v.issues.map((i) => i.message).join('\n'));
  });

  await t.test('provenance records every capability with reused code = None', () => {
    assert.ok(built.provenance.length >= scout.stack.entries.length);
    for (const p of built.provenance) assert.equal(p.reusedCode, 'None');
    const text = readFileSync(resolve(built.outputDir, 'PROVENANCE.md'), 'utf8');
    assert.match(text, /Reused code: None/i);
  });

  await t.test('no third-party source is copied into the generated plugin', () => {
    // The blocked repository's own identifiers must not appear in the output.
    for (const f of built.files) {
      const text = readFileSync(resolve(built.outputDir, f), 'utf8');
      assert.ok(!text.includes('A11Y_PLUGIN_DIR'), `${f} contains a fixture's internal identifier`);
      assert.ok(!text.includes('curl -sL'), `${f} contains a fixture's install script`);
    }
  });
});

// ---------------------------------------------------------------------------
// MVP ACCEPTANCE TEST 3 — improvement over the originals
// ---------------------------------------------------------------------------

test('ACCEPTANCE 3: the integrated plugin is benchmarked against each original', async (t) => {
  const scout = await runScout({ goal: GOAL, repos: REPOS });
  const plan = designArchitecture(scout.stack, { pluginName: 'benchmarked-plugin' });
  const { subjects, integratedName } = buildSubjects(scout, plan);
  const report = runBenchmark(tasks(), subjects, integratedName);

  await t.test('every original and the integrated plugin are run on the same tasks', () => {
    assert.equal(subjects.length, 4);
    for (const r of REPOS) {
      const id = r.replace('https://github.com/', '');
      assert.ok(report.subjects.includes(id), `${id} was not benchmarked`);
    }
    assert.ok(report.subjects.includes('benchmarked-plugin'));
  });

  await t.test('the verdict is one of the four allowed values', () => {
    assert.ok(['IMPROVED', 'EQUIVALENT', 'REGRESSION', 'NOT_VERIFIED'].includes(report.overall));
  });

  await t.test('task completion improves against the strongest original', () => {
    const m = report.metrics.find((x) => x.metric === 'Task Completion');
    assert.ok(m);
    const mine = m.values[integratedName] as number;
    const best = Math.max(...REPOS.map((r) => m.values[r.replace('https://github.com/', '')] as number));
    assert.ok(mine > best, `integrated ${mine} did not beat best original ${best}`);
  });

  await t.test('unmeasured dimensions are reported as NOT_VERIFIED, never as improvements', () => {
    for (const m of report.metrics.filter((x) => !x.measured)) {
      assert.equal(m.verdict, 'NOT_VERIFIED');
      assert.equal(m.countsTowardVerdict, false);
    }
    assert.ok(report.notMeasured.length > 0);
    assert.match(report.kind, /not executed against a live target/i);
  });

  await t.test('a metric excluded from the verdict must say why', () => {
    for (const m of report.metrics.filter((x) => x.measured && !x.countsTowardVerdict)) {
      assert.ok(m.excludedBecause && m.excludedBecause.length > 30, `${m.metric} is excluded with no justification`);
    }
  });

  await t.test('a regression on a counted metric forces an overall REGRESSION', () => {
    const counted = report.metrics.filter((m) => m.measured && m.countsTowardVerdict);
    if (counted.some((m) => m.verdict === 'REGRESSION')) {
      assert.equal(report.overall, 'REGRESSION');
      assert.match(report.overallNote, /REGRESSION DETECTED/);
    }
  });
});

// ---------------------------------------------------------------------------
// End-to-end through the documented CLI entry point
// ---------------------------------------------------------------------------

test('ACCEPTANCE 4: `build` writes the plugin and all three reports', async (t) => {
  const dir = mkdtempSync(resolve(tmpdir(), 'oss-acc4-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const outcome = await runBuild({ goal: GOAL, repos: REPOS, out: dir, name: 'e2e-plugin' });

  assert.equal(outcome.packageOk, true);
  for (const p of outcome.reportPaths) assert.ok(existsSync(p), `missing report: ${p}`);
  for (const f of ['INTEGRATION_REPORT.md', 'VALIDATION_REPORT.md', 'PROVENANCE.md']) {
    assert.ok(existsSync(resolve(outcome.outputDir, f)));
  }

  const integration = readFileSync(resolve(outcome.outputDir, 'INTEGRATION_REPORT.md'), 'utf8');
  for (const section of ['KEEP', 'REPLACE', 'ADD', 'REMOVE', 'Conflicts', 'Best Capability Stack', 'UNKNOWN']) {
    assert.match(integration, new RegExp(section));
  }

  const validation = readFileSync(resolve(outcome.outputDir, 'VALIDATION_REPORT.md'), 'utf8');
  assert.match(validation, /IMPROVEMENT NOT VERIFIED/);
});
