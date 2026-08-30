import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

import { normalizeGoal } from '../src/goal/engine.js';
import { projectRoot, readJson } from '../src/util/io.js';
import type { GoalSpec } from '../src/types.js';

interface GoalCase {
  id: string;
  goal: string;
  expectEnvironment: string;
  expectArchetype: string | null;
  mustInclude: string[];
  mustNotInclude: string[];
  mustBeUnknown: ('targetEnvironment' | 'constraints' | 'commercialUse')[];
}

const cases = readJson<{ cases: GoalCase[] }>(
  resolve(projectRoot(), 'tests', 'evaluation-cases', 'goal-cases.json'),
).cases;

for (const c of cases) {
  test(`goal case ${c.id}: ${c.goal.slice(0, 48)}`, () => {
    const spec = normalizeGoal({ goal: c.goal });

    assert.equal(spec.targetEnvironment, c.expectEnvironment);

    if (c.expectArchetype) {
      assert.ok(
        spec.derivedFrom.some((d) => d.archetype === c.expectArchetype),
        `expected archetype "${c.expectArchetype}", got [${spec.derivedFrom.map((d) => d.archetype).join(', ')}]`,
      );
      // An expansion the user cannot audit is an invention.
      for (const d of spec.derivedFrom) assert.ok(d.rationale.length > 40, `${d.archetype} expanded with no rationale`);
    } else {
      assert.equal(spec.derivedFrom.length, 0, 'no archetype should have matched this goal');
    }

    for (const cap of c.mustInclude) {
      assert.ok(spec.requiredCapabilities.includes(cap), `${c.id}: missing required capability "${cap}"`);
    }
    // Over-expansion is the failure mode that turns a goal-driven system into a
    // bundler, so it is asserted as hard as under-expansion.
    for (const cap of c.mustNotInclude) {
      assert.ok(
        !spec.requiredCapabilities.includes(cap),
        `${c.id}: capability "${cap}" was added although the goal never implies it`,
      );
    }

    for (const field of c.mustBeUnknown) {
      assertUnknown(spec, field, c.id);
    }
  });
}

function assertUnknown(spec: GoalSpec, field: GoalCase['mustBeUnknown'][number], caseId: string): void {
  if (field === 'constraints') {
    assert.deepEqual(spec.constraints, [], `${caseId}: a constraint was invented`);
    assert.ok(spec.unknowns.some((u) => u.startsWith('CONSTRAINTS')));
  } else if (field === 'commercialUse') {
    assert.equal(spec.commercialUse, 'UNKNOWN', `${caseId}: commercial use was assumed`);
    assert.ok(spec.unknowns.some((u) => u.startsWith('COMMERCIAL USE')));
  } else {
    assert.equal(spec.targetEnvironment, 'UNKNOWN', `${caseId}: a target environment was assumed`);
    assert.ok(spec.unknowns.some((u) => u.startsWith('TARGET ENVIRONMENT')));
  }
}
