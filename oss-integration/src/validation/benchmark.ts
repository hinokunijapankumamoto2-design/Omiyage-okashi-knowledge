import type { BenchmarkReport, BenchmarkVerdict, MetricResult } from '../types.js';

/**
 * Benchmark Runner and Comparison Reporter.
 *
 * What this measures is deliberately narrow and stated in the output: static
 * capability coverage of a task suite, plus gate and integration-hygiene
 * counts. It does NOT measure output quality, runtime reliability, token usage
 * or UX, and it says so rather than leaving the reader to assume it did.
 *
 * Rule 30: an unmeasured improvement is reported as NOT_VERIFIED, never as an
 * improvement.
 */

export interface BenchmarkTask {
  id: string;
  name: string;
  /** Every one of these must be held for the task to be completable. */
  requires: string[];
}

export interface BenchmarkSubject {
  name: string;
  /** Capabilities the subject can actually deliver (already gate-filtered). */
  capabilities: string[];
  /** Capabilities present but degraded by a non-PASS gate. */
  degraded: string[];
  /** High or critical security findings attributable to this subject. */
  securityFindings: number;
  /** Duplicate implementations plus unresolved conflicts carried by the subject. */
  integrationDebt: number;
  /** Distinct projects a user must install and configure. */
  installSources: number;
}

const NOT_MEASURED = [
  'Output Quality — needs a rubric-scored run against real pages; not run in v0.1.',
  'Reliability — needs repeated runs to measure variance; not run in v0.1.',
  'UX — needs human subjects; not run in v0.1.',
  'Execution Time (plugin runtime) — the pipeline build time is measured, but the generated plugin was not executed against a live target.',
  'Token Usage — the generated plugin was not executed, so no token accounting exists.',
  'Setup Time — install-source count is reported as a proxy; wall-clock setup was not timed.',
];

export function runBenchmark(
  tasks: BenchmarkTask[],
  subjects: BenchmarkSubject[],
  integratedName: string,
): BenchmarkReport {
  const metrics: MetricResult[] = [];

  const completion = (s: BenchmarkSubject) =>
    tasks.length === 0 ? 0 : tasks.filter((t) => t.requires.every((r) => s.capabilities.includes(r))).length / tasks.length;

  const degradedRate = (s: BenchmarkSubject) => {
    const completable = tasks.filter((t) => t.requires.every((r) => s.capabilities.includes(r)));
    if (completable.length === 0) return tasks.length === 0 ? 0 : 1;
    const degraded = completable.filter((t) => t.requires.some((r) => s.degraded.includes(r)));
    return degraded.length / completable.length;
  };

  metrics.push(
    metric('Task Completion', 'fraction of tasks whose required capabilities are all held', true, subjects, completion, integratedName,
      'Static coverage check: does the subject hold every capability the task needs. It does not run the task.'),
  );
  metrics.push(
    metric('Error Rate', 'fraction of completable tasks touching a capability with a non-PASS gate', false, subjects, degradedRate, integratedName,
      'A task that depends on a gate-degraded capability is counted as error-prone, because that capability cannot be reported as verified.'),
  );
  metrics.push(
    metric('Security', 'count of high/critical findings', false, subjects, (s) => s.securityFindings, integratedName,
      'Static pattern-scan findings on the artifacts that were available. Absence of findings is not proof of safety.'),
  );
  metrics.push(
    metric('Maintainability', 'duplicate implementations + unresolved conflicts', false, subjects, (s) => s.integrationDebt, integratedName,
      'Counts what a maintainer would have to reconcile by hand.'),
  );
  metrics.push({
    ...metric('Install Sources', 'distinct projects to install and configure', false, subjects, (s) => s.installSources, integratedName,
      'Proxy for setup cost. Wall-clock setup time was not measured.'),
    countsTowardVerdict: false,
    excludedBecause:
      'Not a like-for-like comparison: the subjects deliver different numbers of capabilities, so comparing raw install counts rewards the subject that does least. The normalized metric below is the one that counts. The raw numbers are still reported, and a rise in them is called out in the regression section.',
  });
  metrics.push(
    metric('Capability Coverage per Install Source', 'completable tasks per project installed', true, subjects,
      (s) => (s.installSources === 0 ? 0 : completion(s) / s.installSources), integratedName,
      'Setup cost normalized by what that setup actually buys.'),
  );

  for (const label of ['Output Quality', 'Reliability', 'UX', 'Token Usage', 'Execution Time (plugin runtime)']) {
    metrics.push({
      metric: label,
      unit: 'not measured',
      measured: false,
      countsTowardVerdict: false,
      excludedBecause: 'Not measured in v0.1.',
      values: Object.fromEntries(subjects.map((s) => [s.name, null])),
      higherIsBetter: true,
      verdict: 'NOT_VERIFIED',
      note: 'Not measured in v0.1. Reporting it as improved would be a guess.',
    });
  }

  const measured = metrics.filter((m) => m.measured && m.countsTowardVerdict);
  const informational = metrics.filter((m) => m.measured && !m.countsTowardVerdict);
  let overall: BenchmarkVerdict;
  let overallNote: string;

  if (measured.length === 0) {
    overall = 'NOT_VERIFIED';
    overallNote = 'No metric could be measured.';
  } else if (measured.some((m) => m.verdict === 'REGRESSION')) {
    overall = 'REGRESSION';
    overallNote =
      'REGRESSION DETECTED on at least one measured metric. The integration architecture must be revisited before this plugin is presented as an improvement.';
  } else if (measured.some((m) => m.verdict === 'IMPROVED')) {
    overall = 'IMPROVED';
    overallNote =
      'Improved on the measured static metrics only. Output quality, runtime reliability, UX and token usage were NOT measured and remain IMPROVEMENT NOT VERIFIED.';
    const worseInfo = informational.filter((m) => m.verdict === 'REGRESSION');
    if (worseInfo.length > 0) {
      overallNote +=
        ' Note: ' +
        worseInfo.map((m) => m.metric).join(', ') +
        ' moved the wrong way. That metric is excluded from the verdict as not like-for-like, but it is a real cost and is reported in full below.';
    }
  } else {
    overall = 'EQUIVALENT';
    overallNote = 'No measured metric moved in either direction.';
  }

  return {
    kind: 'static-capability-coverage (v0.1). The generated plugin was not executed against a live target.',
    taskCount: tasks.length,
    subjects: subjects.map((s) => s.name),
    metrics,
    overall,
    overallNote,
    notMeasured: NOT_MEASURED,
  };
}

function metric(
  name: string,
  unit: string,
  higherIsBetter: boolean,
  subjects: BenchmarkSubject[],
  fn: (s: BenchmarkSubject) => number,
  integratedName: string,
  note: string,
): MetricResult {
  const values: Record<string, number | null> = {};
  for (const s of subjects) values[s.name] = round3(fn(s));

  const integrated = subjects.find((s) => s.name === integratedName);
  const baselines = subjects.filter((s) => s.name !== integratedName);

  let verdict: BenchmarkVerdict = 'NOT_VERIFIED';
  if (integrated && baselines.length > 0) {
    const mine = fn(integrated);
    const bestBaseline = higherIsBetter
      ? Math.max(...baselines.map(fn))
      : Math.min(...baselines.map(fn));
    if (approxEqual(mine, bestBaseline)) verdict = 'EQUIVALENT';
    else if (higherIsBetter ? mine > bestBaseline : mine < bestBaseline) verdict = 'IMPROVED';
    else verdict = 'REGRESSION';
  }

  return {
    metric: name,
    unit,
    measured: true,
    countsTowardVerdict: true,
    values,
    higherIsBetter,
    verdict,
    note: `${note} Compared against the BEST individual baseline, not the average, so the bar is the strongest original.`,
  };
}

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function renderBenchmark(report: BenchmarkReport): string {
  const header = ['| Metric | Direction | ' + report.subjects.join(' | ') + ' | Verdict |'];
  header.push('| --- | --- | ' + report.subjects.map(() => '---').join(' | ') + ' | --- |');
  for (const m of report.metrics) {
    const cells = report.subjects.map((s) => {
      const v = m.values[s];
      return v === null || v === undefined ? 'n/a' : String(v);
    });
    const verdictCell = m.countsTowardVerdict ? m.verdict : `${m.verdict} (informational)`;
    header.push(
      `| ${m.metric} | ${m.measured ? (m.higherIsBetter ? 'higher better' : 'lower better') : 'not measured'} | ${cells.join(' | ')} | ${verdictCell} |`,
    );
  }
  const notes = report.metrics
    .filter((m) => m.measured && !m.countsTowardVerdict && m.excludedBecause)
    .map((m) => `\n> **${m.metric} is informational.** ${m.excludedBecause}`);
  return header.join('\n') + notes.join('\n');
}
