import type { ArchitecturePlan, BenchmarkReport, RepositoryProfile } from '../types.js';
import type { ScoutResult } from '../pipeline.js';
import type { SuiteResult } from './live-task-runner.js';
import { loadMetricDefinitions, renderBenchmark, type BenchmarkSubject, type BenchmarkTask } from './benchmark.js';
import { liveAttemptLog } from '../repository/analyzer.js';

/** BENCHMARK_REPORT.md — the pre-registered definitions next to the results. */
export function renderBenchmarkReport(
  report: BenchmarkReport,
  tasks: BenchmarkTask[],
  subjects: BenchmarkSubject[],
  suite: SuiteResult | null,
  excludedTasks: BenchmarkTask[] = [],
): string {
  const defs = loadMetricDefinitions();
  const executed = subjects.some((s) => s.executed);

  const definitionRows = defs.metrics
    .map((m) => {
      const result = report.metrics.find((r) => r.metric === m.name);
      const values = result
        ? report.subjects.map((s) => `${s}=${result.values[s] ?? 'n/a'}`).join(', ')
        : 'not run';
      return `### ${m.name}

| Field | Value |
| --- | --- |
| **Definition** | ${m.definition} |
| **Formula** | \`${m.formula}\` |
| **Direction** | ${m.direction} |
| **Measurement method** | ${m.measurementMethod} |
| **Counts toward verdict** | ${m.countsTowardVerdict ? 'yes' : `no — ${m.excludedBecause ?? 'not measured'}`} |
| **Material?** | ${m.material ? 'yes' : 'no'} — ${m.materialWhy} |
| **Results** | ${values} |
| **Verdict** | ${result?.verdict ?? 'NOT_VERIFIED'} |
| **Confidence** | ${confidenceOf(m.measurementMethod, Boolean(result?.measured))} |
${
  m.changedFromV01
    ? `| **Changed from v0.1** | **${m.changedFromV01.change}** Was: ${m.changedFromV01.was}. Why: ${m.changedFromV01.why} |`
    : ''
}`;
    })
    .join('\n\n');

  const rubricSection = suite
    ? [...suite.runs.entries()]
        .map(([name, run]) => {
          const rows = run.rubric
            .map((r) => `| ${r.name} | ${r.score === null ? 'NOT_VERIFIED' : `${r.score} / ${r.max}`} | ${r.evidence} |`)
            .join('\n');
          return `#### ${name}\n\n| Criterion | Score | Evidence |\n| --- | --- | --- |\n${rows}`;
        })
        .join('\n\n')
    : '_The task suite was not executed, so no criterion has evidence. Every criterion is NOT_VERIFIED._';

  const outcomes = suite
    ? [...suite.runs.entries()]
        .map(([name, run]) => {
          const rows = run.outcomes
            .map((o) => `| ${o.taskId} | ${o.status} | ${o.ms} ms | ${o.detail} | ${Object.entries(o.evidence).map(([k, v]) => `${k}=${v}`).join(', ') || '—'} |`)
            .join('\n');
          return `#### ${name}\n\n| Task | Outcome | Time | Detail | Evidence |\n| --- | --- | --- | --- | --- |\n${rows}`;
        })
        .join('\n\n')
    : '_Not executed._';

  return `# BENCHMARK REPORT

Metric definitions were **pre-registered** in \`data/benchmark-metrics.json\` on
${defs.registeredOn} (version ${defs.version}), before any implementation change
or re-measurement in this round. This file reads them; it does not restate them,
so a definition cannot drift from the code that computes it.

## Materiality rule

${defs.materialityRule.statement}

**Why it exists:** ${defs.materialityRule.why}

**Applies to:** ${defs.materialityRule.appliesTo}

## Subjects

${subjects.map((s) => `- \`${s.name}\` — ${s.capabilities.length} capabilities, ${s.installActions} install action(s)${s.installRuntimes.length ? ` (external runtimes: ${s.installRuntimes.join(', ')})` : ''}, ${s.upstreamProjects} project(s) in the supply chain`).join('\n')}

## Tasks (${tasks.length})

${tasks.map((t) => `- \`${t.id}\` ${t.name} — requires: ${t.requires.join(', ')}`).join('\n')}

${executed ? `Executed against a real page in a real browser${suite ? ` at ${suite.pageUrl}, ${suite.repeats} repeat(s)` : ''}. Each subject gets its own browser pass performing only the collection its capabilities imply, so Execution Time is that subject's own cost rather than a shared figure.` : 'Not executed: static capability coverage only.'}

${
  excludedTasks.length > 0
    ? `**Excluded from this run (${excludedTasks.length}):** ${excludedTasks.map((t) => `\`${t.id}\` ${t.name}`).join('; ')} — no executable implementation exists for them against a rendered page, so scoring any subject on them would deflate every result equally and measure nothing.`
    : ''
}

## Results

${renderBenchmark(report)}

**Overall: ${report.overall}**

${report.overallNote}

## Metric definitions and results

${definitionRows}

## Output Quality rubric

${defs.outputQualityRubric.scale}

${rubricSection}

## Per-task outcomes

${outcomes}

## Not measured

${report.notMeasured.map((n) => `- ${n}`).join('\n') || '_(none)_'}
`;
}

/** LIVE_REPOSITORY_REPORT.md — exactly what the network did and did not give us. */
export function renderLiveRepositoryReport(scout: ScoutResult): string {
  const analysed = [...scout.supplied, ...scout.discovered];
  const live = analysed.filter((r) => r.profile.source === 'live-github');
  const synthetic = analysed.filter((r) => r.profile.source === 'fixture');
  const seeded = analysed.filter((r) => r.profile.source === 'registry-seed');

  const attemptRows = live
    .map((r) => {
      const attempts = liveAttemptLog.get(r.profile.id) ?? [];
      const rows = attempts
        .map((a) => `| ${a.what} | \`${a.url}\` | ${a.ok ? '✅' : '❌'} | ${a.detail} |`)
        .join('\n');
      return `### \`${r.profile.id}\`

| What | URL | OK | Detail |
| --- | --- | --- | --- |
${rows || '| _(no attempts recorded)_ | | | |'}

**Established from the network:** licence \`${r.profile.licenseSpdx}\` (evidence ${r.profile.licenseEvidence.class}), release \`${r.profile.latestRelease}\`, last publish \`${r.profile.lastMeaningfulUpdate}\`, tests ${r.profile.tests}, ${r.profile.dependencies.length} declared dependency/ies.

**Artifacts scanned:** ${Object.keys(r.profile.artifacts).length} — security gate ${r.security.status}.

**Still UNKNOWN:** ${unknownFields(r.profile).join(', ') || '(none)'}`;
    })
    .join('\n\n');

  return `# LIVE REPOSITORY REPORT

Classification of every repository in this run. **Synthetic fixture data is
never reported as a fact about a real project**, and live findings are never
mixed into the synthetic regression baseline.

| Classification | Count | Repositories |
| --- | --- | --- |
| \`LIVE_VERIFIED\` | ${live.length} | ${live.map((r) => `\`${r.profile.id}\``).join(', ') || '—'} |
| \`SEED_REGISTRY\` (curated notes, not fetched this run) | ${seeded.length} | ${seeded.map((r) => `\`${r.profile.id}\``).join(', ') || '—'} |
| \`SYNTHETIC\` (local fixture, not a real project) | ${synthetic.length} | ${synthetic.map((r) => `\`${r.profile.id}\``).join(', ') || '—'} |

## What the live path can and cannot reach

The GitHub REST API is **not reachable** from this environment (HTTP 403 through
the egress proxy), so repository existence, default branch and the latest commit
SHA cannot be read from it. The live path therefore uses:

- \`raw.githubusercontent.com\` — licence file, README, \`package.json\`.
- \`registry.npmjs.org\` — published version, publish time, dependencies,
  install scripts, and the published tarball, which is what gives the security
  gate real source to scan.

Anything neither source establishes is recorded as \`UNKNOWN\`. In particular
the **latest commit SHA is always UNKNOWN**, and the default branch is the one
that served content rather than a confirmed default.

## Fetch log

${attemptRows || '_No live fetch was performed in this run._'}
`;
}

function unknownFields(p: RepositoryProfile): string[] {
  const out: string[] = [];
  const checks: [string, string][] = [
    ['latestRelease', p.latestRelease],
    ['lastMeaningfulUpdate', p.lastMeaningfulUpdate],
    ['architecture', p.architecture],
    ['primaryCapability', p.primaryCapability],
  ];
  for (const [key, value] of checks) {
    if (value === 'UNKNOWN') out.push(key);
  }
  out.push('sourceCommit (the API that serves it is unreachable here)');
  return out;
}

/** SECURITY_REPORT.md — every finding, and every source that was not scanned. */
export function renderSecurityReport(scout: ScoutResult, plan: ArchitecturePlan): string {
  const analysed = [...scout.supplied, ...scout.discovered];
  const selected = new Set(plan.stack.entries.map((e) => e.capability.sourceRepository));

  const rows = analysed
    .map(
      (r) =>
        `| \`${r.profile.id}\` | ${r.profile.source} | ${r.security.scanned.length} | ${r.security.status} | ${r.security.findings.length} | ${selected.has(r.profile.id) ? 'yes' : 'no'} |`,
    )
    .join('\n');

  const details = analysed
    .filter((r) => r.security.findings.length > 0)
    .map(
      (r) =>
        `### \`${r.profile.id}\`\n\n` +
        r.security.findings
          .map(
            (f) =>
              `- **${f.severity}** · ${f.risk} · in \`${f.where}\`\n  - Rule: ${f.rule}\n  - Matched: \`${f.excerpt}\``,
          )
          .join('\n'),
    )
    .join('\n\n');

  const unscanned = analysed.filter((r) => r.security.scanned.length === 0);

  return `# SECURITY REPORT

Static scanning only. **Absence of findings is not evidence of safety**, and a
source with nothing scanned is \`UNKNOWN\`, never \`PASS\`.

| Repository | Data source | Artifacts scanned | Gate | Findings | In final stack |
| --- | --- | --- | --- | --- | --- |
${rows}

## Unscanned sources

${
  unscanned.length > 0
    ? unscanned
        .map((r) => `- \`${r.profile.id}\` — nothing was available to scan, so its gate is UNKNOWN. ${r.profile.source === 'registry-seed' ? 'Run with `--live` to fetch and scan its real artifacts.' : ''}`)
        .join('\n')
    : '_Every analysed source had at least one artifact scanned._'
}

## Findings

${details || '_No finding was raised on any scanned artifact._'}
`;
}

function confidenceOf(method: string, measured: boolean): string {
  if (!measured) return 'none — not measured';
  if (method.startsWith('EXECUTED')) return 'high — produced by executing the task against a real page';
  if (method.startsWith('STATIC')) return 'medium — capability-set arithmetic, not execution';
  return 'medium';
}
