import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

import { startSite, collectPageFacts, runSubject, executableTaskIds, launchBrowser, ALL_CAPABILITIES, type LiveTask } from '../src/validation/live-task-runner.js';
import { projectRoot, readJson } from '../src/util/io.js';

/**
 * REAL TASK SUITE.
 *
 * A real browser, the real axe-core engine, real pixel diffing and real
 * navigation timings, against a page served over HTTP. Opt-in because it needs
 * a browser binary; a skip is reported as a skip, never as a pass.
 */
const RUN = process.env.OSS_REAL_TASK === '1';

function tasks(): LiveTask[] {
  const all = readJson<{ tasks: LiveTask[] }>(resolve(projectRoot(), 'tests', 'benchmark', 'tasks.json')).tasks;
  const executable = new Set(executableTaskIds());
  return all.filter((t) => executable.has(t.id));
}

const FULL = [
  'frontend-implementation', 'visual-design', 'responsive-design', 'browser-automation',
  'screenshot-capture', 'testing', 'accessibility-audit', 'performance-audit',
  'image-comparison', 'visual-regression', 'visual-review',
];

test('REAL TASK: capabilities execute against a real page', { skip: RUN ? false : 'set OSS_REAL_TASK=1 to run' }, async (t) => {
  const { server, url } = await startSite();
  t.after(() => server.close());

  const facts = await collectPageFacts(url);

  await t.test('the browser really rendered the page', () => {
    assert.equal(facts.h1Count, 1);
    assert.equal(facts.cardCount, 3);
    assert.ok(facts.title.length > 0);
    assert.equal(facts.screenshotCount, 3);
  });

  await t.test('axe-core really ran and found the planted defect', () => {
    // The page carries exactly one deliberate accessibility defect. Finding it
    // proves the engine ran; finding nothing would prove only that it did not.
    assert.ok(facts.axeViolations > 0, 'axe reported no violations, so it probably did not execute');
    assert.ok(facts.axeRuleIds.includes('image-alt'), `expected image-alt, got ${facts.axeRuleIds.join(', ')}`);
  });

  await t.test('performance timings are real numbers from the browser', () => {
    assert.ok(facts.loadMs >= 0 && facts.domContentLoadedMs >= 0);
  });

  await t.test('the screenshot pipeline is deterministic', () => {
    assert.equal(facts.diffRatio, 0, 'two captures of a static page must be pixel-identical');
  });

  await t.test('a capability-complete subject attempts and passes every executable task', () => {
    const run = runSubject('full', FULL, tasks(), facts);
    assert.equal(run.executed.tasksAttempted, tasks().length);
    assert.equal(run.executed.tasksErrored, 0, run.outcomes.filter((o) => o.status !== 'passed').map((o) => `${o.taskId}: ${o.detail}`).join('; '));
    assert.equal(run.executed.tasksPassed, tasks().length);
    assert.ok(run.executed.rubric.some((r) => r.score !== null), 'no rubric criterion was scored');
  });

  await t.test('a narrower subject attempts fewer tasks under identical conditions', () => {
    const narrow = runSubject('a11y-only', ['browser-automation', 'accessibility-audit'], tasks(), facts);
    const full = runSubject('full', FULL, tasks(), facts);
    assert.ok(narrow.executed.tasksAttempted < full.executed.tasksAttempted);
    // Same page, same implementations: a task both subjects attempt must agree.
    for (const o of narrow.outcomes.filter((x) => x.status !== 'not-attempted')) {
      const same = full.outcomes.find((x) => x.taskId === o.taskId);
      assert.equal(o.status, same?.status, `task ${o.taskId} behaved differently for two subjects on the same page`);
    }
  });

  await t.test('a subject that can check more is not punished for finding a defect', () => {
    // The page carries a real accessibility defect. A subject that can see it
    // must not score WORSE on the shared criteria than one that is blind to it.
    const narrow = runSubject('a11y-blind', ['browser-automation', 'testing', 'frontend-implementation'], tasks(), facts);
    const full = runSubject('full', FULL, tasks(), facts);
    const common = full.rubric
      .filter((r) => r.score !== null && narrow.rubric.find((n) => n.id === r.id)?.score !== null)
      .map((r) => r.id);
    assert.ok(common.length > 0, 'the two subjects share no evaluable criterion');
    const score = (run: typeof full) => {
      const rows = run.rubric.filter((r) => common.includes(r.id));
      return rows.reduce((a, r) => a + (r.score ?? 0), 0) / rows.reduce((a, r) => a + r.max, 0);
    };
    assert.ok(score(full) >= score(narrow), 'the broader subject scored lower on the SAME criteria');
    assert.ok(
      full.rubric.filter((r) => r.score !== null).length > narrow.rubric.filter((r) => r.score !== null).length,
      'the broader subject should evaluate more criteria',
    );
  });

  await t.test('rubric criteria without evidence are NOT_VERIFIED, not zero', () => {
    const narrow = runSubject('a11y-only', ['browser-automation', 'accessibility-audit'], tasks(), facts);
    const codeQuality = narrow.rubric.find((r) => r.id === 'code-quality');
    assert.equal(codeQuality?.score, null);
    assert.match(codeQuality?.evidence ?? '', /NOT_VERIFIED/);
    const perf = narrow.rubric.find((r) => r.id === 'performance');
    assert.equal(perf?.score, null, 'a subject without performance-audit must not be scored on performance');
    for (const r of narrow.rubric) {
      if (r.score !== null) assert.ok(r.evidence.length > 10, `${r.id} scored with no evidence`);
    }
  });
});

test('CACHE SAFETY: a shared browser leaks no state between subjects', { skip: RUN ? false : 'set OSS_REAL_TASK=1 to run' }, async (t) => {
  // The suite shares one browser across subjects and caches the axe-core
  // source. Both are optimizations, and both would be unacceptable if a
  // subject could inherit a measurement it did not earn. A subject without an
  // accessibility capability must report "not measured" (-1), never the
  // previous subject's real violation count.
  const { server, url } = await startSite();
  const browser = await launchBrowser();
  t.after(async () => {
    await browser.close();
    server.close();
  });

  const withAxe = await collectPageFacts(url, ALL_CAPABILITIES, undefined, browser);
  const withoutAxe = await collectPageFacts(url, new Set(['browser-automation', 'screenshot-capture']), undefined, browser);

  assert.ok(withAxe.axeViolations > 0, 'the a11y-capable subject must have a real measurement to leak');
  assert.equal(withoutAxe.axeViolations, -1, 'a subject without accessibility-audit inherited an axe result');
  assert.equal(withoutAxe.diffRatio, -1, 'a subject without image-comparison inherited a diff result');
  assert.equal(withoutAxe.perViewport.length, 3, 'viewport work is gated on its own capability, not on axe');

  // Running the a11y subject again after the narrow one must still measure.
  const again = await collectPageFacts(url, ALL_CAPABILITIES, undefined, browser);
  assert.equal(again.axeViolations, withAxe.axeViolations, 'a shared browser changed a repeated measurement');
});
