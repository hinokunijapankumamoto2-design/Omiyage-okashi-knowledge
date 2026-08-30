import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';

import { runScout } from '../src/pipeline.js';
import { designArchitecture } from '../src/integration/architect.js';
import { buildProvenance } from '../src/builder/plugin-builder.js';
import { analyzeRepository } from '../src/repository/analyzer.js';
import { projectRoot, readJson } from '../src/util/io.js';

/**
 * The schemas in schemas/ are contracts, not documentation. This suite compiles
 * them and validates real pipeline output against them, so a change to the
 * domain model that forgets the schema fails the build.
 */

function ajv() {
  // `strict: false` so declarative annotations like `format` and `$comment`
  // are tolerated rather than requiring a format plugin we do not otherwise need.
  const instance = new Ajv2020({ strict: false, allErrors: true });
  const dir = resolve(projectRoot(), 'schemas');
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const schema = readJson<Record<string, unknown>>(resolve(dir, file));
    // Register under the bare filename too, so relative $refs resolve.
    instance.addSchema(schema, file);
  }
  return instance;
}

const GOAL = 'Claude Codeで最高品質のWebサイトを作れるPluginを作って';
const REPOS = [
  'https://github.com/fixture-org/frontend-craft-plugin',
  'https://github.com/fixture-org/browser-qa-plugin',
  'https://github.com/fixture-org/a11y-guard-plugin',
];

test('every schema compiles', () => {
  const instance = ajv();
  for (const file of ['capability.schema.json', 'repository.schema.json', 'stack.schema.json', 'provenance.schema.json']) {
    assert.ok(instance.getSchema(file), `${file} failed to compile`);
  }
});

test('committed repository fixtures conform to repository.schema.json', () => {
  const validate = ajv().getSchema('repository.schema.json');
  assert.ok(validate);
  const dir = resolve(projectRoot(), 'tests', 'fixtures', 'repos');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const data = readJson<unknown>(resolve(dir, file));
    assert.ok(validate(data), `${file}: ${JSON.stringify(validate.errors, null, 2)}`);
  }
});

test('analyzer output conforms to repository.schema.json for every resolution path', async () => {
  const validate = ajv().getSchema('repository.schema.json');
  assert.ok(validate);
  const profiles = await Promise.all([
    analyzeRepository('fixture-org/browser-qa-plugin'), // fixture path
    analyzeRepository('microsoft/playwright'), // registry-seed path
    analyzeRepository('nobody/not-seeded-anywhere'), // UNKNOWN stub path
  ]);
  for (const p of profiles) {
    assert.ok(validate(p), `${p.id} (${p.source}): ${JSON.stringify(validate.errors, null, 2)}`);
  }
});

test('pipeline output conforms to stack.schema.json and capability.schema.json', async () => {
  const instance = ajv();
  const validateStack = instance.getSchema('stack.schema.json');
  const validateCapability = instance.getSchema('capability.schema.json');
  assert.ok(validateStack && validateCapability);

  const scout = await runScout({ goal: GOAL, repos: REPOS });
  assert.ok(validateStack(scout.stack), JSON.stringify(validateStack.errors, null, 2));

  for (const entry of scout.stack.entries) {
    assert.ok(
      validateCapability(entry.capability),
      `${entry.capabilityId}: ${JSON.stringify(validateCapability.errors, null, 2)}`,
    );
  }
});

test('provenance records conform to provenance.schema.json', async () => {
  const validate = ajv().getSchema('provenance.schema.json');
  assert.ok(validate);
  const scout = await runScout({ goal: GOAL, repos: REPOS });
  const plan = designArchitecture(scout.stack, { pluginName: 'schema-check-plugin' });
  const records = buildProvenance(plan, '2026-08-30');
  assert.ok(records.length > 0);
  for (const r of records) {
    assert.ok(validate(r), `${r.capability}: ${JSON.stringify(validate.errors, null, 2)}`);
    assert.equal(r.reusedCode, 'None');
  }
});

test('the capability taxonomy and OSS registry are internally consistent', () => {
  const taxonomy = readJson<{ capabilities: { id: string }[]; relations: { from: string[]; to: string }[]; goalArchetypes: { required: string[]; optional: string[] }[] }>(
    resolve(projectRoot(), 'data', 'capability-registry.json'),
  );
  const known = new Set(taxonomy.capabilities.map((c) => c.id));

  for (const rel of taxonomy.relations) {
    for (const f of rel.from) assert.ok(known.has(f), `relation references unknown capability "${f}"`);
    assert.ok(known.has(rel.to), `relation references unknown capability "${rel.to}"`);
  }
  for (const arch of taxonomy.goalArchetypes) {
    for (const c of [...arch.required, ...arch.optional]) {
      assert.ok(known.has(c), `goal archetype references unknown capability "${c}"`);
    }
  }

  const registry = readJson<{ entries: { id: string; primaryCapability: string; secondaryCapabilities: string[] }[] }>(
    resolve(projectRoot(), 'data', 'oss-registry.json'),
  );
  for (const e of registry.entries) {
    assert.ok(known.has(e.primaryCapability), `${e.id} declares unknown primary capability "${e.primaryCapability}"`);
    for (const s of e.secondaryCapabilities) {
      assert.ok(known.has(s), `${e.id} declares unknown secondary capability "${s}"`);
    }
  }
});
