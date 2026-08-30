import type { ArchitecturePlan, BenchmarkReport } from '../types.js';
import type { ScoutResult, AnalyzedRepo } from '../pipeline.js';
import type { PackageValidation } from './package-validator.js';
import { renderBenchmark, type BenchmarkSubject, type BenchmarkTask } from './benchmark.js';
import { renderGoalSpec } from '../goal/engine.js';

/** Builds the benchmark subjects: each original source alone, then the integrated plugin. */
export function buildSubjects(scout: ScoutResult, plan: ArchitecturePlan): {
  subjects: BenchmarkSubject[];
  integratedName: string;
} {
  const subjects: BenchmarkSubject[] = scout.supplied.map((r) => toSubject(r, scout));

  const selected = plan.stack.entries;
  const unlocked = scout.graph.unlocked(selected.map((e) => e.capabilityId));
  const degraded = selected
    .filter((e) => e.capability.securityStatus !== 'PASS' || e.capability.licenseStatus === 'LEGAL_REVIEW')
    .map((e) => e.capabilityId);

  // Honest install accounting: the generated plugin is one install, plus every
  // upstream tool it still has to invoke because its code was not vendored.
  const upstream = new Set(
    selected.filter((e) => e.origin !== 'original').map((e) => e.capability.sourceRepository),
  );

  const integratedName = plan.pluginName;
  subjects.push({
    name: integratedName,
    capabilities: [...selected.map((e) => e.capabilityId), ...unlocked],
    degraded,
    securityFindings: countFindings([...scout.supplied, ...scout.discovered].filter((r) =>
      upstream.has(r.profile.id),
    )),
    // What a maintainer would still have to reconcile by hand: conflicts the
    // architect could not resolve, plus any capability that somehow ended up
    // with more than one implementation (which should always be zero).
    integrationDebt:
      plan.conflicts.filter((c) => !c.resolved).length + duplicateImplementations(selected),
    installSources: 1 + upstream.size,
  });

  return { subjects, integratedName };
}

function duplicateImplementations(entries: { capabilityId: string }[]): number {
  const seen = new Set<string>();
  let extra = 0;
  for (const e of entries) {
    if (seen.has(e.capabilityId)) extra++;
    else seen.add(e.capabilityId);
  }
  return extra;
}

function toSubject(r: AnalyzedRepo, scout: ScoutResult): BenchmarkSubject {
  const usable = r.score.blocked ? [] : r.capabilities.filter((c) => c.confidence > 0);
  const conflicts = scout.stack.conflicts.filter((c) => c.parties.includes(r.profile.id));
  return {
    name: r.profile.id,
    capabilities: usable.map((c) => c.capabilityId),
    degraded: usable
      .filter((c) => c.securityStatus !== 'PASS' || c.licenseStatus === 'LEGAL_REVIEW' || c.licenseStatus === 'BLOCK')
      .map((c) => c.capabilityId),
    securityFindings: countFindings([r]),
    integrationDebt: conflicts.length,
    installSources: 1,
  };
}

function countFindings(repos: AnalyzedRepo[]): number {
  return repos.reduce(
    (n, r) => n + r.security.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length,
    0,
  );
}

export function renderIntegrationReport(scout: ScoutResult, plan: ArchitecturePlan): string {
  const s = scout.stack;
  const byDecision = (kind: string) => s.decisions.filter((d) => d.decision === kind);

  const decisionSection = (kind: string, title: string) => {
    const rows = byDecision(kind);
    if (rows.length === 0) return `### ${title}\n\n_(none)_\n`;
    return (
      `### ${title}\n\n` +
      rows.map((d) => `- **${d.capabilityId}** ← \`${d.candidate}\`${d.replacedBy ? ` → \`${d.replacedBy}\`` : ''}\n  - ${d.reason}`).join('\n') +
      '\n'
    );
  };

  const analysed = [...scout.supplied, ...scout.discovered];

  return `# INTEGRATION REPORT — ${plan.pluginName}

## 1. Goal

\`\`\`
${renderGoalSpec(s.goal)}
\`\`\`

## 2. Repositories analysed

| Repository | Source of data | Kind | Licence | Licence gate | Security gate | Health | Scout Score | Blocked |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${analysed
  .map(
    (r) =>
      `| \`${r.profile.id}\` | ${r.profile.source} | ${r.profile.kind} | ${r.profile.licenseSpdx} | ${r.license.status} (${r.license.policy}) | ${r.security.status} | ${r.health.score ?? 'UNKNOWN'} | ${r.score.total.toFixed(2)} | ${r.score.blocked ? '**YES**' : 'no'} |`,
  )
  .join('\n')}

${analysed
  .filter((r) => r.security.findings.length > 0)
  .map(
    (r) =>
      `**Security findings — \`${r.profile.id}\`**\n\n` +
      r.security.findings
        .map((f) => `- \`${f.severity}\` ${f.risk} in ${f.where} — ${f.rule}\n  - matched: \`${f.excerpt}\``)
        .join('\n'),
  )
  .join('\n\n') || '_No security findings on the artifacts that were available to scan._'}

## 3. Capability graph (selected scope)

\`\`\`
${scout.graph.render([...new Set(s.goal.requiredCapabilities.concat(s.entries.map((e) => e.capabilityId)))])}
\`\`\`

## 4. Gap analysis

- **Required (closed over prerequisites)**: ${s.gaps.required.join(', ') || '(none)'}
- **Held after gates**: ${s.gaps.current.join(', ') || '(none)'}
- **Missing**: ${s.gaps.missing.join(', ') || '(none)'}
- **Covered by unlock (no extra source needed)**: ${s.gaps.coveredByUnlock.join(', ') || '(none)'}

### Near misses

${
  s.gaps.nearMisses.length > 0
    ? s.gaps.nearMisses
        .map((n) => `- Adding **${n.missing.join(' + ')}** (distance ${n.distance}) would unlock **${n.unlocks}**; already held: ${n.have.join(', ')}.`)
        .join('\n')
    : '_(none)_'
}

## 5. Duplicates

${
  s.duplicates.length > 0
    ? s.duplicates
        .map((d) => `- **${d.capabilityId}**: ${d.members.join(', ')} → winner \`${d.winner}\` on ${d.axis}.\n  - ${d.reason}`)
        .join('\n')
    : '_No capability was supplied by more than one candidate._'
}

## 6. Conflicts

${
  plan.conflicts.length > 0
    ? plan.conflicts
        .map((c) => `- ${c.resolved ? '✅' : '⚠️'} **${c.kind}** on \`${c.subject}\` (${c.parties.join(', ')})\n  - ${c.detail}\n  - Resolution: ${c.resolution}`)
        .join('\n')
    : '_No conflicts detected._'
}

## 7. KEEP / REPLACE / ADD / REMOVE

${decisionSection('KEEP', 'KEEP')}
${decisionSection('REPLACE', 'REPLACE')}
${decisionSection('ADD', 'ADD')}
${decisionSection('REMOVE', 'REMOVE')}
${decisionSection('WATCH', 'WATCH')}
${decisionSection('REJECT', 'REJECT')}
${decisionSection('UNKNOWN', 'UNKNOWN')}

## 8. Best Capability Stack

| Capability | Concept source | Origin | Selection axis | Evidence | Confidence | Licence posture | Security |
| --- | --- | --- | --- | --- | --- | --- | --- |
${s.entries
  .map(
    (e) =>
      `| ${e.capabilityId} | \`${e.capability.sourceRepository}\` | ${e.origin} | ${e.selectionAxis} | ${e.capability.evidence.class} | ${e.capability.confidence} | ${e.capability.licenseStatus} | ${e.capability.securityStatus} |`,
  )
  .join('\n')}

## 9. Integration architecture

${plan.layers.map((l) => `### ${l.name}\n\n${l.responsibility}\n\n- Capabilities: ${l.capabilities.join(', ') || '(orchestration only)'}\n- Components: ${l.components.map((c) => `${c.kind}:${c.name}`).join(', ')}`).join('\n\n')}

### Normalized dependencies

${
  plan.normalizedDependencies.length > 0
    ? plan.normalizedDependencies.map((d) => `- \`${d.name}\` — required by ${d.requiredBy.join(', ')}. ${d.resolution}`).join('\n')
    : '_No third-party runtime dependency is required by the selected capabilities._'
}

### Workflow

${plan.workflow.map((w) => `- ${w}`).join('\n')}

## 9b. Stack optimization

Selection picks the strongest source per capability in isolation, which can
scatter the stack across more projects than it needs. This pass consolidates
onto sources the stack already carries, and never trades evidence for tidiness.

- Distinct external sources before: **${scout.optimization.sourceCountBefore}**
- Distinct external sources after: **${scout.optimization.sourceCountAfter}**

${
  scout.optimization.consolidations.length > 0
    ? scout.optimization.consolidations
        .map((c) => `- \`${c.capabilityId}\`: ${c.from} → ${c.to}\n  - ${c.reason}`)
        .join('\n')
    : '_No consolidation was possible without weakening evidence._'
}

## 10. Original layer

${
  plan.originalComponents.length > 0
    ? plan.originalComponents
        .map((o) => `### ${o.name} (\`${o.id}\`)\n\n${o.rationale}\n\nJustified by:\n${o.justifiedBy.map((j) => `- ${j}`).join('\n')}`)
        .join('\n\n')
    : '_No original component was needed._'
}

## 11. Discovery notes

${scout.discoveryNotes.map((n) => `- ${n}`).join('\n') || '_(none)_'}

## 12. UNKNOWN

${
  [
    ...s.goal.unknowns.map((u) => `- Goal: ${u}`),
    ...scout.unresolved.map((c) => `- No candidate found for required capability \`${c}\`.`),
    ...analysed
      .filter((r) => r.profile.licenseSpdx === 'UNKNOWN')
      .map((r) => `- Licence of \`${r.profile.id}\` is UNKNOWN; no code from it may be copied.`),
  ].join('\n') || '_(none)_'
}
`;
}

export function renderValidationReport(
  plan: ArchitecturePlan,
  pkg: PackageValidation,
  bench: BenchmarkReport,
  tasks: BenchmarkTask[],
): string {
  return `# VALIDATION REPORT — ${plan.pluginName}

## 1. Package validation

**Result: ${pkg.ok ? 'PASS' : 'FAIL'}**

Checked ${pkg.checked.length} path(s): ${pkg.checked.map((c) => `\`${c}\``).join(', ')}

${
  pkg.issues.length > 0
    ? pkg.issues.map((i) => `- **${i.severity}**: ${i.message}`).join('\n')
    : '_No structural issue found._'
}

## 2. Benchmark

**Kind:** ${bench.kind}

**Tasks (${bench.taskCount})**

${tasks.map((t) => `- \`${t.id}\` ${t.name} — requires: ${t.requires.join(', ')}`).join('\n')}

${renderBenchmark(bench)}

**Overall: ${bench.overall}**

${bench.overallNote}

## 3. What was NOT measured

${bench.notMeasured.map((n) => `- ${n}`).join('\n')}

Any of the above reported as an improvement would be a guess. They are
**IMPROVEMENT NOT VERIFIED**.

## 4. Regression check

${
  bench.metrics.filter((m) => m.verdict === 'REGRESSION').length > 0
    ? '**REGRESSION DETECTED** on:\n\n' +
      bench.metrics
        .filter((m) => m.verdict === 'REGRESSION')
        .map((m) => `- ${m.metric}: ${JSON.stringify(m.values)}`)
        .join('\n') +
      '\n\nThe integration architecture must account for this before the plugin is presented as better than its sources.'
    : '_No measured metric regressed against the strongest individual baseline._'
}
`;
}
