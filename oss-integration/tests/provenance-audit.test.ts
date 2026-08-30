import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, rmSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { runScout } from '../src/pipeline.js';
import { designArchitecture } from '../src/integration/architect.js';
import { buildPlugin } from '../src/builder/plugin-builder.js';
import { analyzeRepository } from '../src/repository/analyzer.js';

/**
 * PROVENANCE AUDIT.
 *
 * The claim `Reused Code: None` is checked against the GENERATED ARTIFACTS,
 * not against the generator's intention. If a fragment of an upstream artifact
 * appeared in the output, these assertions would fail regardless of what the
 * builder believes it did.
 */

const GOAL = 'Claude Codeで最高品質のWebサイトを作れるPluginを作って';
const REPOS = [
  'https://github.com/fixture-org/frontend-craft-plugin',
  'https://github.com/fixture-org/browser-qa-plugin',
  'https://github.com/fixture-org/a11y-guard-plugin',
];

function allFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) out.push(...allFiles(full));
    else out.push(full);
  }
  return out;
}

/** Every run of >= `n` words that appears in a source artifact. */
function shingles(text: string, n = 8): Set<string> {
  const words = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(' '));
  return out;
}

test('PROVENANCE: no upstream artifact text survives into the generated plugin', async (t) => {
  const dir = mkdtempSync(resolve(tmpdir(), 'oss-prov-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const scout = await runScout({ goal: GOAL, repos: REPOS });
  const plan = designArchitecture(scout.stack, { pluginName: 'audit-plugin' });
  const built = buildPlugin(plan, { outputRoot: dir });

  // Every artifact the analyser actually held for every source it looked at.
  const upstream: { id: string; path: string; text: string }[] = [];
  for (const r of [...scout.supplied, ...scout.discovered]) {
    for (const [path, text] of Object.entries(r.profile.artifacts)) {
      upstream.push({ id: r.profile.id, path, text });
    }
  }
  assert.ok(upstream.length > 0, 'nothing upstream was held, so this audit would prove nothing');

  const generated = allFiles(built.outputDir);
  assert.ok(generated.length > 0);

  const collisions: string[] = [];
  for (const file of generated) {
    const produced = shingles(readFileSync(file, 'utf8'));
    for (const src of upstream) {
      for (const shingle of shingles(src.text)) {
        if (produced.has(shingle)) {
          collisions.push(`${file.replace(built.outputDir, '')} shares 8+ words with ${src.id}:${src.path} — "${shingle}"`);
        }
      }
    }
  }
  assert.deepEqual(collisions, [], `Reused Code is claimed to be None, but:\n${collisions.join('\n')}`);
});

test('PROVENANCE: every generated component is attributed', async (t) => {
  const dir = mkdtempSync(resolve(tmpdir(), 'oss-prov2-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const scout = await runScout({ goal: GOAL, repos: REPOS });
  const plan = designArchitecture(scout.stack, { pluginName: 'audit-plugin' });
  const built = buildPlugin(plan, { outputRoot: dir });
  const provenance = readFileSync(resolve(built.outputDir, 'PROVENANCE.md'), 'utf8');

  for (const field of [
    'Source', 'Repository', 'Author', 'Research date', 'Adopted concept',
    'Reused code', 'Modification', 'Original contribution', 'Evidence', 'Decision',
  ]) {
    assert.ok(provenance.includes(field), `PROVENANCE.md has no "${field}" field`);
  }

  // Every capability in the stack must appear, and every original component too.
  for (const entry of plan.stack.entries) {
    assert.ok(provenance.includes(entry.capabilityId), `${entry.capabilityId} is in the stack but not in PROVENANCE.md`);
  }
  for (const oc of plan.originalComponents) {
    assert.ok(provenance.includes(oc.id), `original component ${oc.id} is not recorded in PROVENANCE.md`);
  }
  for (const record of built.provenance) {
    assert.equal(record.reusedCode, 'None');
    assert.ok(record.researchDate.match(/^\d{4}-\d{2}-\d{2}$/));
  }
});

test('PROVENANCE: a REFERENCE_ONLY source is never presented as reusable', async () => {
  // Ambit is pinned to concept-reference-only by project policy, whatever its
  // permissive licence allows.
  const ambit = await analyzeRepository('zz-plant/ambit');
  const { extractWithGates } = await import('../src/capability/extractor.js');
  const { capabilities, license } = extractWithGates(ambit, { commercialUse: 'UNKNOWN' });
  assert.equal(license.policy, 'REFERENCE_ONLY');
  for (const c of capabilities) assert.equal(c.licenseStatus, 'REFERENCE_ONLY');

  const { mayCopyCode } = await import('../src/license/gate.js');
  assert.equal(mayCopyCode(license.policy), false);
});
