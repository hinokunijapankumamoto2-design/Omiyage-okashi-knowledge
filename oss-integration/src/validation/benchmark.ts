import type { BenchmarkReport, BenchmarkVerdict, MetricResult } from '../types.js';
import { dataPath, readJson } from '../util/io.js';

/**
 * Benchmark Runner and Comparison Reporter.
 *
 * Metric definitions are NOT written here. They live in
 * data/benchmark-metrics.json, pre-registered before measurement, and this file
 * reads them. That is deliberate: a definition that lives next to the code
 * computing it is a definition that can quietly follow the result.
 *
 * Rule 30 / rule 22: an unmeasured dimension is NOT_VERIFIED, never an
 * improvement. A measured regression is reported, never excluded.
 */

export interface BenchmarkTask {
  id: string;
  name: string;
  requires: string[];
}

export interface BenchmarkSubject {
  name: string;
  capabilities: string[];
  degraded: string[];
  securityFindings: number;
  integrationDebt: number;
  installActions: number;
  installRuntimes: string[];
  upstreamProjects: number;
  /** Required sources with nothing scanned, so their security gate is UNKNOWN. */
  unscannedDependencies: number;
  directDependencies: number;
  nonPassSecurity: number;
  nonPermissiveLicense: number;
  /** Present only when the subject was actually executed against a real target. */
  executed?: ExecutedResult;
}

export interface ExecutedResult {
  tasksAttempted: number;
  tasksPassed: number;
  tasksErrored: number;
  totalMs: number;
  /** Per-criterion rubric outcome, needed to compare subjects on the same criteria. */
  rubric: { id: string; score: number | null; max: number }[];
  /** Fraction of tasks with identical outcomes across repeats, or null with one run. */
  reliability: number | null;
}

export interface MetricDefinition {
  id: string;
  name: string;
  definition: string;
  formula: string;
  direction: 'higher-is-better' | 'lower-is-better';
  measurementMethod: string;
  material: boolean;
  materialWhy: string;
  countsTowardVerdict: boolean;
  excludedBecause?: string;
  notes?: string;
  changedFromV01?: { was: string; change: string; why: string };
}

interface MetricsFile {
  version: string;
  registeredOn: string;
  materialityRule: { statement: string; why: string; appliesTo: string };
  metrics: MetricDefinition[];
  outputQualityRubric: { scale: string; criteria: { id: string; name: string; evidence: string }[] };
}

let cache: MetricsFile | null = null;

export function loadMetricDefinitions(): MetricsFile {
  if (!cache) cache = readJson<MetricsFile>(dataPath('benchmark-metrics.json'));
  return cache;
}

export function definitionOf(id: string): MetricDefinition {
  const def = loadMetricDefinitions().metrics.find((m) => m.id === id);
  if (!def) throw new Error(`No pre-registered definition for metric "${id}"`);
  return def;
}

export interface RunOptions {
  integratedName: string;
  /** The realistic alternative, used by the pre-registered cost-materiality rule. */
  unionName?: string;
}

export function runBenchmark(
  tasks: BenchmarkTask[],
  subjects: BenchmarkSubject[],
  opts: RunOptions,
): BenchmarkReport {
  const { integratedName, unionName } = opts;

  // Completion is measured against the WHOLE suite, not against what the
  // subject chose to attempt. A subject that cannot attempt a task has not
  // completed it.
  const completion = (s: BenchmarkSubject): number => {
    if (s.executed) {
      return tasks.length === 0 ? 0 : s.executed.tasksPassed / tasks.length;
    }
    return tasks.length === 0 ? 0 : tasks.filter((t) => t.requires.every((r) => s.capabilities.includes(r))).length / tasks.length;
  };

  // Error rate is a property of work that was attempted. Zero errors out of
  // zero attempts is not a clean record, it is an absence of evidence, so it
  // reports null rather than a flattering 0.
  const errorRate = (s: BenchmarkSubject): number | null => {
    if (s.executed) {
      return s.executed.tasksAttempted === 0 ? null : s.executed.tasksErrored / s.executed.tasksAttempted;
    }
    const completable = tasks.filter((t) => t.requires.every((r) => s.capabilities.includes(r)));
    if (completable.length === 0) return null;
    return completable.filter((t) => t.requires.some((r) => s.degraded.includes(r))).length / completable.length;
  };

  const metrics: MetricResult[] = [];
  const add = (id: string, fn: (s: BenchmarkSubject) => number | null) =>
    metrics.push(buildMetric(definitionOf(id), subjects, fn, integratedName, unionName));

  add('task-completion', completion);
  add('error-rate', errorRate);
  add('security-findings', (s) => s.securityFindings);
  add('integration-debt', (s) => s.integrationDebt);
  add('install-actions', (s) => s.installActions);
  add('upstream-projects', (s) => s.upstreamProjects);
  add('coverage-per-install', (s) => (s.installActions === 0 ? 0 : completion(s) / s.installActions));
  add('unscanned-dependencies', (s) => s.unscannedDependencies);
  // Composite quality is computed over the criteria EVERY executed subject
  // could evaluate. Scoring each subject over its own subset would reward a
  // subject for being unable to look.
  // Only subjects that evaluated at least one criterion take part. A subject
  // that could evaluate nothing has no Output Quality of its own, and letting
  // it into the intersection would collapse the comparison to nothing.
  const executedSubjects = subjects.filter(
    (s) => s.executed && s.executed.rubric.some((r) => r.score !== null),
  );
  //
  // The criteria set is anchored on the primary comparison: the integrated
  // subject against the realistic alternative (`originals-union`). Individual
  // originals often have disjoint capabilities, so intersecting across all of
  // them collapses to nothing and measures neither subject.
  const evaluated = (name: string): string[] =>
    subjects.find((s) => s.name === name)?.executed?.rubric.filter((r) => r.score !== null).map((r) => r.id) ?? [];
  const anchorA = evaluated(integratedName);
  const anchorB = unionName ? evaluated(unionName) : [];
  const commonCriteria =
    anchorA.length > 0 && anchorB.length > 0
      ? anchorA.filter((id) => anchorB.includes(id))
      : executedSubjects.length === 0
        ? []
        : (executedSubjects[0] as BenchmarkSubject).executed!.rubric
            .map((r) => r.id)
            .filter((id) => executedSubjects.every((s) => s.executed!.rubric.find((r) => r.id === id)?.score !== null));

  add('output-quality', (s) => {
    if (!s.executed || commonCriteria.length === 0) return null;
    // A subject that could not evaluate every common criterion gets n/a rather
    // than a score over a smaller set, which would not be the same question.
    const rows = s.executed.rubric.filter((r) => commonCriteria.includes(r.id));
    if (rows.length !== commonCriteria.length || rows.some((r) => r.score === null)) return null;
    const max = rows.reduce((a, r) => a + r.max, 0);
    return max === 0 ? null : rows.reduce((a, r) => a + (r.score ?? 0), 0) / max;
  });
  add('quality-criteria-covered', (s) =>
    s.executed ? s.executed.rubric.filter((r) => r.score !== null).length : null,
  );
  // Likewise, 0 ms to do nothing is not a fast subject.
  add('execution-time', (s) => (s.executed && s.executed.tasksAttempted > 0 ? s.executed.totalMs : null));
  add('reliability', (s) => s.executed?.reliability ?? null);
  // Policy v0.1.1: normalized time metrics ADDED beside raw Execution Time,
  // which keeps its own verdict above. Undefined denominators report null.
  add('time-per-completed-task', (s) => {
    if (!s.executed || s.executed.tasksAttempted === 0) return null;
    const completed = completion(s) * tasks.length;
    return completed === 0 ? null : s.executed.totalMs / completed;
  });
  add('time-per-quality-criterion', (s) => {
    if (!s.executed || s.executed.tasksAttempted === 0) return null;
    const criteria = s.executed.rubric.filter((r) => r.score !== null).length;
    return criteria === 0 ? null : s.executed.totalMs / criteria;
  });
  add('ux', () => null);
  add('setup-time', () => null);
  add('token-usage', () => null);

  const counted = metrics.filter((m) => m.measured && m.countsTowardVerdict);
  const informational = metrics.filter((m) => m.measured && !m.countsTowardVerdict);

  let overall: BenchmarkVerdict;
  let overallNote: string;
  if (counted.length === 0) {
    overall = 'NOT_VERIFIED';
    overallNote = 'No metric could be measured.';
  } else if (counted.some((m) => m.verdict === 'REGRESSION')) {
    overall = 'REGRESSION';
    overallNote =
      'REGRESSION DETECTED on: ' +
      counted.filter((m) => m.verdict === 'REGRESSION').map((m) => m.metric).join(', ') +
      '. Rule 21: the overall verdict is REGRESSION whenever any measured metric regresses, whether or not that regression is material.';
  } else if (counted.some((m) => m.verdict === 'IMPROVED')) {
    overall = 'IMPROVED';
    overallNote =
      'Improved on the measured metrics with no measured regression. Dimensions that were not measured remain IMPROVEMENT NOT VERIFIED and are listed below.';
  } else {
    overall = 'EQUIVALENT';
    overallNote = 'No measured metric moved in either direction.';
  }
  if (informational.length > 0) {
    overallNote += ` ${informational.length} metric(s) were measured but carry no verdict; each states why.`;
  }

  return {
    kind: subjects.some((s) => s.executed)
      ? 'mixed: executed task results where a subject was run against a real target, static capability coverage elsewhere. Per-metric measurementMethod says which.'
      : 'static-capability-coverage. No subject was executed against a real target.',
    taskCount: tasks.length,
    subjects: subjects.map((s) => s.name),
    metrics,
    overall,
    overallNote,
    notMeasured: metrics.filter((m) => !m.measured).map((m) => `${m.metric} — ${m.note}`),
  };
}

function buildMetric(
  def: MetricDefinition,
  subjects: BenchmarkSubject[],
  fn: (s: BenchmarkSubject) => number | null,
  integratedName: string,
  unionName: string | undefined,
): MetricResult {
  const higherIsBetter = def.direction === 'higher-is-better';
  const values: Record<string, number | null> = {};
  for (const s of subjects) {
    const v = fn(s);
    values[s.name] = v === null ? null : round3(v);
  }

  const measured = Object.values(values).some((v) => v !== null);
  if (!measured || !def.countsTowardVerdict) {
    return {
      metric: def.name,
      unit: def.formula,
      measured,
      countsTowardVerdict: false,
      excludedBecause: def.excludedBecause ?? (measured ? undefined : 'Not measured for any subject.'),
      values,
      higherIsBetter,
      verdict: 'NOT_VERIFIED',
      note: measured
        ? `${def.definition} ${def.measurementMethod}`
        : `${def.measurementMethod} Reporting this as improved would be a guess.`,
      material: def.material,
    };
  }

  const mine = values[integratedName];
  // Baselines are every subject except the integrated one. The bar is the
  // strongest baseline, so a subject only "improves" by beating the best
  // alternative the user already had.
  const baselineValues = subjects
    .filter((s) => s.name !== integratedName)
    .map((s) => values[s.name])
    .filter((v): v is number => v !== null && v !== undefined);

  let verdict: BenchmarkVerdict = 'NOT_VERIFIED';
  let noBaselineNote = '';
  if (baselineValues.length === 0 && mine !== null && mine !== undefined) {
    noBaselineNote =
      ' Measured for the integrated subject only: no baseline produced a comparable value, so there is nothing to compare against and the verdict stays NOT_VERIFIED rather than being called an improvement.';
  }
  if (mine !== null && mine !== undefined && baselineValues.length > 0) {
    const best = higherIsBetter ? Math.max(...baselineValues) : Math.min(...baselineValues);
    if (Math.abs(mine - best) < 1e-9) verdict = 'EQUIVALENT';
    else verdict = (higherIsBetter ? mine > best : mine < best) ? 'IMPROVED' : 'REGRESSION';
  }

  // Pre-registered materiality: a cost regression is material only when the
  // integrated subject costs more than the realistic alternative of installing
  // all the originals.
  let material = def.material;
  let materialityNote = def.materialWhy;
  if (!def.material && verdict === 'REGRESSION' && unionName) {
    const union = values[unionName];
    if (mine !== null && mine !== undefined && union !== null && union !== undefined) {
      const worseThanUnion = higherIsBetter ? mine < union : mine > union;
      material = worseThanUnion;
      materialityNote = worseThanUnion
        ? `MATERIAL: ${round3(mine)} is worse than the realistic alternative (${unionName} = ${round3(union)}), so integrating costs more than what it replaces.`
        : `Not material: ${round3(mine)} is better than the realistic alternative (${unionName} = ${round3(union)}). It regresses only against the single cheapest original, which cannot do the same work.`;
    }
  }

  return {
    metric: def.name,
    unit: def.formula,
    measured: true,
    countsTowardVerdict: true,
    values,
    higherIsBetter,
    verdict,
    note: `${def.definition} ${def.measurementMethod}${noBaselineNote}`,
    material,
    materialityNote,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function renderBenchmark(report: BenchmarkReport): string {
  const lines = ['| Metric | Direction | ' + report.subjects.join(' | ') + ' | Verdict | Material? |'];
  lines.push('| --- | --- | ' + report.subjects.map(() => '---').join(' | ') + ' | --- | --- |');
  for (const m of report.metrics) {
    const cells = report.subjects.map((s) => {
      const v = m.values[s];
      return v === null || v === undefined ? 'n/a' : String(v);
    });
    const dir = m.measured ? (m.higherIsBetter ? '↑ better' : '↓ better') : 'not measured';
    const verdict = m.countsTowardVerdict ? m.verdict : `${m.verdict} (no verdict)`;
    const material = !m.measured ? '—' : m.verdict === 'REGRESSION' ? (m.material ? '**YES**' : 'no') : '—';
    lines.push(`| ${m.metric} | ${dir} | ${cells.join(' | ')} | ${verdict} | ${material} |`);
  }
  for (const m of report.metrics) {
    if (m.measured && !m.countsTowardVerdict && m.excludedBecause) {
      lines.push(`\n> **${m.metric} carries no verdict.** ${m.excludedBecause}`);
    }
    if (m.verdict === 'REGRESSION' && m.materialityNote) {
      lines.push(`\n> **${m.metric} regressed.** ${m.materialityNote}`);
    }
  }
  return lines.join('\n');
}
