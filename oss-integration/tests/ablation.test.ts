import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, rmSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { runScout } from '../src/pipeline.js';
import { designArchitecture } from '../src/integration/architect.js';
import { buildPlugin } from '../src/builder/plugin-builder.js';
import { runBenchmark, type BenchmarkTask } from '../src/validation/benchmark.js';
import { buildSubjects } from '../src/validation/subjects.js';
import { projectRoot, readJson } from '../src/util/io.js';

/**
 * ORIGINAL CONTRIBUTION VALUE TEST.
 *
 * "It exists" is not a justification. Each original component is built out and
 * the difference measured. A component whose absence changes nothing measurable
 * is a removal candidate, and this suite is what would catch it.
 */

const GOAL = 'Claude Codeで最高品質のWebサイトを作れるPluginを作って';
const REPOS = [
  'https://github.com/fixture-org/frontend-craft-plugin',
  'https://github.com/fixture-org/browser-qa-plugin',
  'https://github.com/fixture-org/a11y-guard-plugin',
];

function allText(dir: string): string {
  return [...filesOf(dir).values()].join('');
}

/** relative path -> contents, so a file cannot be counted as referencing itself. */
function filesOf(dir: string, base = dir): Map<string, string> {
  const out = new Map<string, string>();
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) for (const [k, v] of filesOf(full, base)) out.set(k, v);
    else out.set(full.slice(base.length + 1), readFileSync(full, 'utf8'));
  }
  return out;
}

/** Components named by some file OTHER than their own. Self-reference is not indexing. */
function indexedComponents(dir: string): Set<string> {
  const files = filesOf(dir);
  const components = [...files.keys()].filter((f) => f.startsWith('skills/') || f.startsWith('agents/'));
  const named = new Set<string>();
  for (const comp of components) {
    const name = comp.replace(/^(skills|agents)\//, '').replace(/\/SKILL\.md$|\.md$/, '');
    for (const [path, text] of files) {
      // Reports are documentation of the build, not the plugin's own index.
      if (path === comp || /_REPORT\.md$|^PROVENANCE\.md$/.test(path)) continue;
      if (text.includes(name)) {
        named.add(name);
        break;
      }
    }
  }
  return named;
}

test('ABLATION: every original component changes something measurable', async (t) => {
  const scout = await runScout({ goal: GOAL, repos: REPOS });
  const plan = designArchitecture(scout.stack, { pluginName: 'ablation-plugin' });

  const build = (suppress: string[]) => {
    const dir = mkdtempSync(resolve(tmpdir(), 'oss-abl-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    return { dir, built: buildPlugin(plan, { outputRoot: dir, suppressComponents: suppress }) };
  };

  const full = build([]);
  const fullText = allText(full.built.outputDir);

  await t.test('capability-router: without it the plugin has no entry point or ordering', () => {
    const without = build(['capability-router']);
    assert.ok(!existsSync(resolve(without.built.outputDir, 'skills', 'capability-router', 'SKILL.md')));
    const text = allText(without.built.outputDir);

    // WITH: the workflow order and the component index exist.
    assert.ok(fullText.includes('Order of work'), 'the full build should state an order');
    for (const step of plan.workflow.slice(0, 3)) {
      const cap = step.replace(/^\d+\.\s*/, '');
      assert.ok(fullText.includes(cap.split(' (')[0] as string));
    }
    // WITHOUT: no ordering is stated anywhere.
    assert.ok(!text.includes('Order of work'), 'ordering vanished with the router, which is the point');

    // And the sibling components stop being indexed by anything but themselves.
    const indexedWith = indexedComponents(full.built.outputDir);
    const indexedWithout = indexedComponents(without.built.outputDir);
    assert.ok(
      indexedWithout.size < indexedWith.size,
      `the router indexes ${indexedWith.size} components; without it only ${indexedWithout.size} are reachable`,
    );
  });

  await t.test('namespace-guard: without it the resolved collisions are undocumented', () => {
    const collisions = scout.stack.conflicts.filter(
      (c) => c.kind === 'command-namespace' || c.kind === 'filesystem-conflict' || c.kind === 'duplicate-hook',
    );
    assert.ok(collisions.length > 0, 'these fixtures must collide for this ablation to mean anything');

    const without = build(['namespace-guard']);
    const text = allText(without.built.outputDir);
    const subject = collisions[0]?.subject as string;

    assert.ok(fullText.includes(subject), `the full build should name the "${subject}" collision`);
    const withoutMentions = (text.match(new RegExp(subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
    const withMentions = (fullText.match(new RegExp(subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
    assert.ok(withMentions > withoutMentions, 'removing the guard must lose collision documentation');
  });

  await t.test('evidence-ledger: without it, no runtime component states the evidence rules', () => {
    const without = build(['evidence-ledger']);

    // The machine-readable manifest still records each capability's posture, so
    // the loss is not total. What disappears is the runtime instruction that
    // stops a weaker result being reported as a stronger one — measured over
    // the model-facing components only, not the manifest or the reports.
    const runtimeText = (dir: string) =>
      [...filesOf(dir).entries()]
        .filter(([p]) => p.startsWith('skills/') || p.startsWith('agents/'))
        .map(([, t]) => t)
        .join('');

    const withRules = runtimeText(full.built.outputDir);
    const withoutRules = runtimeText(without.built.outputDir);

    assert.match(withRules, /cannot report VERIFIED/, 'the full build states the VERIFIED rule to the model');
    assert.doesNotMatch(withoutRules, /cannot report VERIFIED/, 'without the ledger no component states it');

    const postures = (t: string) => (t.match(/REFERENCE_ONLY|CONDITIONAL|REVIEW_REQUIRED|UNKNOWN/g) ?? []).length;
    assert.ok(
      postures(withRules) > postures(withoutRules),
      `gate posture statements drop from ${postures(withRules)} to ${postures(withoutRules)}`,
    );
  });

  await t.test('visual-review: without it, measured task completion drops', () => {
    const tasks = readJson<{ tasks: BenchmarkTask[] }>(
      resolve(projectRoot(), 'tests', 'benchmark', 'tasks.json'),
    ).tasks;

    const { subjects, integratedName, unionName } = buildSubjects(scout, plan);
    const withReview = runBenchmark(tasks, subjects, { integratedName, unionName });

    // Same subjects, but the integrated plugin no longer holds visual-review.
    const ablated = subjects.map((s) =>
      s.name === integratedName ? { ...s, capabilities: s.capabilities.filter((c) => c !== 'visual-review') } : s,
    );
    const withoutReview = runBenchmark(tasks, ablated, { integratedName, unionName });

    const before = withReview.metrics.find((m) => m.metric === 'Task Completion')?.values[integratedName] as number;
    const after = withoutReview.metrics.find((m) => m.metric === 'Task Completion')?.values[integratedName] as number;
    assert.ok(after < before, `removing visual-review must cost completion: ${before} -> ${after}`);
  });

  await t.test('a component with no measurable effect would be caught here', () => {
    // Control: suppressing a name that is not a component must change nothing.
    const control = build(['not-a-real-component']);
    assert.equal(allText(control.built.outputDir).length, fullText.length);
  });
});
